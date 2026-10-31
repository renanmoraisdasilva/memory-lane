import type Database from "better-sqlite3";
import { z } from "zod";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type {
  HashSaveItem,
  MetadataSaveItem,
  PendingHashFile,
  PendingMetadataFile,
  PendingThumbnailFile,
  ThumbnailSaveItem,
} from "../../modules/scanning/domain/scan-files";
import { readDriveIdentity } from "./catalog-repository";

const MediaClassSchema = z.enum(["image", "video", "other"]);

const PendingMetadataRowSchema = z.object({
  id: z.number().int().positive(),
  path: z.string(),
  media_class: MediaClassSchema,
  format: z.string().nullable(),
  size: z.number().int().nonnegative(),
  created_at_fs: z.string().nullable(),
  modified_at_fs: z.string(),
});

const PendingThumbnailRowSchema = z.object({
  id: z.number().int().positive(),
  path: z.string(),
  media_class: MediaClassSchema,
});

const PendingHashRowSchema = z.object({
  id: z.number().int().positive(),
  path: z.string(),
  size: z.number().int().nonnegative(),
});

function assertVolume(db: Database.Database, volumeId: string): void {
  const identity = readDriveIdentity(db);
  if (identity.volumeId !== volumeId) {
    throw new AppError(APP_ERROR_CODES.CATALOG_MISMATCH, "Scan request targets another catalog");
  }
}

function countRows(db: Database.Database, sql: string): number {
  const row = db.prepare(sql).get() as { count: number } | undefined;
  return row?.count ?? 0;
}

export function countPendingMetadata(db: Database.Database, volumeId: string): number {
  assertVolume(db, volumeId);
  return countRows(
    db,
    `SELECT COUNT(*) AS count FROM files f
     WHERE f.state = 'present'
       AND NOT EXISTS (
         SELECT 1 FROM file_metadata m WHERE m.file_id = f.id AND m.key = 'scan.metadata'
       )`,
  );
}

export function listPendingMetadata(
  db: Database.Database,
  volumeId: string,
  limit: number,
): PendingMetadataFile[] {
  assertVolume(db, volumeId);
  const rows = db
    .prepare(
      `SELECT f.id, f.path, f.media_class, f.format, f.size, f.created_at_fs, f.modified_at_fs
       FROM files f
       WHERE f.state = 'present'
         AND NOT EXISTS (
           SELECT 1 FROM file_metadata m WHERE m.file_id = f.id AND m.key = 'scan.metadata'
         )
       ORDER BY f.id
       LIMIT ?`,
    )
    .all(limit);

  return rows.map((row) => {
    const parsed = PendingMetadataRowSchema.safeParse(row);
    if (!parsed.success) {
      throw new AppError(APP_ERROR_CODES.DB_ERROR, "Invalid pending metadata row", {
        issues: parsed.error.issues,
      });
    }
    return {
      id: parsed.data.id,
      path: parsed.data.path,
      mediaClass: parsed.data.media_class,
      format: parsed.data.format,
      size: parsed.data.size,
      createdAtFs: parsed.data.created_at_fs,
      modifiedAtFs: parsed.data.modified_at_fs,
    };
  });
}

