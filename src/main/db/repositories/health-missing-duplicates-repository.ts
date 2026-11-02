import path from "node:path";
import type Database from "better-sqlite3";
import type {
  MissingDuplicate,
  MissingDuplicatesPage,
  PurgeMissingDuplicatesResult,
} from "@shared/contracts/health";
import {
  MissingDuplicatesPageSchema,
  PurgeMissingDuplicatesResultSchema,
} from "@shared/contracts/health";
import { refreshAdoptionCounters } from "./replication-adoption-repository";

// Materialized CTEs plus the hash index hint keep this query from scanning the
// whole present-file table. The grouped pending aggregate avoids a per-file
// moved-candidate scan on large catalogs.
const MISSING_DUPLICATE_SQL = `
WITH trusted_missing AS MATERIALIZED (
  SELECT f.id, f.name, f.path, f.size, mf.last_seen_at, h.sha256
  FROM files f
  JOIN missing_files mf ON mf.file_id = f.id
  JOIN hashes h ON h.file_id = f.id
  WHERE f.state = 'missing'
    AND h.status = 'complete'
    AND h.sha256 IS NOT NULL
    AND (
      (h.source_size_at_hash = f.size AND h.source_modified_at_fs_at_hash IS f.modified_at_fs)
      OR (
        h.source_size_at_hash IS NULL
        AND h.source_modified_at_fs_at_hash IS NULL
        AND f.modified_at_fs IS NOT NULL
        AND h.hashed_at IS NOT NULL
        AND julianday(f.modified_at_fs) <= julianday(h.hashed_at)
      )
    )
),
present_duplicates AS MATERIALIZED (
  SELECT tm.id AS missing_id, MIN(p.id) AS duplicate_id
  FROM trusted_missing tm
  CROSS JOIN hashes ph INDEXED BY idx_hashes_sha256
    ON ph.sha256 = tm.sha256 AND ph.status = 'complete'
  CROSS JOIN files p
    ON p.id = ph.file_id AND p.state = 'present' AND p.size = tm.size AND p.id <> tm.id
  WHERE (
    (ph.source_size_at_hash = p.size AND ph.source_modified_at_fs_at_hash IS p.modified_at_fs)
    OR (
      ph.source_size_at_hash IS NULL
      AND ph.source_modified_at_fs_at_hash IS NULL
      AND p.modified_at_fs IS NOT NULL
      AND ph.hashed_at IS NOT NULL
      AND julianday(p.modified_at_fs) <= julianday(ph.hashed_at)
    )
  )
  GROUP BY tm.id
),
pending AS (
  SELECT file_id, COUNT(*) AS pending_moves
  FROM moved_candidates
  WHERE state = 'pending'
  GROUP BY file_id
)
SELECT
  tm.id AS file_id,
  tm.name,
  tm.path,
  tm.size,
  tm.last_seen_at,
  p.id AS duplicate_file_id,
  p.name AS duplicate_name,
  p.path AS duplicate_path,
  COALESCE(pending.pending_moves, 0) AS pending_moves,
  EXISTS(
    SELECT 1 FROM replica_files rf
    WHERE rf.file_id = tm.id AND rf.status = 'verified'
  ) AS has_verified_replicas,
  EXISTS(
    SELECT 1 FROM date_overrides o
    WHERE o.file_id = tm.id AND o.reverted_at IS NULL
  ) AS has_date_override
FROM present_duplicates pd
JOIN trusted_missing tm ON tm.id = pd.missing_id
JOIN files p ON p.id = pd.duplicate_id
LEFT JOIN pending ON pending.file_id = pd.missing_id
`;

interface MissingDuplicateRow {
  file_id: number;
  name: string;
  path: string;
  size: number;
  last_seen_at: string | null;
  duplicate_file_id: number;
  duplicate_name: string;
  duplicate_path: string;
  pending_moves: number;
  has_verified_replicas: number;
  has_date_override: number;
}

