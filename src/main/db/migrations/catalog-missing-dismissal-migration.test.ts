import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { ensureDriveIdentity } from "../repositories/catalog-repository";
import { CATALOG_SCHEMA_VERSION } from "../schema-version";
import { catalogMigrations } from "./catalog-migrations";
import { runMigrations } from "./runner";

const volumeId = toVolumeId("volume-1");
const now = "2026-11-01T12:00:00.000Z";

function createSchemaNineDb(): Database.Database {
  const db = new Database(":memory:");
  runMigrations(db, catalogMigrations.slice(0, 9));
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
    9,
  );
  return db;
}

function insertMissingFile(db: Database.Database): number {
  const row = db
    .prepare(
      `INSERT INTO files (path, name, size, modified_at_fs, state, last_seen_at)
       VALUES ('E:\\photos\\gone.jpg', 'gone.jpg', 10, ?, 'missing', ?)
       RETURNING id`,
    )
    .get(now, now) as { id: number };
  db.prepare(
    `INSERT INTO missing_files (file_id, last_path, last_seen_at, reason)
     VALUES (?, 'E:\\photos\\gone.jpg', ?, 'scan')`,
  ).run(row.id, now);
  return row.id;
}

describe("catalog missing dismissal migration", () => {
  it("adds dismissal state without changing existing missing rows", () => {
    const db = createSchemaNineDb();
    const fileId = insertMissingFile(db);

    const result = runMigrations(db, catalogMigrations);
    expect(result.version).toBe(CATALOG_SCHEMA_VERSION);
    expect(
      db.prepare("SELECT dismissed_at FROM missing_files WHERE file_id = ?").get(fileId),
    ).toEqual({ dismissed_at: null });

    db.prepare("UPDATE missing_files SET dismissed_at = ? WHERE file_id = ?").run(now, fileId);
    expect(
      db.prepare("SELECT dismissed_at FROM missing_files WHERE file_id = ?").get(fileId),
    ).toEqual({ dismissed_at: now });
    const identity = db
      .prepare("SELECT schema_version FROM archive_identity WHERE id = 1")
      .get() as {
      schema_version: number;
    };
    expect(identity.schema_version).toBe(CATALOG_SCHEMA_VERSION);
    db.close();
  });
});
