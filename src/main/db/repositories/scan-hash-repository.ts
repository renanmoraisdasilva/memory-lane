import type Database from "better-sqlite3";
import { z } from "zod";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { QUICK_HASH_ALGORITHM } from "@shared/domain/hashing";
import type { HashSaveItem, PendingHashFile } from "../../modules/scanning/domain/scan-files";
import { readDriveIdentity } from "./catalog-repository";

const PendingHashRowSchema = z.object({
  id: z.number().int().positive(),
  path: z.string(),
  size: z.number().int().nonnegative(),
  modified_at_fs: z.string().nullable(),
  has_size_peer: z.number().int().min(0).max(1),
});

const PENDING_HASH_CTE = `
  WITH candidates AS (
    SELECT
      f.id,
      f.path,
      f.size,
      f.modified_at_fs,
      EXISTS (
        SELECT 1 FROM files o
        WHERE o.id <> f.id
          AND o.size = f.size
          AND (
            o.state = 'present'
            OR EXISTS (
              SELECT 1 FROM hashes oh
              WHERE oh.file_id = o.id AND oh.status = 'complete'
            )
          )
      ) AS has_size_peer,
      EXISTS (
        SELECT 1 FROM quick_hashes qh
        WHERE qh.file_id = f.id
          AND qh.algorithm = ?
          AND qh.file_size = f.size
          AND qh.modified_at_fs IS f.modified_at_fs
      ) AS has_quick
    FROM files f
    WHERE f.state = 'present'
      AND NOT EXISTS (
        SELECT 1 FROM hashes h
        WHERE h.file_id = f.id AND h.status IN ('complete', 'failed')
      )
  )
`;

function assertVolume(db: Database.Database, volumeId: string): void {
  const identity = readDriveIdentity(db);
  if (identity.volumeId !== volumeId) {
    throw new AppError(APP_ERROR_CODES.CATALOG_MISMATCH, "Scan request targets another catalog");
  }
}

export function countPendingHashes(db: Database.Database, volumeId: string): number {
  assertVolume(db, volumeId);
  const row = db
    .prepare(
      `${PENDING_HASH_CTE}
       SELECT COUNT(*) AS count FROM candidates
       WHERE NOT (has_quick = 1 AND has_size_peer = 0)`,
    )
    .get(QUICK_HASH_ALGORITHM) as { count: number } | undefined;
  return row?.count ?? 0;
}

export function listPendingHashes(
  db: Database.Database,
  volumeId: string,
  limit: number,
): PendingHashFile[] {
  assertVolume(db, volumeId);
  const rows = db
    .prepare(
      `${PENDING_HASH_CTE}
       SELECT id, path, size, modified_at_fs, has_size_peer
       FROM candidates
       WHERE NOT (has_quick = 1 AND has_size_peer = 0)
       ORDER BY id
       LIMIT ?`,
    )
    .all(QUICK_HASH_ALGORITHM, limit);

  return rows.map((row) => {
    const parsed = PendingHashRowSchema.safeParse(row);
    if (!parsed.success) {
      throw new AppError(APP_ERROR_CODES.DB_ERROR, "Invalid pending hash row", {
        issues: parsed.error.issues,
      });
    }
    return {
      id: parsed.data.id,
      path: parsed.data.path,
      size: parsed.data.size,
      modifiedAtFs: parsed.data.modified_at_fs,
      hasSizePeer: parsed.data.has_size_peer === 1,
    };
  });
}

export function saveHashBatch(
  db: Database.Database,
  volumeId: string,
  items: HashSaveItem[],
  now: string,
): void {
  assertVolume(db, volumeId);
  const upsertHash = db.prepare(
    `INSERT INTO hashes (file_id, sha256, hashed_at, status)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(file_id) DO UPDATE SET
       sha256 = excluded.sha256,
       hashed_at = excluded.hashed_at,
       status = excluded.status`,
  );
  const upsertQuick = db.prepare(
    `INSERT INTO quick_hashes (
       file_id, algorithm, digest, sample_bytes, file_size, modified_at_fs, computed_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(file_id) DO UPDATE SET
       algorithm = excluded.algorithm,
       digest = excluded.digest,
       sample_bytes = excluded.sample_bytes,
       file_size = excluded.file_size,
       modified_at_fs = excluded.modified_at_fs,
       computed_at = excluded.computed_at`,
  );
  const deleteQuick = db.prepare("DELETE FROM quick_hashes WHERE file_id = ?");
  const save = db.transaction(() => {
    for (const item of items) {
      if (item.status === "complete" && item.kind === "quick") {
        upsertQuick.run(
          item.fileId,
          item.algorithm,
          item.digest,
          item.sampleBytes,
          item.fileSize,
          item.modifiedAtFs,
          now,
        );
        continue;
      }
      upsertHash.run(item.fileId, item.sha256, now, item.status);
      deleteQuick.run(item.fileId);
    }
  });
  save();
}

export function resetFailedHashes(db: Database.Database): void {
  db.prepare("DELETE FROM hashes WHERE status = 'failed'").run();
}
