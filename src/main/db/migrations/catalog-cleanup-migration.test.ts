import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { ensureDriveIdentity } from "../repositories/catalog-repository";
import { CATALOG_SCHEMA_VERSION } from "../schema-version";
import { catalogMigrations } from "./catalog-migrations";
import { runMigrations } from "./runner";

const volumeId = toVolumeId("volume-1");
const now = "2026-11-02T12:00:00.000Z";

function createSchemaTenDb(): Database.Database {
  const db = new Database(":memory:");
  runMigrations(db, catalogMigrations.slice(0, 10));
  ensureDriveIdentity(
    db,
    {
      volumeId,
      serialNumber: "SERIAL",
      label: "Archive",
      fileSystem: "NTFS",
      rootPath: "E:\\",
      letter: "E:",
    },
    10,
  );
  return db;
}

function insertFile(db: Database.Database): number {
  const row = db
    .prepare(
      `INSERT INTO files (path, name, size, modified_at_fs, state, last_seen_at)
       VALUES ('E:\\photos\\a.jpg', 'a.jpg', 10, ?, 'present', ?)
       RETURNING id`,
    )
    .get(now, now) as { id: number };
  return row.id;
}

describe("catalog cleanup migration", () => {
  it("adds hard-link counts and keeps existing files copy-safe", () => {
    const db = createSchemaTenDb();
    const fileId = insertFile(db);

    const result = runMigrations(db, catalogMigrations);
    expect(result.version).toBe(CATALOG_SCHEMA_VERSION);
    expect(db.prepare("SELECT link_count FROM files WHERE id = ?").get(fileId)).toEqual({
      link_count: 1,
    });

    const tables = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name IN ('cleanup_runs', 'cleanup_moves')
         ORDER BY name`,
      )
      .all() as Array<{ name: string }>;
    expect(tables.map((row) => row.name)).toEqual(["cleanup_moves", "cleanup_runs"]);

    const identity = db
      .prepare("SELECT schema_version FROM archive_identity WHERE id = 1")
      .get() as { schema_version: number };
    expect(identity.schema_version).toBe(CATALOG_SCHEMA_VERSION);
    db.close();
  });

  it("stores cleanup run audit rows and cascades only when a run is removed", () => {
    const db = createSchemaTenDb();
    runMigrations(db, catalogMigrations);

    const run = db
      .prepare(
        `INSERT INTO cleanup_runs (
          status, keeper_rule, root_path, quarantine_path, journal_path, started_at
        ) VALUES ('running', 'oldest-created-then-shorter-path', 'E:\\', 'E:\\.memorylane_quarantine\\r1',
          'E:\\.memorylane_quarantine\\r1\\journal.jsonl', ?)
        RETURNING id`,
      )
      .get(now) as { id: number };
    db.prepare(
      `INSERT INTO cleanup_moves (
        run_id, file_id, source_path, quarantine_path, sha256, size_bytes,
        keeper_file_id, keeper_path, moved_at
      ) VALUES (?, 7, 'E:\\photos\\a.jpg', 'E:\\.memorylane_quarantine\\r1\\photos\\a.jpg',
        ?, 10, 8, 'E:\\photos\\a.jpg', ?)`,
    ).run(run.id, "a".repeat(64), now);

    expect(db.prepare("SELECT COUNT(*) AS count FROM cleanup_moves").get()).toEqual({ count: 1 });
    db.prepare("DELETE FROM cleanup_runs WHERE id = ?").run(run.id);
    expect(db.prepare("SELECT COUNT(*) AS count FROM cleanup_moves").get()).toEqual({ count: 0 });
    db.close();
  });
});