function toMissingDuplicate(row: MissingDuplicateRow): MissingDuplicate {
  return {
    fileId: row.file_id,
    name: row.name,
    path: row.path,
    folder: path.dirname(row.path),
    sizeBytes: row.size,
    lastSeenAt: row.last_seen_at,
    duplicateFileId: row.duplicate_file_id,
    duplicateName: row.duplicate_name,
    duplicatePath: row.duplicate_path,
    duplicateFolder: path.dirname(row.duplicate_path),
    pendingMovedCandidates: row.pending_moves,
    hasVerifiedReplicas: row.has_verified_replicas === 1,
    hasDateOverride: row.has_date_override === 1,
  };
}

export function getMissingDuplicates(
  db: Database.Database,
  offset: number,
  limit: number,
): MissingDuplicatesPage {
  const rows = db
    .prepare(`${MISSING_DUPLICATE_SQL} ORDER BY tm.name COLLATE NOCASE, tm.id`)
    .all() as MissingDuplicateRow[];
  const pendingRows = rows.filter((row) => row.pending_moves > 0);
  return MissingDuplicatesPageSchema.parse({
    items: rows.slice(offset, offset + limit).map(toMissingDuplicate),
    total: rows.length,
    candidateFileIds: rows.map((row) => row.file_id),
    readyFileIds: rows.filter((row) => row.pending_moves === 0).map((row) => row.file_id),
    withPendingMoves: pendingRows.length,
    pendingMovedCandidates: pendingRows.reduce((sum, row) => sum + row.pending_moves, 0),
    withVerifiedReplicas: rows.filter((row) => row.has_verified_replicas === 1).length,
    withDateOverride: rows.filter((row) => row.has_date_override === 1).length,
  });
}

export function purgeMissingDuplicates(
  db: Database.Database,
  fileIds: number[],
  includePendingMoves = false,
): PurgeMissingDuplicatesResult {
  const uniqueIds = [...new Set(fileIds)];
  if (uniqueIds.length === 0) {
    return { removed: 0, skipped: 0, dismissedMovedCandidates: 0 };
  }
  db.exec("CREATE TEMP TABLE IF NOT EXISTS purge_missing_ids (id INTEGER PRIMARY KEY)");
  try {
    const remove = db.prepare("DELETE FROM files WHERE id = ? AND state = 'missing'");
    const run = db.transaction(() => {
      db.prepare("DELETE FROM purge_missing_ids").run();
      const insert = db.prepare("INSERT OR IGNORE INTO purge_missing_ids (id) VALUES (?)");
      for (const id of uniqueIds) {
        insert.run(id);
      }
      const affectedDestinations = db
        .prepare(
          `SELECT DISTINCT rf.replica_id AS replica_id
           FROM replica_files rf
           WHERE rf.file_id IN (SELECT id FROM purge_missing_ids)`,
        )
        .all() as Array<{ replica_id: number }>;
      const candidates = db
        .prepare(
          `SELECT file_id, pending_moves FROM (${MISSING_DUPLICATE_SQL})
           WHERE file_id IN (SELECT id FROM purge_missing_ids)
             AND (? = 1 OR pending_moves = 0)`,
        )
        .all(includePendingMoves ? 1 : 0) as Array<{
        file_id: number;
        pending_moves: number;
      }>;
      let removed = 0;
      let dismissedMovedCandidates = 0;
      for (const candidate of candidates) {
        const changes = remove.run(candidate.file_id).changes;
        removed += changes;
        if (changes > 0) {
          dismissedMovedCandidates += candidate.pending_moves;
        }
      }
      for (const destination of affectedDestinations) {
        refreshAdoptionCounters(db, destination.replica_id);
      }
      return {
        removed,
        skipped: uniqueIds.length - removed,
        dismissedMovedCandidates,
      };
    });
    return PurgeMissingDuplicatesResultSchema.parse(run());
  } finally {
    db.exec("DROP TABLE IF EXISTS purge_missing_ids");
  }
}
