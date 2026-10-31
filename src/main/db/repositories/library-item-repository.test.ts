import Database from "better-sqlite3";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { catalogMigrations } from "../migrations/catalog-migrations";
import { runMigrations } from "../migrations/runner";
import { ensureDriveIdentity } from "./catalog-repository";
import {
  getLibraryContext,
  getLibraryItem,
  resolveMediaFile,
  resolveThumbnail,
  saveThumbnail,
} from "./library-item-repository";

const volumeId = toVolumeId("volume-1");
const now = "2024-08-18T12:00:00.000Z";
const catalogPath = "C:\\archive\\.memorylane\\catalog.db";

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

function insertMedia(
  db: Database.Database,
  name: string,
  date: string | null,
  state: "present" | "missing" = "present",
): number {
  const row = db
    .prepare(
      `INSERT INTO files (
        path, name, extension, size, modified_at_fs, media_class, format, mime,
        width, height, duration_seconds, state, last_seen_at
      ) VALUES (?, ?, ?, 100, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id`,
    )
    .get(
      `C:\\archive\\${name}`,
      name,
      path.extname(name).slice(1),
      now,
      path.extname(name) === ".mp4" ? "video" : "image",
      path.extname(name) === ".mp4" ? "MP4" : "JPG",
      path.extname(name) === ".mp4" ? "video/mp4" : "image/jpeg",
      path.extname(name) === ".mp4" ? null : 1920,
      path.extname(name) === ".mp4" ? null : 1080,
      path.extname(name) === ".mp4" ? 61.5 : null,
      state,
      now,
    ) as { id: number } | undefined;
  if (row === undefined) {
    throw new Error("Media insert failed");
  }
  if (date !== null) {
    db.prepare(
      `INSERT INTO file_dates (file_id, resolved_date, precision, source, confidence, original_value)
       VALUES (?, ?, 'exact', 'filesystem.created', 0.6, ?)`,
    ).run(row.id, date, date);
  }
  return row.id;
}

function seed(db: Database.Database): { a: number; b: number; c: number; e: number } {
  const a = insertMedia(db, "a.jpg", "2024-08-18T12:00:00.000Z");
  const b = insertMedia(db, "b.mp4", "2024-08-18T10:00:00.000Z");
  const c = insertMedia(db, "c.jpg", "2024-07-01T12:00:00.000Z", "missing");
  const e = insertMedia(db, "e.jpg", null);
  db.prepare(
    `INSERT INTO files (path, name, size, modified_at_fs, media_class, state, last_seen_at)
     VALUES ('C:\\archive\\notes.txt', 'notes.txt', 10, ?, 'other', 'present', ?)`,
  ).run(now, now);
  db.prepare(
    `INSERT INTO file_metadata (file_id, key, value, source, extracted_at)
     VALUES (?, 'media.width', '1920', 'image', ?)`,
  ).run(a, now);
  db.prepare(
    `INSERT INTO cache_entries (file_id, kind, path, bytes, generated_at, status)
     VALUES (?, 'thumbnail', 'C:\\cache\\a.jpg', 10, ?, 'ready')`,
  ).run(a, now);
  return { a, b, c, e };
}

function expectCode(error: unknown, code: string): void {
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe(code);
}

describe("library item repository", () => {
  it("returns detail, metadata, position, and neighbors", () => {
    const db = createDb();
    const ids = seed(db);

    const b = getLibraryItem(db, ids.b, "all");
    expect(b).toMatchObject({
      position: 2,
      total: 4,
      previousFileId: ids.a,
      nextFileId: ids.c,
      mediaUrl: `ml-media://media/${String(ids.b)}`,
    });
    expect(b.item).toMatchObject({ name: "b.mp4", durationSeconds: 61.5 });
    expect(b.folder).toBe("C:\\archive");

    const c = getLibraryItem(db, ids.c, "all");
    expect(c.item.isMissing).toBe(true);
    expect(c.mediaUrl).toBeNull();

    const e = getLibraryItem(db, ids.e, "all");
    expect(e).toMatchObject({ position: 4, previousFileId: ids.c, nextFileId: null });

    const a = getLibraryItem(db, ids.a, "photos");
    expect(a.metadata).toEqual([{ key: "media.width", value: "1920", source: "image" }]);
    expect(a.item.width).toBe(1920);
    db.close();
  });

  it("rejects missing, filtered-out, and non-media items", () => {
    const db = createDb();
    const ids = seed(db);

    try {
      getLibraryItem(db, 9999, "all");
    } catch (error) {
      expectCode(error, APP_ERROR_CODES.LIBRARY_ITEM_NOT_FOUND);
    }
    expect(() => getLibraryItem(db, ids.b, "photos")).toThrow(AppError);
    expect(() => getLibraryItem(db, ids.a, "videos")).toThrow(AppError);
    db.close();
  });

  it("resolves media and thumbnails for the protocol", () => {
    const db = createDb();
    const ids = seed(db);

    expect(resolveMediaFile(db, ids.a)).toMatchObject({
      fileId: ids.a,
      state: "present",
      mediaClass: "image",
    });
    expect(resolveMediaFile(db, 9999)).toBeNull();

    expect(resolveThumbnail(db, ids.a)).toMatchObject({
      status: "ready",
      cachePath: "C:\\cache\\a.jpg",
    });
    expect(resolveThumbnail(db, ids.b)).toMatchObject({ status: "pending", cachePath: null });
    db.close();
  });

  it("saves thumbnail state and exposes catalog context", () => {
    const db = createDb();
    const ids = seed(db);

    saveThumbnail(db, {
      fileId: ids.b,
      path: "C:\\cache\\b.jpg",
      bytes: 20,
      status: "ready",
      now,
    });
    expect(resolveThumbnail(db, ids.b)).toMatchObject({
      status: "ready",
      cachePath: "C:\\cache\\b.jpg",
    });

    expect(getLibraryContext(db, catalogPath)).toMatchObject({
      volumeId,
      driveLabel: "Archive",
      catalogPath,
      cachePath: path.join(path.dirname(catalogPath), "cache"),
    });
    db.close();
  });

  it("rejects malformed rows and malformed thumbnail records", () => {
    const detailDb = createDb();
    const detailIds = seed(detailDb);
    detailDb.prepare("UPDATE files SET modified_at_fs = NULL WHERE id = ?").run(detailIds.b);
    expect(() => getLibraryItem(detailDb, detailIds.b, "all")).toThrow(AppError);
    detailDb.close();

    const metadataDb = createDb();
    const metadataIds = seed(metadataDb);
    metadataDb
      .prepare(
        `INSERT INTO file_metadata (file_id, key, value, source, extracted_at)
         VALUES (?, '', '', 'test', ?)`,
      )
      .run(metadataIds.a, now);
    expect(() => getLibraryItem(metadataDb, metadataIds.a, "all")).toThrow(AppError);
    metadataDb.close();

    const mediaDb = createDb();
    const mediaIds = seed(mediaDb);
    mediaDb.prepare("UPDATE files SET size = 'bad' WHERE id = ?").run(mediaIds.a);
    expect(() => resolveMediaFile(mediaDb, mediaIds.a)).toThrow(AppError);
    mediaDb.close();

    const thumbDb = createDb();
    const thumbIds = seed(thumbDb);
    thumbDb.prepare("UPDATE files SET path = '' WHERE id = ?").run(thumbIds.a);
    expect(resolveThumbnail(thumbDb, thumbIds.a)).toBeNull();
    thumbDb.close();
  });
});
