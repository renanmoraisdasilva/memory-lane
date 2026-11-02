import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { METADATA_EXTRACTOR_VERSION } from "@shared/domain/metadata";
import { QUICK_HASH_ALGORITHM } from "@shared/domain/hashing";
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

    expect(countPendingMetadata(db, volumeId)).toBe(2);
    const version = db
      .prepare("SELECT value FROM file_metadata WHERE file_id = ? AND key = 'scan.metadataVersion'")
      .get(first);
    expect(version).toEqual({ value: String(METADATA_EXTRACTOR_VERSION) });
    const dates = db
      .prepare("SELECT COUNT(*) AS count FROM file_dates WHERE resolved_date IS NOT NULL")
      .get() as { count: number };
    expect(dates.count).toBe(1);
    const extracted = db
      .prepare("SELECT extracted_date, extracted_source FROM file_dates WHERE file_id = ?")
      .get(first);
    expect(extracted).toEqual({ extracted_date: now, extracted_source: "filesystem.created" });

    resetFailedStage(db, "metadata");
    expect(countPendingMetadata(db, volumeId)).toBe(2);
    db.close();
  });

  it("marks files extracted with an older metadata version as pending", () => {
    const db = createDb();
    const file = insertFile(db, { path: "C:\\archive\\a.jpg", mediaClass: "image" });

    saveMetadataBatch(
      db,
      volumeId,
      [
        {
          fileId: file,
          status: "ok",
          entries: [],
          date: null,
          width: null,
          height: null,
          durationSeconds: null,
        },
      ],
      now,
    );
    expect(countPendingMetadata(db, volumeId)).toBe(0);

    db.prepare(
      "UPDATE file_metadata SET value = '0' WHERE file_id = ? AND key = 'scan.metadataVersion'",
    ).run(file);
    expect(countPendingMetadata(db, volumeId)).toBe(1);
    expect(listPendingMetadata(db, volumeId, 10).map((item) => item.id)).toEqual([file]);
    db.close();
  });

  it("saves video frame rate alongside dimensions and duration", () => {
    const db = createDb();
    const video = insertFile(db, { path: "C:\\archive\\clip.mp4", mediaClass: "video" });

    saveMetadataBatch(
      db,
      volumeId,
      [
        {
          fileId: video,
          status: "ok",
          entries: [{ key: "media.frameRate", value: "29.97", source: "exiftool" }],
          date: null,
          width: 1920,
          height: 1080,
          durationSeconds: 75,
          frameRate: 29.97,
        },
      ],
      now,
    );

    expect(
      db
        .prepare("SELECT width, height, duration_seconds, frame_rate FROM files WHERE id = ?")
        .get(video),
    ).toEqual({ width: 1920, height: 1080, duration_seconds: 75, frame_rate: 29.97 });
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
        {
          fileId: first,
          kind: "full",
          sha256: "a".repeat(64),
          size: 10,
          modifiedAtFs: now,
          status: "complete",
        },
        { fileId: second, sha256: "", status: "failed" },
      ],
      now,
    );
    expect(
      db
        .prepare(
          "SELECT source_size_at_hash, source_modified_at_fs_at_hash FROM hashes WHERE file_id = ?",
        )
        .get(first),
    ).toEqual({ source_size_at_hash: 10, source_modified_at_fs_at_hash: now });

    expect(countPendingHashes(db, volumeId)).toBe(1);
    resetFailedStage(db, "hashes");
    expect(countPendingHashes(db, volumeId)).toBe(2);
    expect(third).toBeGreaterThan(0);
    db.close();
  });

  it("keeps full hashes, skips unique quick hashes, and rechecks quick hashes with size peers", () => {
    const db = createDb();
    const full = insertFile(db, { path: "C:\\archive\\full.jpg", size: 50 });
    const quickUnique = insertFile(db, { path: "C:\\archive\\unique.mp4", size: 100 });
    const unhashed = insertFile(db, { path: "C:\\archive\\new.mp4", size: 200 });
    const quickPeerA = insertFile(db, { path: "C:\\archive\\peer-a.mp4", size: 300 });
    const quickPeerB = insertFile(db, { path: "C:\\archive\\peer-b.mp4", size: 300 });

    saveHashBatch(
      db,
      volumeId,
      [
        {
          fileId: full,
          kind: "full",
          sha256: "a".repeat(64),
          size: 50,
          modifiedAtFs: now,
          status: "complete",
        },
        {
          fileId: quickUnique,
          kind: "quick",
          algorithm: QUICK_HASH_ALGORITHM,
          digest: "b".repeat(64),
          sampleBytes: 16,
          fileSize: 100,
          modifiedAtFs: now,
          status: "complete",
        },
        {
          fileId: quickPeerA,
          kind: "quick",
          algorithm: QUICK_HASH_ALGORITHM,
          digest: "c".repeat(64),
          sampleBytes: 16,
          fileSize: 300,
          modifiedAtFs: now,
          status: "complete",
        },
        {
          fileId: quickPeerB,
          kind: "quick",
          algorithm: QUICK_HASH_ALGORITHM,
          digest: "c".repeat(64),
          sampleBytes: 16,
          fileSize: 300,
          modifiedAtFs: now,
          status: "complete",
        },
      ],
      now,
    );

    expect(countPendingHashes(db, volumeId)).toBe(3);
    expect(listPendingHashes(db, volumeId, 10)).toMatchObject([
      { id: unhashed, size: 200, hasSizePeer: false },
      { id: quickPeerA, size: 300, hasSizePeer: true },
      { id: quickPeerB, size: 300, hasSizePeer: true },
    ]);
    expect(db.prepare("SELECT COUNT(*) AS count FROM quick_hashes").get()).toEqual({ count: 3 });

    saveHashBatch(
      db,
      volumeId,
      [
        {
          fileId: quickPeerA,
          kind: "full",
          sha256: "d".repeat(64),
          size: 300,
          modifiedAtFs: now,
          status: "complete",
        },
      ],
      now,
    );
    expect(countPendingHashes(db, volumeId)).toBe(2);
    expect(
      db.prepare("SELECT COUNT(*) AS count FROM quick_hashes WHERE file_id = ?").get(quickPeerA),
    ).toEqual({ count: 0 });

    saveHashBatch(
      db,
      volumeId,
      [
        {
          fileId: unhashed,
          kind: "quick",
          algorithm: QUICK_HASH_ALGORITHM,
          digest: "e".repeat(64),
          sampleBytes: 16,
          fileSize: 200,
          modifiedAtFs: now,
          status: "complete",
        },
      ],
      now,
    );
    expect(countPendingHashes(db, volumeId)).toBe(1);
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
