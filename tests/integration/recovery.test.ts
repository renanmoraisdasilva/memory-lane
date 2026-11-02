import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import type { ScanState } from "@shared/contracts/scan";
import { createDbWorkerHandler, type DbWorkerHandler } from "../../src/main/db/db-worker-handler";
import { runDatabaseBackup } from "../../src/main/db/backup-runner";
import { CATALOG_SCHEMA_VERSION } from "../../src/main/db/schema-version";
import { createScanHarness, waitForComplete } from "./scan-harness";

const now = "2026-10-31T12:00:00.000Z";

async function removeDatabaseFiles(basePath: string): Promise<void> {
  await Promise.all(
    [basePath, `${basePath}-wal`, `${basePath}-shm`].map((filePath) =>
      rm(filePath, { force: true }),
    ),
  );
}

describe("recovery drills", () => {
  it("restores the catalog and app databases from a SQLite backup", async () => {
    const harness = await createScanHarness();
    const appDbPath = path.join(harness.root, "app.db");
    const backupDir = path.join(harness.root, "backups", harness.drive.volumeId);
    let restored: DbWorkerHandler | null = null;
    try {
      await writeFile(path.join(harness.drive.rootPath, "keep.txt"), "keep this");
      await harness.scanService.startScan(harness.drive.volumeId, "eco");
      await waitForComplete(harness.scanService, harness.drive);

      const backup = await runDatabaseBackup({
        appDbPath,
        catalogPath: harness.catalogPath,
        backupDir,
        now,
      });
      expect(backup.status).toBe("success");

      harness.handler.dispose();
      await removeDatabaseFiles(harness.catalogPath);
      await removeDatabaseFiles(appDbPath);
      await copyFile(path.join(backupDir, "catalog.db"), harness.catalogPath);
      await copyFile(path.join(backupDir, "app.db"), appDbPath);

      restored = createDbWorkerHandler({ appDbPath });
      restored.handle("catalog.open", {
        catalogPath: harness.catalogPath,
        identity: {
          volumeId: harness.drive.volumeId,
          serialNumber: harness.drive.serialNumber,
          label: harness.drive.label,
          fileSystem: harness.drive.fileSystem,
          rootPath: harness.drive.rootPath,
          letter: harness.drive.letter,
        },
      });

      expect(restored.handle("library.getOtherFiles", {})).toMatchObject({
        total: 1,
        items: [{ name: "keep.txt" }],
      });
    } finally {
      restored?.dispose();
      await harness.dispose();
    }
  });

  it("marks a running session interrupted after an unclean worker restart", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-unclean-"));
    const appDbPath = path.join(root, "app.db");
    const driveRoot = path.join(root, "drive");
    const catalogPath = path.join(driveRoot, ".memorylane", "catalog.db");
    const cachePath = path.join(driveRoot, ".memorylane", "cache");
    await mkdir(driveRoot, { recursive: true });
    const volumeId = toVolumeId("volume-unclean");
    const identity = {
      volumeId,
      serialNumber: "SERIAL",
      label: "Archive",
      fileSystem: "NTFS",
      rootPath: driveRoot,
      letter: null,
    };
    let handler: DbWorkerHandler | null = createDbWorkerHandler({ appDbPath });
    let reopened: DbWorkerHandler | null = null;
    try {
      handler.handle("app.registerDrive", {
        identity,
        lastSeenAt: now,
        catalogSchema: CATALOG_SCHEMA_VERSION,
      });
      handler.handle("catalog.create", {
        catalogPath,
        cachePath,
        identity,
        catalogSchema: CATALOG_SCHEMA_VERSION,
      });
      handler.handle("scan.start", {
        volumeId,
        rootPath: driveRoot,
        cachePath,
        intensity: "eco",
        now,
      });
      handler.handle("scan.beginStage", {
        volumeId,
        stage: "catalog",
        total: null,
        now,
      });
      handler.dispose();
      handler = null;

      reopened = createDbWorkerHandler({ appDbPath });
      reopened.handle("catalog.open", { catalogPath, identity });
      const state = reopened.handle("scan.getState", { volumeId }) as ScanState;
      expect(state.status).toBe("interrupted");
      expect(state.stages[0]?.state).toBe("paused");
    } finally {
      reopened?.dispose();
      handler?.dispose();
      await rm(root, { recursive: true, force: true });
    }
  });
});
