import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { runMigrations } from "../migrations/runner";
import { catalogMigrations } from "../migrations/catalog-migrations";
import { ensureDriveIdentity, getCatalogSummary, readDriveIdentity } from "./catalog-repository";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  runMigrations(db, catalogMigrations);
  return db;
}

const identity = {
  volumeId: toVolumeId("volume-1"),
  serialNumber: "SERIAL-1",
  label: "Archive",
  fileSystem: "NTFS",
  rootPath: "E:\\",
  letter: "E:",
};

describe("catalog repository", () => {
  it("[ML-REPL-001] [ML-REPL-003] creates and reads the drive identity", () => {
    const db = createDb();
    const created = ensureDriveIdentity(db, identity, 1);

    expect(created.volumeId).toBe(identity.volumeId);
    expect(readDriveIdentity(db).label).toBe("Archive");
    expect(getCatalogSummary(db, "E:\\catalog.db").fileCount).toBe(0);
    db.close();
  });

  it("rejects a catalog from a different volume", () => {
    const db = createDb();
    ensureDriveIdentity(db, identity, 1);

    try {
      ensureDriveIdentity(db, { ...identity, volumeId: toVolumeId("volume-2") }, 1);
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(APP_ERROR_CODES.CATALOG_MISMATCH);
    }
    db.close();
  });

  it("counts cataloged files in the summary", () => {
    const db = createDb();
    ensureDriveIdentity(db, identity, 1);
    db.prepare(`INSERT INTO files (path, name, size, last_seen_at) VALUES (?, ?, ?, ?)`).run(
      "E:\\photo.jpg",
      "photo.jpg",
      1024,
      "2026-01-01T00:00:00.000Z",
    );

    expect(getCatalogSummary(db, "E:\\catalog.db").fileCount).toBe(1);
    db.close();
  });

  it("throws when the identity is missing", () => {
    const db = createDb();
    expect(() => readDriveIdentity(db)).toThrow(AppError);
    db.close();
  });

  it("throws when the identity row is malformed", () => {
    const db = createDb();
    db.prepare(
      `INSERT INTO drive_identity (id, volume_id, volume_serial, label, file_system, catalog_schema, created_at)
       VALUES (1, '', 'SERIAL', 'Archive', 'NTFS', 1, '2026-01-01T00:00:00.000Z')`,
    ).run();

    expect(() => readDriveIdentity(db)).toThrow(AppError);
    db.close();
  });
});
