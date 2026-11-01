import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { CATALOG_SCHEMA_VERSION } from "../schema-version";
import { catalogMigrations } from "./catalog-migrations";
import { runMigrations } from "./runner";

describe("catalog library migration", () => {
  it("backfills width, height, and frame rate and adds the timeline index", () => {
    const db = new Database(":memory:");
    runMigrations(db, catalogMigrations.slice(0, 2));

    const row = db
      .prepare(
        `INSERT INTO files (
          path, name, size, modified_at_fs, media_class, state, last_seen_at
        ) VALUES ('C:\\a.jpg', 'a.jpg', 10, '2024-01-01T00:00:00.000Z', 'image', 'present', '2024-01-01T00:00:00.000Z')
        RETURNING id`,
      )
      .get() as { id: number };
    db.prepare(
      `INSERT INTO file_metadata (file_id, key, value, source, extracted_at)
       VALUES (?, 'media.width', '1920', 'image', '2024-01-01T00:00:00.000Z')`,
    ).run(row.id);
    db.prepare(
      `INSERT INTO file_metadata (file_id, key, value, source, extracted_at)
       VALUES (?, 'media.height', '1080', 'image', '2024-01-01T00:00:00.000Z')`,
    ).run(row.id);
    db.prepare(
      `INSERT INTO file_metadata (file_id, key, value, source, extracted_at)
       VALUES (?, 'media.frameRate', '29.97', 'exiftool', '2024-01-01T00:00:00.000Z')`,
    ).run(row.id);

    const result = runMigrations(db, catalogMigrations);
    expect(result.version).toBe(CATALOG_SCHEMA_VERSION);

    const media = db
      .prepare("SELECT width, height, duration_seconds, frame_rate FROM files WHERE id = ?")
      .get(row.id);
    expect(media).toEqual({
      width: 1920,
      height: 1080,
      duration_seconds: null,
      frame_rate: 29.97,
    });

    const indexes = db.prepare("PRAGMA index_list('file_dates')").all() as Array<{ name: string }>;
    expect(indexes.map((index) => index.name)).toContain("idx_file_dates_timeline");
    db.close();
  });

  it("adds extracted date fields and backfills existing resolved dates", () => {
    const db = new Database(":memory:");
    runMigrations(db, catalogMigrations.slice(0, 3));
    const row = db
      .prepare(
        `INSERT INTO files (
          path, name, size, modified_at_fs, media_class, state, last_seen_at
        ) VALUES ('C:\\a.jpg', 'a.jpg', 10, '2024-01-01T00:00:00.000Z', 'image', 'present', '2024-01-01T00:00:00.000Z')
        RETURNING id`,
      )
      .get() as { id: number };
    db.prepare(
      `INSERT INTO file_dates (file_id, resolved_date, precision, source, confidence, original_value)
       VALUES (?, '2011-07-04T15:30:00', 'exact', 'exif.datetimeOriginal', 0.95, '2011:07:04 15:30:00')`,
    ).run(row.id);

    expect(runMigrations(db, catalogMigrations).version).toBe(CATALOG_SCHEMA_VERSION);
    expect(
      db
        .prepare(
          `SELECT extracted_date, extracted_precision, extracted_source,
                  extracted_confidence, extracted_original_value
           FROM file_dates WHERE file_id = ?`,
        )
        .get(row.id),
    ).toEqual({
      extracted_date: "2011-07-04T15:30:00",
      extracted_precision: "exact",
      extracted_source: "exif.datetimeOriginal",
      extracted_confidence: 0.95,
      extracted_original_value: "2011:07:04 15:30:00",
    });
    const indexes = db.prepare("PRAGMA index_list('date_overrides')").all() as Array<{
      name: string;
    }>;
    expect(indexes.map((index) => index.name)).toContain("idx_date_overrides_active");
    db.close();
  });
});
