import path from "node:path";
import type Database from "better-sqlite3";
import type { MissingActionResult, MissingFile, MissingFilesPage } from "@shared/contracts/health";
import { MissingFilesPageSchema } from "@shared/contracts/health";

const ACTIVE_MISSING = "mf.dismissed_at IS NULL";

export function getMissingFiles(
  db: Database.Database,
  offset: number,
  limit: number,
  dismissedOnly = false,
): MissingFilesPage {
  const predicate = dismissedOnly ? "mf.dismissed_at IS NOT NULL" : ACTIVE_MISSING;
  const rows = db
    .prepare(
      `SELECT
         f.id,
         f.name,
         f.path,
         f.size,
         f.media_class,
         f.format,
         mf.last_path,
         mf.last_seen_at,
         mf.reason,
         mf.dismissed_at,
         EXISTS(
           SELECT 1 FROM moved_candidates mc
           WHERE mc.file_id = f.id AND mc.state = 'pending'
         ) AS has_moved_candidate
       FROM missing_files mf
       JOIN files f ON f.id = mf.file_id
       WHERE ${predicate}
       ORDER BY f.name COLLATE NOCASE, f.id
       LIMIT ? OFFSET ?`,
    )
    .all(limit, offset) as Array<{
    id: number;
    name: string;
    path: string;
    size: number;
    media_class: "image" | "video" | "other";
    format: string | null;
    last_path: string;
    last_seen_at: string | null;
    reason: string | null;
    dismissed_at: string | null;
    has_moved_candidate: number;
  }>;
  const items: MissingFile[] = rows.map((row) => ({
    fileId: row.id,
    name: row.name,
    path: row.path,
    folder: path.dirname(row.path),
    sizeBytes: row.size,
    mediaClass: row.media_class,
    format: row.format,
    lastPath: row.last_path,
    lastSeenAt: row.last_seen_at,
    reason: row.reason,
    hasMovedCandidate: row.has_moved_candidate === 1,
    dismissedAt: row.dismissed_at,
  }));
  const fileIdRows = db
    .prepare(
      `SELECT mf.file_id AS id
       FROM missing_files mf
       JOIN files f ON f.id = mf.file_id
       WHERE ${predicate}
       ORDER BY f.name COLLATE NOCASE, f.id`,
    )
    .all() as Array<{ id: number }>;
  const dismissedRow = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM missing_files
       WHERE dismissed_at IS NOT NULL`,
    )
    .get() as { count: number };
  return MissingFilesPageSchema.parse({
    items,
    total: fileIdRows.length,
    fileIds: fileIdRows.map((row) => row.id),
    dismissedTotal: dismissedRow.count,
  });
}

export function dismissMissingFiles(
  db: Database.Database,
  fileIds: number[],
  now: string,
): MissingActionResult {
  const uniqueIds = [...new Set(fileIds)];
  const dismissMissing = db.prepare(
    "UPDATE missing_files SET dismissed_at = ? WHERE file_id = ? AND dismissed_at IS NULL",
  );
  const dismissMoves = db.prepare(
    "UPDATE moved_candidates SET state = 'dismissed' WHERE file_id = ? AND state = 'pending'",
  );
  const run = db.transaction(() => {
    let updated = 0;
    for (const id of uniqueIds) {
      const changes = dismissMissing.run(now, id).changes;
      if (changes > 0) {
        dismissMoves.run(id);
        updated += changes;
      }
    }
    return { updated, skipped: uniqueIds.length - updated };
  });
  return run();
}

export function restoreMissingFiles(db: Database.Database, fileIds: number[]): MissingActionResult {
  const uniqueIds = [...new Set(fileIds)];
  const restore = db.prepare(
    "UPDATE missing_files SET dismissed_at = NULL WHERE file_id = ? AND dismissed_at IS NOT NULL",
  );
  const run = db.transaction(() => {
    let updated = 0;
    for (const id of uniqueIds) {
      updated += restore.run(id).changes;
    }
    return { updated, skipped: uniqueIds.length - updated };
  });
  return run();
}
