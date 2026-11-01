import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { QUICK_HASH_ALGORITHM } from "@shared/domain/hashing";
import { ensureDriveIdentity } from "../repositories/catalog-repository";
import { CATALOG_SCHEMA_VERSION } from "../schema-version";
import { catalogMigrations } from "./catalog-migrations";
import { runMigrations } from "./runner";

const volumeId = toVolumeId("volume-1");
const now = "2026-11-01T12:00:00.000Z";

function createSchemaSevenDb(): Database.Database {
  const db = new Database(":memory:");
  runMigrations(db, catalogMigrations.slice(0, 7));
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
    7,
  );
  return db;
}

function insertFile(db: Database.Database, name: string): number {
  const row = db
    .prepare(
      `INSERT INTO files (path, name, size, modified_at_fs, state, last_seen_at)
       VALUES (?, ?, 10, ?, 'present', ?)
       RETURNING id`,
    )
    .get(`E:\\photos\\${name}`, name, now, now) as { id: number };
  return row.id;
}

function insertQuick(db: Database.Database, fileId: number): void {
  db.prepare(
    `INSERT INTO quick_hashes (
       file_id, algorithm, digest, sample_bytes, file_size, modified_at_fs, computed_at
     ) VALUES (?, ?, ?, 1024, 10, ?, ?)`,
  ).run(fileId, QUICK_HASH_ALGORITHM, "q".repeat(64), now, now);
}

describe("catalog quick hash migration", () => {
  it("adds quick hashes without touching existing full hashes", () => {
    const db = createSchemaSevenDb();
    const fileId = insertFile(db, "a.jpg");
    db.prepare(
      `INSERT INTO hashes (file_id, sha256, hashed_at, status)
       VALUES (?, ?, ?, 'complete')`,
    ).run(fileId, "a".repeat(64), now);

    const result = runMigrations(db, catalogMigrations);
    expect(result.version).toBe(CATALOG_SCHEMA_VERSION);
    expect(db.prepare("SELECT sha256 FROM hashes WHERE file_id = ?").get(fileId)).toEqual({
      sha256: "a".repeat(64),
    });
    expect(
      db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'quick_hashes'")
        .get(),
    ).toEqual({ name: "quick_hashes" });
    db.close();
  });

  it("clears quick hashes when a full hash is saved and cascades file deletes", () => {
    const db = createSchemaSevenDb();
    runMigrations(db, catalogMigrations);
    const fileId = insertFile(db, "b.jpg");

    insertQuick(db, fileId);
    expect(
      db.prepare("SELECT COUNT(*) AS count FROM quick_hashes WHERE file_id = ?").get(fileId),
    ).toEqual({ count: 1 });

    db.prepare(
      `INSERT INTO hashes (file_id, sha256, hashed_at, status)
       VALUES (?, ?, ?, 'complete')
       ON CONFLICT(file_id) DO UPDATE SET
         sha256 = excluded.sha256,
         hashed_at = excluded.hashed_at,
         status = excluded.status`,
    ).run(fileId, "b".repeat(64), now);
    expect(
      db.prepare("SELECT COUNT(*) AS count FROM quick_hashes WHERE file_id = ?").get(fileId),
    ).toEqual({ count: 0 });

    insertQuick(db, fileId);
    db.prepare("DELETE FROM files WHERE id = ?").run(fileId);
    expect(
      db.prepare("SELECT COUNT(*) AS count FROM quick_hashes WHERE file_id = ?").get(fileId),
    ).toEqual({ count: 0 });
    db.close();
  });
});
