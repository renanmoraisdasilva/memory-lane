import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { appMigrations } from "./migrations/app-migrations";
import { catalogMigrations } from "./migrations/catalog-migrations";
import { runMigrations } from "./migrations/runner";
import { ensureDriveIdentity } from "./repositories/catalog-repository";
import { createSettingsDbHandlers } from "./settings-db-handlers";

const volumeId = toVolumeId("volume-1");
const now = "2026-10-31T12:00:00.000Z";
const later = "2026-10-31T13:00:00.000Z";

interface Harness {
  root: string;
  appDb: Database.Database;
  catalog: Database.Database;
  handler: ReturnType<typeof createSettingsDbHandlers>;
}

async function createHarness(): Promise<Harness> {
  const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-settings-"));
  const appDb = new Database(path.join(root, "app.db"));
  runMigrations(appDb, appMigrations);
  appDb
    .prepare(
      `INSERT INTO registered_drives (
        volume_id, volume_serial, label, file_system, root_path, last_seen_at, catalog_schema
      ) VALUES (?, 'SERIAL', 'Archive', 'NTFS', 'C:\\', ?, 5)`,
    )
    .run(volumeId, now);

  const catalog = new Database(path.join(root, "catalog.db"));
  runMigrations(catalog, catalogMigrations);
  ensureDriveIdentity(
    catalog,
    {
      volumeId,
      serialNumber: "SERIAL",
      label: "Archive",
      fileSystem: "NTFS",
      rootPath: "C:\\",
      letter: "C:",
    },
    5,
  );
  const file = catalog
    .prepare(
      `INSERT INTO files (
        path, name, extension, size, modified_at_fs, media_class, format, state, last_seen_at
      ) VALUES ('C:\\archive\\a.jpg', 'a.jpg', 'jpg', 100, ?, 'image', 'JPEG', 'present', ?)
      RETURNING id`,
    )
    .get(now, now) as { id: number };
  catalog
    .prepare(
      `INSERT INTO cache_entries (file_id, kind, path, bytes, generated_at, status)
       VALUES (?, 'thumbnail', 'C:\\archive\\cache\\a.jpg', 10, ?, 'ready')`,
    )
    .run(file.id, now);

  return {
    root,
    appDb,
    catalog,
    handler: createSettingsDbHandlers({ getAppDb: () => appDb, getCatalog: () => catalog }),
  };
}

function closeHarness(harness: Harness): void {
  harness.catalog.close();
  harness.appDb.close();
}

describe("settings DB handlers", () => {
  it("[ML-SET-001] reads backup state and cache stats", async () => {
    const harness = await createHarness();
    const backupPath = path.join(harness.root, "backups", volumeId, "catalog.db");
    try {
      expect(harness.handler.handle("settings.getBackupState", {})).toEqual({
        lastBackupAt: null,
        lastStatus: null,
        lastPath: null,
        lastBytes: null,
      });
      expect(harness.handler.handle("settings.getCacheStats", {})).toEqual({
        bytes: 10,
        files: 1,
      });

      harness.appDb
        .prepare(
          `INSERT INTO backup_history (drive_volume_id, path, bytes, created_at, status)
           VALUES (?, ?, 4096, ?, 'success')`,
        )
        .run(volumeId, backupPath, now);
      harness.appDb
        .prepare("UPDATE registered_drives SET last_backup_at = ? WHERE volume_id = ?")
        .run(now, volumeId);

      expect(harness.handler.handle("settings.getBackupState", {})).toEqual({
        lastBackupAt: now,
        lastStatus: "success",
        lastPath: backupPath,
        lastBytes: 4096,
      });
    } finally {
      closeHarness(harness);
      await rm(harness.root, { recursive: true, force: true });
    }
  });

  it("[ML-SET-009] records successful and failed backups", async () => {
    const harness = await createHarness();
    const backupPath = path.join(harness.root, "backups", volumeId, "catalog.db");
    try {
      expect(
        harness.handler.handle("settings.recordBackup", {
          volumeId,
          path: backupPath,
          bytes: 4096,
          now,
          status: "success",
        }),
      ).toEqual({ saved: true });
      expect(harness.handler.handle("settings.getBackupState", {})).toEqual({
        lastBackupAt: now,
        lastStatus: "success",
        lastPath: backupPath,
        lastBytes: 4096,
      });

      expect(
        harness.handler.handle("settings.recordBackup", {
          volumeId,
          path: path.join(harness.root, "backups", volumeId),
          bytes: 0,
          now: later,
          status: "failed",
        }),
      ).toEqual({ saved: true });
      expect(harness.handler.handle("settings.getBackupState", {})).toEqual({
        lastBackupAt: now,
        lastStatus: "failed",
        lastPath: path.join(harness.root, "backups", volumeId),
        lastBytes: 0,
      });
      expect(harness.appDb.prepare("SELECT COUNT(*) AS count FROM backup_history").get()).toEqual({
        count: 2,
      });
    } finally {
      closeHarness(harness);
      await rm(harness.root, { recursive: true, force: true });
    }
  });

  it("[ML-SET-002] clears generated cache rows", async () => {
    const harness = await createHarness();
    try {
      expect(harness.handler.handle("settings.clearCache", {})).toEqual({ removed: 1 });
      expect(harness.handler.handle("settings.getCacheStats", {})).toEqual({
        bytes: 0,
        files: 0,
      });
      expect(harness.catalog.prepare("SELECT COUNT(*) AS count FROM cache_entries").get()).toEqual({
        count: 0,
      });
    } finally {
      closeHarness(harness);
      await rm(harness.root, { recursive: true, force: true });
    }
  });
});
