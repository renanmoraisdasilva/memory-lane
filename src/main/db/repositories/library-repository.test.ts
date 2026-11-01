import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { METADATA_EXTRACTOR_VERSION } from "@shared/domain/metadata";
import { catalogMigrations } from "../migrations/catalog-migrations";
import { runMigrations } from "../migrations/runner";
import { ensureDriveIdentity } from "./catalog-repository";
import {
  getLibrarySummary,
  getLibraryTimeline,
  getLibraryTimelineIndex,
} from "./library-repository";

const volumeId = toVolumeId("volume-1");
const now = "2024-08-18T12:00:00.000Z";

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
    3,
  );
  return db;
}

interface MediaInput {
  path: string;
  name: string;
  mediaClass: "image" | "video";
  size: number;
  state?: "present" | "missing";
  date?: string | null;
  precision?: "year" | "month" | "exact";
  thumbnail?: "pending" | "ready" | "failed";
}

function insertMediaRow(db: Database.Database, input: MediaInput): number {
  const isVideo = input.mediaClass === "video";
  const row = db
    .prepare(
      `INSERT INTO files (
        path, name, size, modified_at_fs, media_class, state, width, height,
        duration_seconds, last_seen_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id`,
    )
    .get(
      input.path,
      input.name,
      input.size,
      now,
      input.mediaClass,
      input.state ?? "present",
      isVideo ? null : 1920,
      isVideo ? null : 1080,
      isVideo ? 61.5 : null,
      now,
    ) as { id: number } | undefined;
  if (row === undefined) {
    throw new Error("Media insert failed");
  }
  return row.id;
}

function insertMediaDate(
  db: Database.Database,
  fileId: number,
  date: string,
  precision: MediaInput["precision"],
): void {
  db.prepare(
    `INSERT INTO file_dates (file_id, resolved_date, precision, source, confidence, original_value)
     VALUES (?, ?, ?, 'filesystem.created', 0.6, ?)`,
  ).run(fileId, date, precision ?? "exact", date);
}

function insertThumbnail(
  db: Database.Database,
  fileId: number,
  status: NonNullable<MediaInput["thumbnail"]>,
): void {
  db.prepare(
    `INSERT INTO cache_entries (file_id, kind, path, bytes, generated_at, status)
     VALUES (?, 'thumbnail', ?, 10, ?, ?)`,
  ).run(fileId, status === "failed" ? "" : `C:\\cache\\${fileId}.jpg`, now, status);
}

function insertMedia(db: Database.Database, input: MediaInput): number {
  const fileId = insertMediaRow(db, input);
  if (input.date !== null && input.date !== undefined) {
    insertMediaDate(db, fileId, input.date, input.precision);
  }
  if (input.thumbnail !== undefined) {
    insertThumbnail(db, fileId, input.thumbnail);
  }
  return fileId;
}

function seed(db: Database.Database): void {
  insertMedia(db, {
    path: "C:\\archive\\a.jpg",
    name: "a.jpg",
    mediaClass: "image",
    size: 100,
    date: "2024-08-18T12:00:00.000Z",
    thumbnail: "ready",
  });
  insertMedia(db, {
    path: "C:\\archive\\b.mp4",
    name: "b.mp4",
    mediaClass: "video",
    size: 200,
    date: "2024-08-18T10:00:00.000Z",
    thumbnail: "pending",
  });
  insertMedia(db, {
    path: "C:\\archive\\c.jpg",
    name: "c.jpg",
    mediaClass: "image",
    size: 300,
    state: "missing",
    date: "2024-07-04T12:00:00.000Z",
    thumbnail: "failed",
  });
  insertMedia(db, {
    path: "C:\\archive\\d.mp4",
    name: "d.mp4",
    mediaClass: "video",
    size: 400,
    date: "2023-01-01T12:00:00.000Z",
  });
  insertMedia(db, {
    path: "C:\\archive\\e.jpg",
    name: "e.jpg",
    mediaClass: "image",
    size: 500,
    date: null,
  });
  db.prepare(
    `INSERT INTO files (path, name, size, modified_at_fs, media_class, state, last_seen_at)
     VALUES ('C:\\archive\\notes.txt', 'notes.txt', 10, ?, 'other', 'present', ?)`,
  ).run(now, now);
  db.prepare(
    `INSERT INTO scan_sessions (started_at, finished_at, state, mode, intensity)
     VALUES (?, ?, 'complete', 'initial', 'balanced')`,
  ).run("2024-08-18T11:00:00.000Z", "2024-08-18T12:30:00.000Z");
}

