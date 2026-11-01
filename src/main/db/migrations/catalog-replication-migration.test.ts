import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { ensureDriveIdentity } from "../repositories/catalog-repository";
import { catalogMigrations } from "./catalog-migrations";
import { runMigrations } from "./runner";

const volumeId = toVolumeId("volume-1");
const now = "2026-11-01T12:00:00.000Z";

function createSchemaSixDb(): Database.Database {
  const db = new Database(":memory:");
  runMigrations(db, catalogMigrations.slice(0, 6));
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
    6,
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
  db.prepare(
    `INSERT INTO hashes (file_id, sha256, hashed_at, status)
     VALUES (?, 'abc', ?, 'complete')`,
  ).run(row.id, now);
  return row.id;
}

function insertDestination(db: Database.Database): number {
  const row = db
    .prepare(
      `INSERT INTO replica_destinations (
        destination_id, volume_id, label, replica_goal, reserve_bytes, priority, created_at, updated_at
      ) VALUES ('dest-1', 'volume-2', 'Backup A', 'extend_coverage', 1024, 1, ?, ?)
      RETURNING id`,
    )
    .get(now, now) as { id: number };
  return row.id;
}

describe("catalog replication migration", () => {
  it("backfills archive identity and source membership from schema 6", () => {
    const db = createSchemaSixDb();
    const fileId = insertFile(db);

    const result = runMigrations(db, catalogMigrations);
    expect(result.version).toBe(7);

    const identity = db.prepare("SELECT * FROM archive_identity WHERE id = 1").get() as {
      catalog_id: string;
      role: string;
      source_root_relative: string;
      active_source_volume_id: string;
      schema_version: number;
    };
    expect(identity.catalog_id).toHaveLength(32);
    expect(identity.role).toBe("source");
    expect(identity.source_root_relative).toBe("");
    expect(identity.active_source_volume_id).toBe(volumeId);
    expect(identity.schema_version).toBe(7);

    const file = db
      .prepare("SELECT source_membership, relative_path FROM files WHERE id = ?")
      .get(fileId) as { source_membership: string; relative_path: string | null };
    expect(file).toEqual({ source_membership: "source", relative_path: null });

    const hash = db
      .prepare(
        "SELECT source_size_at_hash, source_modified_at_fs_at_hash FROM hashes WHERE file_id = ?",
      )
      .get(fileId) as {
      source_size_at_hash: number | null;
      source_modified_at_fs_at_hash: string | null;
    };
    expect(hash).toEqual({ source_size_at_hash: null, source_modified_at_fs_at_hash: null });

    const tables = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name IN (
           'replica_destinations','replica_files','replica_orphans','replication_adoptions',
           'replication_runs','replication_run_events','source_promotions'
         )
         ORDER BY name`,
      )
      .all() as Array<{ name: string }>;
    expect(tables.map((row) => row.name)).toEqual([
      "replica_destinations",
      "replica_files",
      "replica_orphans",
      "replication_adoptions",
      "replication_run_events",
      "replication_runs",
      "source_promotions",
    ]);

    db.close();
  });

  it("enforces one active run and allows terminal runs", () => {
    const db = createSchemaSixDb();
    runMigrations(db, catalogMigrations);

    const insertRun = db.prepare(
      `INSERT INTO replication_runs (status, goal) VALUES (?, 'extend_coverage')`,
    );
    insertRun.run("running");

    expect(() => insertRun.run("paused")).toThrow();
    expect(() => insertRun.run("stopping")).toThrow();

    db.prepare("UPDATE replication_runs SET status = 'completed' WHERE status = 'running'").run();
    expect(() => insertRun.run("running")).not.toThrow();
    expect(() => insertRun.run("stopped")).not.toThrow();
    expect(() => insertRun.run("interrupted")).not.toThrow();

    db.close();
  });

  it("requires a hash for verified replicas and a unique destination id", () => {
    const db = createSchemaSixDb();
    const fileId = insertFile(db);
    runMigrations(db, catalogMigrations);
    const destinationId = insertDestination(db);

    expect(() =>
      db
        .prepare(
          `INSERT INTO replica_files (
            replica_id, file_id, relative_path, relative_path_key,
            source_relative_path, source_relative_path_key, size_bytes, status
          ) VALUES (?, ?, 'a.jpg', 'a.jpg', 'photos/a.jpg', 'photos/a.jpg', 10, 'verified')`,
        )
        .run(destinationId, fileId),
    ).toThrow();

    expect(() =>
      db
        .prepare(
          `INSERT INTO replica_files (
            replica_id, file_id, relative_path, relative_path_key,
            source_relative_path, source_relative_path_key, size_bytes, sha256, status
          ) VALUES (?, ?, 'a.jpg', 'a.jpg', 'photos/a.jpg', 'photos/a.jpg', 10, 'abc', 'verified')`,
        )
        .run(destinationId, fileId),
    ).not.toThrow();

    expect(() =>
      db
        .prepare(
          `INSERT INTO replica_destinations (
            destination_id, volume_id, label, replica_goal, reserve_bytes, priority, created_at, updated_at
          ) VALUES ('dest-1', 'volume-3', 'Other', 'extend_coverage', 1024, 2, ?, ?)`,
        )
        .run(now, now),
    ).toThrow();

    db.close();
  });
});
