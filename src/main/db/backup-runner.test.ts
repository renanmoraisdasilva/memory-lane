import { access, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { appMigrations } from "./migrations/app-migrations";
import { catalogMigrations } from "./migrations/catalog-migrations";
import { runMigrations } from "./migrations/runner";
import { ensureDriveIdentity } from "./repositories/catalog-repository";
import { runDatabaseBackup } from "./backup-runner";
import { CATALOG_SCHEMA_VERSION } from "./schema-version";

const volumeId = toVolumeId("volume-1");
const now = "2026-10-31T12:00:00.000Z";
const roots: string[] = [];

interface Harness {
  root: string;
  appDbPath: string;
  catalogPath: string;
  appDb: Database.Database;
  catalog: Database.Database;
}

async function createHarness(): Promise<Harness> {
  const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-backup-"));
  roots.push(root);
  const appDbPath = path.join(root, "app.db");
  const catalogPath = path.join(root, "catalog.db");

  const appDb = new Database(appDbPath);
  runMigrations(appDb, appMigrations);
  appDb
    .prepare(
      `INSERT INTO registered_drives (
        volume_id, volume_serial, label, file_system, root_path, last_seen_at, catalog_schema
      ) VALUES (?, 'SERIAL', 'Archive', 'NTFS', 'C:\\', ?, ?)`,
    )
    .run(volumeId, now, CATALOG_SCHEMA_VERSION);

  const catalog = new Database(catalogPath);
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
    CATALOG_SCHEMA_VERSION,
  );
  catalog
    .prepare(
      `INSERT INTO files (
        path, name, extension, size, modified_at_fs, media_class, format, state, last_seen_at
      ) VALUES ('C:\\archive\\a.jpg', 'a.jpg', 'jpg', 100, ?, 'image', 'JPEG', 'present', ?)`,
    )
    .run(now, now);

  return { root, appDbPath, catalogPath, appDb, catalog };
}

function closeHarness(harness: Harness): void {
  harness.catalog.close();
  harness.appDb.close();
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("database backup runner", () => {
  it("backs up both databases, records the result, and replaces the previous copy", async () => {
    const harness = await createHarness();
    const backupDir = path.join(harness.root, "backups", volumeId);
    try {
      const first = await runDatabaseBackup({
        appDbPath: harness.appDbPath,
        catalogPath: harness.catalogPath,
        backupDir,
        now,
      });
      expect(first).toMatchObject({
        path: path.join(backupDir, "catalog.db"),
        createdAt: now,
        status: "success",
      });
      expect(first.bytes).toBeGreaterThan(0);
      await expect(access(path.join(backupDir, "catalog.db"))).resolves.toBeUndefined();
      await expect(access(path.join(backupDir, "app.db"))).resolves.toBeUndefined();

      const second = await runDatabaseBackup({
        appDbPath: harness.appDbPath,
        catalogPath: harness.catalogPath,
        backupDir,
        now,
      });
      expect(second.status).toBe("success");
      expect((await stat(path.join(backupDir, "catalog.db"))).size).toBeGreaterThan(0);
      expect(harness.appDb.prepare("SELECT COUNT(*) AS count FROM backup_history").get()).toEqual({
        count: 0,
      });
      await expect(access(path.join(backupDir, "catalog.db.tmp"))).rejects.toThrow();
      await expect(access(path.join(backupDir, "app.db.tmp"))).rejects.toThrow();
    } finally {
      closeHarness(harness);
    }
  });

  it("rejects a failed backup and removes partial temporary files", async () => {
    const harness = await createHarness();
    const blocker = path.join(harness.root, "blocker");
    await writeFile(blocker, "not a directory");
    try {
      await expect(
        runDatabaseBackup({
          appDbPath: harness.appDbPath,
          catalogPath: harness.catalogPath,
          backupDir: path.join(blocker, "nested"),
          now,
        }),
      ).rejects.toThrow("Database backup failed");

      expect(harness.appDb.prepare("SELECT COUNT(*) AS count FROM backup_history").get()).toEqual({
        count: 0,
      });
    } finally {
      closeHarness(harness);
    }
  });
});
