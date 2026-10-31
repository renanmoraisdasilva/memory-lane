import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { catalogMigrations } from "./catalog-migrations";
import { runMigrations } from "./runner";

describe("catalog library migration", () => {
  it("backfills width and height and adds the timeline index", () => {
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

    const result = runMigrations(db, catalogMigrations);
    expect(result.version).toBe(3);

    const media = db
      .prepare("SELECT width, height, duration_seconds FROM files WHERE id = ?")
      .get(row.id);
    expect(media).toEqual({ width: 1920, height: 1080, duration_seconds: null });

    const indexes = db.prepare("PRAGMA index_list('file_dates')").all() as Array<{ name: string }>;
    expect(indexes.map((index) => index.name)).toContain("idx_file_dates_timeline");
    db.close();
  });
});
