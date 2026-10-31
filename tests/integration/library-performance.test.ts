import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { catalogMigrations } from "../../src/main/db/migrations/catalog-migrations";
import { runMigrations } from "../../src/main/db/migrations/runner";
import { ensureDriveIdentity } from "../../src/main/db/repositories/catalog-repository";
import {
  getLibrarySummary,
  getLibraryTimeline,
  getLibraryTimelineIndex,
} from "../../src/main/db/repositories/library-repository";

const ITEM_COUNT = 10_000;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function createLargeCatalog(): Database.Database {
  const db = new Database(":memory:");
  runMigrations(db, catalogMigrations);
  ensureDriveIdentity(
    db,
    {
      volumeId: toVolumeId("volume-large"),
      serialNumber: "SERIAL",
      label: "Large archive",
      fileSystem: "NTFS",
      rootPath: "C:\\",
      letter: "C:",
    },
    3,
  );

  const insertFile = db.prepare(
    `INSERT INTO files (
      path, name, size, modified_at_fs, media_class, format, state, last_seen_at
    ) VALUES (?, ?, 100, '2024-01-01T00:00:00.000Z', ?, 'JPG', 'present', '2024-01-01T00:00:00.000Z')`,
  );
  const insertDate = db.prepare(
    `INSERT INTO file_dates (file_id, resolved_date, precision, source, confidence, original_value)
     VALUES (?, ?, 'exact', 'filesystem.created', 0.6, ?)`,
  );

  const seed = db.transaction(() => {
    for (let index = 0; index < ITEM_COUNT; index += 1) {
      const year = 2015 + (Math.floor(index / 12) % 10);
      const month = 1 + (index % 12);
      const day = 1 + (index % 28);
      const date = `${year}-${pad(month)}-${pad(day)}T12:00:00.000Z`;
      const result = insertFile.run(
        `C:\\archive\\image-${index}.jpg`,
        `image-${index}.jpg`,
        "image",
      );
      insertDate.run(Number(result.lastInsertRowid), date, date);
    }
  });
  seed();
  return db;
}

describe("library query performance", () => {
  it("pages and groups a 10k catalog without loading it all", () => {
    const db = createLargeCatalog();

    const started = Date.now();
    const page = getLibraryTimeline(db, {
      filter: "all",
      cursor: null,
      year: null,
      month: null,
      limit: 200,
    });
    const summary = getLibrarySummary(db);
    const index = getLibraryTimelineIndex(db, "all");
    const elapsed = Date.now() - started;

    expect(page.items).toHaveLength(200);
    expect(page.total).toBe(ITEM_COUNT);
    expect(page.nextCursor).not.toBeNull();
    expect(summary.totalItems).toBe(ITEM_COUNT);
    expect(index.months.length).toBeGreaterThan(100);
    expect(elapsed).toBeLessThan(3_000);
    db.close();
  });
});
