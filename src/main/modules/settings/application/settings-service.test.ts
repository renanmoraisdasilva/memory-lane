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

function backupRunner() {
  return { run: vi.fn(async () => backupResult()) };
}

describe("SettingsService", () => {
  it("[ML-SET-001] [ML-REL-010] reports cache, catalog, and backup information", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-settings-service-"));
    const cachePath = path.join(root, "cache");
    const catalogPath = path.join(root, "catalog.db");
    await mkdir(path.join(cachePath, "thumbnails"), { recursive: true });
    await writeFile(path.join(cachePath, "thumbnails", "a.jpg"), Buffer.alloc(10));
    await writeFile(path.join(cachePath, "b.jpg"), Buffer.alloc(5));
    await writeFile(catalogPath, Buffer.alloc(100));
    const db = createDb({
      "library.getContext": { volumeId: "volume-1", catalogPath, cachePath },
      "settings.getCacheStats": { bytes: 15, files: 2 },
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
      backupRunner: backupRunner(),
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

  it("[ML-LIB-010] [ML-SET-002] [ML-REL-010] clears generated cache files and database rows", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-settings-service-"));
    const cachePath = path.join(root, "cache");
    const catalogPath = path.join(root, "catalog.db");
    await mkdir(cachePath, { recursive: true });
    await writeFile(path.join(cachePath, "a.jpg"), Buffer.alloc(12));
    const clear = vi.fn(async () => ({ removed: 1 }));
    const db = createDb({
      "library.getContext": { volumeId: "volume-1", catalogPath, cachePath },
      "settings.getCacheStats": { bytes: 12, files: 1 },
      "settings.clearCache": clear,
    });
    const service = new SettingsService({
      db,
      appService: createAppService(root),
      paths: createPaths(root),
      backupRunner: backupRunner(),
      logger: logger(),
      now: () => now,
    });

    await expect(service.clearCache()).resolves.toEqual({ removedFiles: 1, freedBytes: 12 });
    expect(clear).toHaveBeenCalledWith({});
    await expect(access(cachePath)).rejects.toThrow();
    await rm(root, { recursive: true, force: true });
  });

  it("[ML-SET-005] [ML-SET-006] [ML-REL-010] [ML-REL-011] runs backups on demand, on the timer, and during shutdown", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-settings-service-"));
    const cachePath = path.join(root, "cache");
    const catalogPath = path.join(root, "catalog.db");
    const runner = backupRunner();
    const record = vi.fn(async () => ({ saved: true }));
    const db = createDb({
      "library.getContext": { volumeId: "volume-1", catalogPath, cachePath },
      "settings.recordBackup": record,
    });
    const service = new SettingsService({
      db,
      appService: createAppService(root),
      paths: createPaths(root),
      backupRunner: runner,
      logger: logger(),
      now: () => now,
      backupIntervalMs: 10,
    });

    await expect(service.runBackup()).resolves.toMatchObject({ status: "success" });
    service.startBackupTimer();
    service.startBackupTimer();
    await new Promise((resolve) => setTimeout(resolve, 30));
    await service.shutdown();
    expect(runner.run.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(runner.run).toHaveBeenCalledWith({
      appDbPath: path.join(root, "app.db"),
      catalogPath,
      backupDir: path.join(root, "backups", "volume-1"),
      now: createdAt,
    });
    expect(record).toHaveBeenCalledWith({
      volumeId: "volume-1",
      path: "C:\\backups\\catalog.db",
      bytes: 4096,
      now: createdAt,
      status: "success",
    });
    await rm(root, { recursive: true, force: true });
  });

  it("[ML-SET-009] [ML-SET-010] [ML-REL-011] records a failed backup and preserves the original error", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-settings-service-"));
    const cachePath = path.join(root, "cache");
    const catalogPath = path.join(root, "catalog.db");
    const record = vi.fn(async () => ({ saved: true }));
    const failure = new AppError(APP_ERROR_CODES.DB_ERROR, "Database backup failed");
    const db = createDb({
      "library.getContext": { volumeId: "volume-1", catalogPath, cachePath },
      "settings.recordBackup": record,
    });
    const service = new SettingsService({
      db,
      appService: createAppService(root),
      paths: createPaths(root),
      backupRunner: { run: vi.fn(async () => Promise.reject(failure)) },
      logger: logger(),
      now: () => now,
    });

    await expect(service.runBackup()).rejects.toBe(failure);
    expect(record).toHaveBeenCalledWith({
      volumeId: "volume-1",
      path: path.join(root, "backups", "volume-1"),
      bytes: 0,
      now: createdAt,
      status: "failed",
    });
    await rm(root, { recursive: true, force: true });
  });

  it("[ML-SET-008] [ML-REL-011] coalesces overlapping backup requests", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-settings-service-"));
    const cachePath = path.join(root, "cache");
    const catalogPath = path.join(root, "catalog.db");
    let resolveRun: () => void = () => undefined;
    const run = vi.fn(
      async () =>
        new Promise<BackupResult>((resolve) => {
          resolveRun = () => {
            resolve(backupResult());
          };
        }),
    );
    const db = createDb({
      "library.getContext": { volumeId: "volume-1", catalogPath, cachePath },
      "settings.recordBackup": vi.fn(async () => ({ saved: true })),
    });
    const service = new SettingsService({
      db,
      appService: createAppService(root),
      paths: createPaths(root),
      backupRunner: { run },
      logger: logger(),
      now: () => now,
    });

    const first = service.runBackup();
    const second = service.runBackup();
    await vi.waitFor(() => {
      expect(run).toHaveBeenCalledOnce();
    });
    resolveRun();
    await expect(first).resolves.toMatchObject({ status: "success" });
    await expect(second).resolves.toMatchObject({ status: "success" });
    expect(run).toHaveBeenCalledOnce();
    await rm(root, { recursive: true, force: true });
  });

  it("[ML-SET-008] [ML-REL-011] ignores scheduled backups when no catalog is open", async () => {
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
      backupRunner: backupRunner(),
      logger: log,
    });

    await expect(service.shutdown()).resolves.toBeUndefined();
    expect(log.warn).not.toHaveBeenCalled();
    await rm(root, { recursive: true, force: true });
  });
});
