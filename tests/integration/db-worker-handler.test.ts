import { mkdtemp, rm, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { toVolumeId, type CatalogSummary } from "@shared/contracts/drives";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { createDbWorkerHandler, type DbWorkerHandler } from "../../src/main/db/db-worker-handler";
import type { DbMethod } from "../../src/main/db/worker-protocol";

const temporaryDirectories: string[] = [];
const handlers: DbWorkerHandler[] = [];

async function createHarness(): Promise<{
  handler: DbWorkerHandler;
  root: string;
  appDbPath: string;
  catalogPath: string;
  cachePath: string;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-worker-"));
  temporaryDirectories.push(root);
  const appDbPath = path.join(root, "app.db");
  const driveRoot = path.join(root, "drive");
  const catalogPath = path.join(driveRoot, ".memorylane", "catalog.db");
  const cachePath = path.join(driveRoot, ".memorylane", "cache");
  const handler = createDbWorkerHandler({ appDbPath });
  handlers.push(handler);

  return { handler, root: driveRoot, appDbPath, catalogPath, cachePath };
}

function identity(rootPath: string, volumeId = "volume-1") {
  return {
    volumeId: toVolumeId(volumeId),
    serialNumber: "SERIAL-1",
    label: "Archive",
    fileSystem: "NTFS",
    rootPath,
    letter: null,
  };
}

function createParams(rootPath: string, catalogPath: string, cachePath: string) {
  return {
    catalogPath,
    cachePath,
    identity: identity(rootPath),
    catalogSchema: 1,
  };
}

afterEach(async () => {
  for (const handler of handlers.splice(0)) {
    try {
      handler.dispose();
    } catch {
      // Already closed by a test.
    }
  }
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("database worker handler", () => {
  it("reports health and an empty drive registry", async () => {
    const { handler, appDbPath } = await createHarness();

    expect(handler.handle("health", {})).toMatchObject({ appDbPath, schemaVersion: 2 });
    expect(handler.handle("app.listDrives", {})).toEqual([]);
  });

  it("registers a drive", async () => {
    const { handler, root } = await createHarness();
    const record = handler.handle("app.registerDrive", {
      identity: identity(root),
      lastSeenAt: "2026-01-01T00:00:00.000Z",
      catalogSchema: 1,
    });

    expect(record).toMatchObject({ volumeId: "volume-1", label: "Archive" });
    expect(handler.handle("app.listDrives", {})).toHaveLength(1);
  });

  it("creates, reopens, and closes a catalog", async () => {
    const { handler, root, catalogPath, cachePath } = await createHarness();
    const created = handler.handle(
      "catalog.create",
      createParams(root, catalogPath, cachePath),
    ) as CatalogSummary;

    expect(created.fileCount).toBe(0);
    expect(created.schemaVersion).toBe(5);
    await expect(access(catalogPath)).resolves.toBeUndefined();
    await expect(access(cachePath)).resolves.toBeUndefined();

    const opened = handler.handle("catalog.open", {
      catalogPath,
      identity: identity(root),
    }) as CatalogSummary;
    expect(opened.catalogPath).toBe(catalogPath);
    expect(handler.handle("close", {})).toEqual({ closed: true });
  });

  it("rejects a duplicate catalog creation", async () => {
    const { handler, root, catalogPath, cachePath } = await createHarness();
    handler.handle("catalog.create", createParams(root, catalogPath, cachePath));

    try {
      handler.handle("catalog.create", createParams(root, catalogPath, cachePath));
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(APP_ERROR_CODES.CATALOG_ALREADY_EXISTS);
    }
  });

  it("rejects a missing catalog", async () => {
    const { handler, root, catalogPath } = await createHarness();

    try {
      handler.handle("catalog.open", { catalogPath, identity: identity(root) });
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(APP_ERROR_CODES.CATALOG_NOT_FOUND);
    }
  });

  it("rejects a catalog from a different volume", async () => {
    const { handler, root, catalogPath, cachePath } = await createHarness();
    handler.handle("catalog.create", createParams(root, catalogPath, cachePath));

    try {
      handler.handle("catalog.open", {
        catalogPath,
        identity: identity(root, "volume-2"),
      });
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(APP_ERROR_CODES.CATALOG_MISMATCH);
    }
  });

  it("rejects a relative catalog path and an unknown method", async () => {
    const { handler, root, cachePath } = await createHarness();

    expect(() =>
      handler.handle("catalog.create", createParams(root, "catalog.db", cachePath)),
    ).toThrow(AppError);
    expect(() => handler.handle("not-a-method" as DbMethod, {})).toThrow(AppError);
  });
});
