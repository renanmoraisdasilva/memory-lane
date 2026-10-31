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
import { getOtherFiles } from "../../src/main/db/repositories/other-files-repository";

const ITEM_COUNT = process.env.MEMORY_LANE_PERF_200K === "1" ? 200_000 : 100_000;
const OTHER_EVERY = 5;
const OTHER_COUNT = Math.ceil(ITEM_COUNT / OTHER_EVERY);
const MEDIA_COUNT = ITEM_COUNT - OTHER_COUNT;
const QUERY_BUDGET_MS = 5_000;

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
      path, name, extension, size, modified_at_fs, media_class, format, state, last_seen_at
    ) VALUES (?, ?, ?, 100, '2024-01-01T00:00:00.000Z', ?, ?, 'present',
      '2024-01-01T00:00:00.000Z')`,
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
      const other = index % OTHER_EVERY === 0;
      const extension = other ? "txt" : "jpg";
      const result = insertFile.run(
        `C:\\archive\\file-${index}.${extension}`,
        `file-${index}.${extension}`,
        extension,
        other ? "other" : "image",
        other ? "TXT" : "JPG",
      );
      insertDate.run(Number(result.lastInsertRowid), date, date);
    }
  });
  seed();
  return db;
}

describe("large catalog performance", () => {
  it(`pages, groups, and categorizes a ${ITEM_COUNT.toLocaleString("en-US")} file catalog`, () => {
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
    const otherFiles = getOtherFiles(db, "all", 0, 50);
    const documents = getOtherFiles(db, "documents", 0, 50);
    const elapsed = Date.now() - started;

    expect(page.items).toHaveLength(200);
    expect(page.total).toBe(MEDIA_COUNT);
    expect(page.nextCursor).not.toBeNull();
    expect(summary.totalItems).toBe(MEDIA_COUNT);
    expect(index.months.length).toBeGreaterThan(80);
    expect(otherFiles.total).toBe(OTHER_COUNT);
    expect(otherFiles.counts.all).toBe(OTHER_COUNT);
    expect(documents.total).toBe(OTHER_COUNT);
    expect(documents.items).toHaveLength(50);
    expect(elapsed).toBeLessThan(QUERY_BUDGET_MS);
    db.close();
  }, 60_000);
});