describe("library repository", () => {
  it("summarizes media, bytes, undated items, and the last scan", () => {
    const db = createDb();
    seed(db);

    expect(getLibrarySummary(db)).toEqual({
      totalItems: 5,
      photoCount: 3,
      videoCount: 2,
      indexedBytes: 1_200,
      undatedCount: 1,
      lastScanAt: "2024-08-18T12:30:00.000Z",
      metadataRefreshCount: 0,
    });
    db.close();
  });

  it("returns an empty summary for an unscanned catalog", () => {
    const db = createDb();
    expect(getLibrarySummary(db)).toEqual({
      totalItems: 0,
      photoCount: 0,
      videoCount: 0,
      indexedBytes: 0,
      undatedCount: 0,
      lastScanAt: null,
      metadataRefreshCount: 0,
    });
    db.close();
  });

  it("counts files extracted with an older metadata version", () => {
    const db = createDb();
    seed(db);
    const row = db.prepare("SELECT id FROM files WHERE name = 'a.jpg'").get() as { id: number };
    const upsert = db.prepare(
      `INSERT OR REPLACE INTO file_metadata (file_id, key, value, source, extracted_at)
       VALUES (?, ?, ?, 'scan', ?)`,
    );
    upsert.run(row.id, "scan.metadata", "ok", now);
    upsert.run(row.id, "scan.metadataVersion", "0", now);
    expect(getLibrarySummary(db).metadataRefreshCount).toBe(1);

    db.prepare(
      "UPDATE file_metadata SET value = ? WHERE file_id = ? AND key = 'scan.metadataVersion'",
    ).run(String(METADATA_EXTRACTOR_VERSION), row.id);
    expect(getLibrarySummary(db).metadataRefreshCount).toBe(0);
    db.close();
  });

  it("pages the timeline in descending date and id order", () => {
    const db = createDb();
    seed(db);

    const first = getLibraryTimeline(db, {
      filter: "all",
      cursor: null,
      year: null,
      month: null,
      limit: 2,
    });
    expect(first.items.map((item) => item.fileId)).toHaveLength(2);
    expect(first.items[0]?.date.value).toBe("2024-08-18T12:00:00.000Z");
    expect(first.items[1]?.date.value).toBe("2024-08-18T10:00:00.000Z");
    expect(first.total).toBe(5);
    expect(first.nextCursor).not.toBeNull();

    const second = getLibraryTimeline(db, {
      filter: "all",
      cursor: first.nextCursor,
      year: null,
      month: null,
      limit: 10,
    });
    expect(second.items.map((item) => item.name)).toEqual(["c.jpg", "d.mp4", "e.jpg"]);
    expect(second.nextCursor).toBeNull();
    db.close();
  });

  it("filters photos and videos and includes missing items", () => {
    const db = createDb();
    seed(db);

    const photos = getLibraryTimeline(db, {
      filter: "photos",
      cursor: null,
      year: null,
      month: null,
      limit: 10,
    });
    expect(photos.items.map((item) => item.name)).toEqual(["a.jpg", "c.jpg", "e.jpg"]);
    expect(photos.items.find((item) => item.name === "c.jpg")?.isMissing).toBe(true);

    const videos = getLibraryTimeline(db, {
      filter: "videos",
      cursor: null,
      year: null,
      month: null,
      limit: 10,
    });
    expect(videos.items.map((item) => item.name)).toEqual(["b.mp4", "d.mp4"]);
    db.close();
  });

  it("anchors a timeline at a year or month", () => {
    const db = createDb();
    seed(db);

    const july = getLibraryTimeline(db, {
      filter: "all",
      cursor: null,
      year: 2024,
      month: 7,
      limit: 10,
    });
    expect(july.items.map((item) => item.name)).toEqual(["c.jpg", "d.mp4", "e.jpg"]);

    const year2024 = getLibraryTimeline(db, {
      filter: "all",
      cursor: null,
      year: 2024,
      month: null,
      limit: 10,
    });
    expect(year2024.items.map((item) => item.name)).toEqual([
      "a.jpg",
      "b.mp4",
      "c.jpg",
      "d.mp4",
      "e.jpg",
    ]);
    db.close();
  });

  it("maps thumbnail and media URLs honestly", () => {
    const db = createDb();
    seed(db);
    db.prepare("UPDATE files SET width = 0, height = 0 WHERE name = 'a.jpg'").run();

    const page = getLibraryTimeline(db, {
      filter: "all",
      cursor: null,
      year: null,
      month: null,
      limit: 10,
    });
    const ready = page.items.find((item) => item.name === "a.jpg");
    const failed = page.items.find((item) => item.name === "c.jpg");
    const missing = page.items.find((item) => item.name === "c.jpg");

    expect(ready?.thumbnailStatus).toBe("ready");
    expect(ready?.thumbnailUrl).toBe(`ml-media://thumbnail/${String(ready?.fileId)}`);
    expect(ready?.width).toBeNull();
    expect(ready?.height).toBeNull();
    expect(failed?.thumbnailStatus).toBe("failed");
    expect(failed?.thumbnailUrl).toBeNull();
    expect(missing?.isMissing).toBe(true);
    db.close();
  });

  it("builds a month index and rejects invalid cursors", () => {
    const db = createDb();
    seed(db);

    expect(getLibraryTimelineIndex(db, "all").months).toEqual([
      { year: 2024, month: 8, count: 2 },
      { year: 2024, month: 7, count: 1 },
      { year: 2023, month: 1, count: 1 },
    ]);

    expect(() =>
      getLibraryTimeline(db, {
        filter: "all",
        cursor: "not-a-cursor",
        year: null,
        month: null,
        limit: 10,
      }),
    ).toThrow();
    db.close();
  });
});
