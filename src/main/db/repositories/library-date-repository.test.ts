import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { catalogMigrations } from "../migrations/catalog-migrations";
import { runMigrations } from "../migrations/runner";
import { ensureDriveIdentity } from "./catalog-repository";
import { getUndatedItems, setDateOverride, clearDateOverride } from "./library-date-repository";
import { saveMetadataBatch } from "./scan-stage-repository";

const volumeId = toVolumeId("volume-1");
const now = "2026-10-31T12:00:00.000Z";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  runMigrations(db, catalogMigrations);
  ensureDriveIdentity(
    db,
    {
      volumeId,
      serialNumber: "SERIAL",
      label: "Archive",
      fileSystem: "NTFS",
      rootPath: "C:\\",
      letter: "C:",
    },
    4,
  );
  return db;
}

function insertFile(db: Database.Database, name: string, date: string | null): number {
  const row = db
    .prepare(
      `INSERT INTO files (
        path, name, size, modified_at_fs, media_class, format, state, last_seen_at
      ) VALUES (?, ?, 100, ?, 'image', 'JPG', 'present', ?)
      RETURNING id`,
    )
    .get(`C:\\archive\\${name}`, name, now, now) as { id: number };
  if (date !== null) {
    db.prepare(
      `INSERT INTO file_dates (
         file_id, resolved_date, precision, source, confidence, original_value,
         extracted_date, extracted_precision, extracted_source, extracted_confidence,
         extracted_original_value
       ) VALUES (?, ?, 'exact', 'exif.datetimeOriginal', 0.95, ?, ?, 'exact', 'exif.datetimeOriginal', 0.95, ?)`,
    ).run(row.id, date, date, date, date);
  }
  return row.id;
}

describe("library date repository", () => {
  it("sets and clears a manual override while preserving the extracted date", () => {
    const db = createDb();
    const fileId = insertFile(db, "a.jpg", "2011-07-04T15:30:00");

    expect(setDateOverride(db, { fileIds: [fileId], year: 2014, month: 8, now })).toEqual({
      updated: 1,
    });
    expect(
      db
        .prepare(
          "SELECT resolved_date, precision, source, is_override FROM file_dates WHERE file_id = ?",
        )
        .get(fileId),
    ).toEqual({
      resolved_date: "2014-08-01T00:00:00",
      precision: "month",
      source: "manual",
      is_override: 1,
    });

    expect(clearDateOverride(db, [fileId], now)).toEqual({ updated: 1 });
    expect(
      db
        .prepare(
          "SELECT resolved_date, precision, source, is_override, extracted_date FROM file_dates WHERE file_id = ?",
        )
        .get(fileId),
    ).toEqual({
      resolved_date: "2011-07-04T15:30:00",
      precision: "exact",
      source: "exif.datetimeOriginal",
      is_override: 0,
      extracted_date: "2011-07-04T15:30:00",
    });
    db.close();
  });

  it("keeps a manual override when metadata is rescanned", () => {
    const db = createDb();
    const fileId = insertFile(db, "a.jpg", "2011-07-04T15:30:00");
    setDateOverride(db, { fileIds: [fileId], year: 2014, month: null, now });

    saveMetadataBatch(
      db,
      volumeId,
      [
        {
          fileId,
          status: "ok",
          entries: [],
          date: {
            resolvedDate: "2012-01-01T00:00:00",
            precision: "exact",
            source: "exif.createDate",
            confidence: 0.9,
            originalValue: "2012:01:01 00:00:00",
          },
          width: null,
          height: null,
          durationSeconds: null,
        },
      ],
      now,
    );

    expect(
      db
        .prepare(
          "SELECT resolved_date, source, extracted_date, extracted_source FROM file_dates WHERE file_id = ?",
        )
        .get(fileId),
    ).toEqual({
      resolved_date: "2014-01-01T00:00:00",
      source: "manual",
      extracted_date: "2012-01-01T00:00:00",
      extracted_source: "exif.createDate",
    });
    db.close();
  });

  it("pages undated media and counts the full set", () => {
    const db = createDb();
    const first = insertFile(db, "a.jpg", null);
    const second = insertFile(db, "b.jpg", null);
    insertFile(db, "c.jpg", "2011-07-04T15:30:00");

    const page = getUndatedItems(db, null, 1);
    expect(page.total).toBe(2);
    expect(page.items.map((item) => item.fileId)).toEqual([first]);
    expect(page.nextCursor).not.toBeNull();

    const next = getUndatedItems(db, page.nextCursor, 10);
    expect(next.items.map((item) => item.fileId)).toEqual([second]);
    expect(next.nextCursor).toBeNull();
    db.close();
  });
});