export function saveMetadataBatch(
  db: Database.Database,
  volumeId: string,
  items: MetadataSaveItem[],
  now: string,
): void {
  assertVolume(db, volumeId);
  const clear = db.prepare("DELETE FROM file_metadata WHERE file_id = ?");
  const insert = db.prepare(
    `INSERT OR REPLACE INTO file_metadata (file_id, key, value, source, extracted_at)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const saveDate = db.prepare(
    `INSERT INTO file_dates (
       file_id, resolved_date, precision, source, confidence, original_value, is_override
     ) VALUES (?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(file_id) DO UPDATE SET
       resolved_date = excluded.resolved_date,
       precision = excluded.precision,
       source = excluded.source,
       confidence = excluded.confidence,
       original_value = excluded.original_value
     WHERE file_dates.is_override = 0`,
  );
  const saveMediaFacts = db.prepare(
    "UPDATE files SET width = ?, height = ?, duration_seconds = ? WHERE id = ?",
  );

  const save = db.transaction(() => {
    for (const item of items) {
      clear.run(item.fileId);
      for (const entry of item.entries) {
        insert.run(item.fileId, entry.key, entry.value, entry.source, now);
      }
      insert.run(item.fileId, "scan.metadata", item.status, "scan", now);
      saveMediaFacts.run(item.width, item.height, item.durationSeconds, item.fileId);
      if (item.date !== null) {
        saveDate.run(
          item.fileId,
          item.date.resolvedDate,
          item.date.precision,
          item.date.source,
          item.date.confidence,
          item.date.originalValue,
        );
      }
    }
  });

  save();
}

export function resetFailedMetadata(db: Database.Database): void {
  db.prepare("DELETE FROM file_metadata WHERE key = 'scan.metadata' AND value = 'failed'").run();
}

export function countPendingThumbnails(db: Database.Database, volumeId: string): number {
  assertVolume(db, volumeId);
  return countRows(
    db,
    `SELECT COUNT(*) AS count FROM files f
     WHERE f.media_class IN ('image', 'video')
       AND f.state = 'present'
       AND NOT EXISTS (
         SELECT 1 FROM cache_entries c WHERE c.file_id = f.id AND c.kind = 'thumbnail'
       )`,
  );
}

export function listPendingThumbnails(
  db: Database.Database,
  volumeId: string,
  limit: number,
): PendingThumbnailFile[] {
  assertVolume(db, volumeId);
  const rows = db
    .prepare(
      `SELECT f.id, f.path, f.media_class
       FROM files f
       WHERE f.media_class IN ('image', 'video')
         AND f.state = 'present'
         AND NOT EXISTS (
           SELECT 1 FROM cache_entries c WHERE c.file_id = f.id AND c.kind = 'thumbnail'
         )
       ORDER BY f.id
       LIMIT ?`,
    )
    .all(limit);

  return rows.map((row) => {
    const parsed = PendingThumbnailRowSchema.safeParse(row);
    if (!parsed.success) {
      throw new AppError(APP_ERROR_CODES.DB_ERROR, "Invalid pending thumbnail row", {
        issues: parsed.error.issues,
      });
    }
    return {
      id: parsed.data.id,
      path: parsed.data.path,
      mediaClass: parsed.data.media_class,
    };
  });
}

export function saveThumbnailBatch(
  db: Database.Database,
  volumeId: string,
  items: ThumbnailSaveItem[],
  now: string,
): void {
  assertVolume(db, volumeId);
  const upsert = db.prepare(
    `INSERT INTO cache_entries (file_id, kind, path, bytes, generated_at, status)
     VALUES (?, 'thumbnail', ?, ?, ?, ?)
     ON CONFLICT(file_id, kind) DO UPDATE SET
       path = excluded.path,
       bytes = excluded.bytes,
       generated_at = excluded.generated_at,
       status = excluded.status`,
  );
  const save = db.transaction(() => {
    for (const item of items) {
      upsert.run(item.fileId, item.path, item.bytes, now, item.status);
    }
  });
  save();
}

export function resetFailedThumbnails(db: Database.Database): void {
  db.prepare("DELETE FROM cache_entries WHERE kind = 'thumbnail' AND status = 'failed'").run();
}

export function countPendingHashes(db: Database.Database, volumeId: string): number {
  assertVolume(db, volumeId);
  return countRows(
    db,
    `SELECT COUNT(*) AS count FROM files f
     WHERE f.state = 'present'
       AND NOT EXISTS (
         SELECT 1 FROM hashes h
         WHERE h.file_id = f.id AND h.status IN ('complete', 'failed')
       )`,
  );
}

export function listPendingHashes(
  db: Database.Database,
  volumeId: string,
  limit: number,
): PendingHashFile[] {
  assertVolume(db, volumeId);
  const rows = db
    .prepare(
      `SELECT f.id, f.path, f.size
       FROM files f
       WHERE f.state = 'present'
         AND NOT EXISTS (
           SELECT 1 FROM hashes h
           WHERE h.file_id = f.id AND h.status IN ('complete', 'failed')
         )
       ORDER BY f.id
       LIMIT ?`,
    )
    .all(limit);

  return rows.map((row) => {
    const parsed = PendingHashRowSchema.safeParse(row);
    if (!parsed.success) {
      throw new AppError(APP_ERROR_CODES.DB_ERROR, "Invalid pending hash row", {
        issues: parsed.error.issues,
      });
    }
    return { id: parsed.data.id, path: parsed.data.path, size: parsed.data.size };
  });
}

export function saveHashBatch(
  db: Database.Database,
  volumeId: string,
  items: HashSaveItem[],
  now: string,
): void {
  assertVolume(db, volumeId);
  const upsert = db.prepare(
    `INSERT INTO hashes (file_id, sha256, hashed_at, status)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(file_id) DO UPDATE SET
       sha256 = excluded.sha256,
       hashed_at = excluded.hashed_at,
       status = excluded.status`,
  );
  const save = db.transaction(() => {
    for (const item of items) {
      upsert.run(item.fileId, item.sha256, now, item.status);
    }
  });
  save();
}

export function resetFailedHashes(db: Database.Database): void {
  db.prepare("DELETE FROM hashes WHERE status = 'failed'").run();
}

export function resetFailedStage(
  db: Database.Database,
  stage: "catalog" | "metadata" | "thumbnails" | "hashes",
): void {
  switch (stage) {
    case "metadata":
      resetFailedMetadata(db);
      return;
    case "thumbnails":
      resetFailedThumbnails(db);
      return;
    case "hashes":
      resetFailedHashes(db);
      return;
    case "catalog":
      return;
  }
}
