import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { BackupResult } from "@shared/contracts/settings";
import type { DbClient } from "../../../clients/db-client";
import type { DbMethod } from "../../../db/worker-protocol";
import type { AppPaths } from "../../../platform/app-paths";
import type { AppService } from "../../app/application/app-service";
import { SettingsService } from "./settings-service";

const now = new Date("2026-10-31T12:00:00.000Z");
const createdAt = now.toISOString();

function createPaths(root: string): AppPaths {
  return {
    userDataPath: root,
    appDbPath: path.join(root, "app.db"),
    logPath: path.join(root, "logs"),
    backupsPath: path.join(root, "backups"),
    sessionDataPath: path.join(root, "session"),
  };
}

function createAppService(root: string): AppService {
  return {
    getInfo: async () => ({
      appVersion: "0.1.0",
      electronVersion: "42.11.18",
      platform: "win32",
      isPackaged: false,
      userDataPath: root,
      logPath: path.join(root, "logs"),
      database: {
        state: "ready" as const,
        appDbPath: path.join(root, "app.db"),
        schemaVersion: 2,
      },
    }),
  } as unknown as AppService;
}

function createDb(overrides: Partial<Record<DbMethod, unknown>> = {}): DbClient {
  return {
    request: async <T>(method: DbMethod, params: unknown): Promise<T> => {
      const override = overrides[method];
      if (override !== undefined) {
        return (
          typeof override === "function"
            ? (override as (input: unknown) => unknown)(params)
            : override
        ) as T;
      }
      throw new Error(`Unexpected method ${method}`);
    },
  };
}

function logger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

function backupResult(): BackupResult {
  return {
    path: "C:\\backups\\catalog.db",
    bytes: 4096,
    createdAt,
    status: "success",
  };
}

describe("SettingsService", () => {
  it("reports cache, catalog, and backup information", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-settings-service-"));
    const cachePath = path.join(root, "cache");
    const catalogPath = path.join(root, "catalog.db");
    await mkdir(path.join(cachePath, "thumbnails"), { recursive: true });
    await writeFile(path.join(cachePath, "thumbnails", "a.jpg"), Buffer.alloc(10));
    await writeFile(path.join(cachePath, "b.jpg"), Buffer.alloc(5));
    await writeFile(catalogPath, Buffer.alloc(100));
    const db = createDb({
      "library.getContext": { volumeId: "volume-1", catalogPath, cachePath },
      "settings.getBackupState": {
        lastBackupAt: createdAt,
        lastStatus: "success",
        lastPath: "C:\\backups\\catalog.db",
        lastBytes: 4096,
      },
    });
    const service = new SettingsService({
      db,
      appService: createAppService(root),
      paths: createPaths(root),
      logger: logger(),
      now: () => now,
    });

    await expect(service.getInfo()).resolves.toMatchObject({
      appVersion: "0.1.0",
      offline: true,
      cache: { path: cachePath, bytes: 15, files: 2 },
      catalog: { path: catalogPath, bytes: 100 },
      backup: {
        path: path.join(root, "backups", "volume-1"),
        lastBackupAt: createdAt,
        lastStatus: "success",
        lastBytes: 4096,
      },
    });
    await rm(root, { recursive: true, force: true });
  });

  it("clears generated cache files and database rows", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-settings-service-"));
    const cachePath = path.join(root, "cache");
    const catalogPath = path.join(root, "catalog.db");
    await mkdir(cachePath, { recursive: true });
    await writeFile(path.join(cachePath, "a.jpg"), Buffer.alloc(12));
    const clear = vi.fn(async () => ({ removed: 1 }));
    const db = createDb({
      "library.getContext": { volumeId: "volume-1", catalogPath, cachePath },
      "settings.clearCache": clear,
    });
    const service = new SettingsService({
      db,
      appService: createAppService(root),
      paths: createPaths(root),
      logger: logger(),
      now: () => now,
    });

    await expect(service.clearCache()).resolves.toEqual({ removedFiles: 1, freedBytes: 12 });
    expect(clear).toHaveBeenCalledWith({});
    await expect(access(cachePath)).rejects.toThrow();
    await rm(root, { recursive: true, force: true });
  });

  it("runs backups on demand, on the timer, and during shutdown", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-settings-service-"));
    const cachePath = path.join(root, "cache");
    const catalogPath = path.join(root, "catalog.db");
    const backup = vi.fn(async () => backupResult());
    const db = createDb({
      "library.getContext": { volumeId: "volume-1", catalogPath, cachePath },
      "settings.backup": backup,
    });
    const service = new SettingsService({
      db,
      appService: createAppService(root),
      paths: createPaths(root),
      logger: logger(),
      now: () => now,
      backupIntervalMs: 10,
    });

    await expect(service.runBackup()).resolves.toMatchObject({ status: "success" });
    service.startBackupTimer();
    service.startBackupTimer();
    await new Promise((resolve) => setTimeout(resolve, 30));
    await service.shutdown();
    expect(backup.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(backup).toHaveBeenCalledWith({
      backupDir: path.join(root, "backups", "volume-1"),
      now: createdAt,
    });
    await rm(root, { recursive: true, force: true });
  });

  it("ignores scheduled backups when no catalog is open", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-settings-service-"));
    const log = logger();
    const db = createDb({
      "library.getContext": () => {
        throw new AppError(APP_ERROR_CODES.CATALOG_NOT_FOUND, "Open a catalog");
      },
    });
    const service = new SettingsService({
      db,
      appService: createAppService(root),
      paths: createPaths(root),
      logger: log,
    });

    await expect(service.shutdown()).resolves.toBeUndefined();
    expect(log.warn).not.toHaveBeenCalled();
    await rm(root, { recursive: true, force: true });
  });
});
