import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { catalogMigrations } from "../migrations/catalog-migrations";
import { runMigrations } from "../migrations/runner";
import { ensureDriveIdentity } from "./catalog-repository";
import { createScanSession } from "./scan-session-repository";
import {
  countPendingHashes,
  countPendingMetadata,
  countPendingThumbnails,
  listPendingHashes,
  listPendingMetadata,
  listPendingThumbnails,
  resetFailedStage,
  saveHashBatch,
  saveMetadataBatch,
  saveThumbnailBatch,
} from "./scan-stage-repository";

const volumeId = toVolumeId("volume-1");
const now = "2026-01-01T10:00:00.000Z";

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
    2,
  );
  createScanSession(db, { volumeId, rootPath: "C:\\archive", intensity: "balanced", now });
  return db;
}

interface FileInput {
  path: string;
  mediaClass?: string;
  size?: number | string;
}

function insertFile(db: Database.Database, input: FileInput): number {
  const row = db
    .prepare(
      `INSERT INTO files (
        path, name, size, modified_at_fs, media_class, state, last_seen_at
      ) VALUES (?, ?, ?, ?, ?, 'present', ?)
      RETURNING id`,
    )
    .get(input.path, "file", input.size ?? 10, now, input.mediaClass ?? "other", now) as
    { id: number } | undefined;
  if (row === undefined) {
    throw new Error("File insert failed");
  }
  return row.id;
}

function expectCode(error: unknown, code: string): void {
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe(code);
}

describe("scan stage repository", () => {
  it("lists and saves metadata, then retries failed entries on a new stage", () => {
    const db = createDb();
    const first = insertFile(db, { path: "C:\\archive\\a.jpg", mediaClass: "image" });
    const second = insertFile(db, { path: "C:\\archive\\b.jpg", mediaClass: "image" });
    insertFile(db, { path: "C:\\archive\\c.txt" });

    expect(countPendingMetadata(db, volumeId)).toBe(3);
    expect(listPendingMetadata(db, volumeId, 2)).toHaveLength(2);

    saveMetadataBatch(
      db,
      volumeId,
      [
        {
          fileId: first,
          status: "ok",
          entries: [{ key: "media.width", value: "100", source: "image" }],
          date: {
            resolvedDate: now,
            precision: "exact",
            source: "filesystem.created",
            confidence: 0.6,
            originalValue: now,
          },
          width: 100,
          height: 50,
          durationSeconds: null,
        },
        {
          fileId: second,
          status: "failed",
          entries: [],
          date: null,
          width: null,
          height: null,
          durationSeconds: null,
        },
      ],
      now,
    );

    expect(countPendingMetadata(db, volumeId)).toBe(1);
    const dates = db.prepare("SELECT COUNT(*) AS count FROM file_dates").get() as { count: number };
    expect(dates.count).toBe(1);

    resetFailedStage(db, "metadata");
    expect(countPendingMetadata(db, volumeId)).toBe(2);
    db.close();
  });

  it("lists and saves thumbnails and retries failed entries", () => {
    const db = createDb();
    const image = insertFile(db, { path: "C:\\archive\\a.jpg", mediaClass: "image" });
    const video = insertFile(db, { path: "C:\\archive\\b.mp4", mediaClass: "video" });
    insertFile(db, { path: "C:\\archive\\c.txt" });

    expect(countPendingThumbnails(db, volumeId)).toBe(2);
    expect(listPendingThumbnails(db, volumeId, 10)).toHaveLength(2);

    saveThumbnailBatch(
      db,
      volumeId,
      [
        { fileId: image, path: "C:\\cache\\a.jpg", bytes: 10, status: "ready" },
        { fileId: video, path: "", bytes: 0, status: "failed" },
      ],
      now,
    );

    expect(countPendingThumbnails(db, volumeId)).toBe(0);
    resetFailedStage(db, "thumbnails");
    expect(countPendingThumbnails(db, volumeId)).toBe(1);
    db.close();
  });

  it("lists and saves hashes and retries failed entries", () => {
    const db = createDb();
    const first = insertFile(db, { path: "C:\\archive\\a.jpg", mediaClass: "image" });
    const second = insertFile(db, { path: "C:\\archive\\b.jpg", mediaClass: "image" });
    const third = insertFile(db, { path: "C:\\archive\\c.jpg", mediaClass: "image" });

    expect(countPendingHashes(db, volumeId)).toBe(3);
    expect(listPendingHashes(db, volumeId, 10)).toHaveLength(3);

    saveHashBatch(
      db,
      volumeId,
      [
        { fileId: first, sha256: "a".repeat(64), status: "complete" },
        { fileId: second, sha256: "", status: "failed" },
      ],
      now,
    );

    expect(countPendingHashes(db, volumeId)).toBe(1);
    resetFailedStage(db, "hashes");
    expect(countPendingHashes(db, volumeId)).toBe(2);
    expect(third).toBeGreaterThan(0);
    db.close();
  });

  it("resets every stage, including the catalog no-op", () => {
    const db = createDb();
    resetFailedStage(db, "catalog");
    resetFailedStage(db, "metadata");
    resetFailedStage(db, "thumbnails");
    resetFailedStage(db, "hashes");
    db.close();
  });

  it("rejects stage queries for another catalog", () => {
    const db = createDb();
    const other = toVolumeId("other");
    try {
      countPendingMetadata(db, other);
    } catch (error) {
      expectCode(error, APP_ERROR_CODES.CATALOG_MISMATCH);
    }
    expect(() => countPendingThumbnails(db, other)).toThrow(AppError);
    expect(() => countPendingHashes(db, other)).toThrow(AppError);
    expect(() => listPendingMetadata(db, other, 10)).toThrow(AppError);
    expect(() => listPendingThumbnails(db, other, 10)).toThrow(AppError);
    expect(() => listPendingHashes(db, other, 10)).toThrow(AppError);
    db.close();
  });

  it("rejects malformed pending rows", () => {
    const db = createDb();
    insertFile(db, { path: "C:\\archive\\weird.bin", mediaClass: "weird" });
    expect(() => listPendingMetadata(db, volumeId, 10)).toThrow(AppError);

    const badHash = createDb();
    insertFile(badHash, { path: "C:\\archive\\bad.bin", size: "not-a-size" });
    expect(() => listPendingHashes(badHash, volumeId, 10)).toThrow(AppError);
    db.close();
    badHash.close();
  });
});
