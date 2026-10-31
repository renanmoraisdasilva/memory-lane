import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
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
  it("backs up both databases and records the result", async () => {
    const harness = await createHarness();
    const backupDir = path.join(harness.root, "backups", volumeId);
    try {
      expect(harness.handler.handle("settings.getBackupState", {})).toEqual({
        lastBackupAt: null,
        lastStatus: null,
        lastPath: null,
        lastBytes: null,
      });

      const result = harness.handler.handle("settings.backup", { backupDir, now }) as Promise<{
        path: string;
        bytes: number;
        createdAt: string;
        status: string;
      }>;
      const resolved = await result;
      expect(resolved).toMatchObject({
        path: path.join(backupDir, "catalog.db"),
        createdAt: now,
        status: "success",
      });
      expect(resolved.bytes).toBeGreaterThan(0);
      expect(existsSync(path.join(backupDir, "catalog.db"))).toBe(true);
      expect(existsSync(path.join(backupDir, "app.db"))).toBe(true);
      expect(harness.handler.handle("settings.getBackupState", {})).toMatchObject({
        lastBackupAt: now,
        lastStatus: "success",
        lastPath: path.join(backupDir, "catalog.db"),
      });
      expect(harness.appDb.prepare("SELECT COUNT(*) AS count FROM backup_history").get()).toEqual({
        count: 1,
      });
    } finally {
      closeHarness(harness);
      await rm(harness.root, { recursive: true, force: true });
    }
  });

  it("records a failed backup and clears generated cache rows", async () => {
    const harness = await createHarness();
    const blocker = path.join(harness.root, "blocker");
    await writeFile(blocker, "not a directory");
    try {
      await expect(
        harness.handler.handle("settings.backup", {
          backupDir: path.join(blocker, "nested"),
          now,
        }),
      ).rejects.toThrow("Database backup failed");
      expect(harness.handler.handle("settings.getBackupState", {})).toMatchObject({
        lastStatus: "failed",
      });

      expect(harness.handler.handle("settings.clearCache", {})).toEqual({ removed: 1 });
      expect(harness.catalog.prepare("SELECT COUNT(*) AS count FROM cache_entries").get()).toEqual({
        count: 0,
      });
    } finally {
      closeHarness(harness);
      await rm(harness.root, { recursive: true, force: true });
    }
  });
});
