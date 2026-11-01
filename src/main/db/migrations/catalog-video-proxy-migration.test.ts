import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { ensureDriveIdentity } from "../repositories/catalog-repository";
import { catalogMigrations } from "./catalog-migrations";
import { runMigrations } from "./runner";

const volumeId = toVolumeId("volume-1");
const now = "2026-11-01T12:00:00.000Z";

function createSchemaEightDb(): Database.Database {
  const db = new Database(":memory:");
  runMigrations(db, catalogMigrations.slice(0, 8));
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
    8,
  );
  return db;
}

function insertFile(db: Database.Database): number {
  const row = db
    .prepare(
      `INSERT INTO files (path, name, size, modified_at_fs, state, last_seen_at)
       VALUES ('E:\\clips\\a.wmv', 'a.wmv', 10, ?, 'present', ?)
       RETURNING id`,
    )
    .get(now, now) as { id: number };
  return row.id;
}

describe("catalog video proxy migration", () => {
  it("preserves existing cache entries and adds proxy columns", () => {
    const db = createSchemaEightDb();
    const fileId = insertFile(db);
    db.prepare(
      `INSERT INTO cache_entries (file_id, kind, path, bytes, generated_at, status)
       VALUES (?, 'thumbnail', 'thumbs/a.jpg', 12, ?, 'ready')`,
    ).run(fileId, now);

    const result = runMigrations(db, catalogMigrations);
    expect(result.version).toBe(9);
    expect(
      db.prepare("SELECT path, bytes, status FROM cache_entries WHERE file_id = ?").get(fileId),
    ).toEqual({ path: "thumbs/a.jpg", bytes: 12, status: "ready" });

    db.prepare(
      `INSERT INTO cache_entries (
         file_id, kind, path, bytes, source_size, source_modified_at_fs,
         generated_at, status, error_message
       ) VALUES (?, 'proxy', 'proxies/a.mp4', 20, 10, ?, ?, 'ready', NULL)`,
    ).run(fileId, now, now);
    expect(
      db
        .prepare(
          "SELECT kind, source_size, source_modified_at_fs FROM cache_entries WHERE path = 'proxies/a.mp4'",
        )
        .get(),
    ).toEqual({ kind: "proxy", source_size: 10, source_modified_at_fs: now });

    db.prepare("DELETE FROM files WHERE id = ?").run(fileId);
    expect(db.prepare("SELECT COUNT(*) AS count FROM cache_entries").get()).toEqual({ count: 0 });
    db.close();
  });
});
