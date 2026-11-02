import path from "node:path";
import type Database from "better-sqlite3";
import type {
  DuplicateGroup,
  DuplicateGroupsPage,
  HealthFile,
  HealthSummary,
  MovedActionResult,
} from "@shared/contracts/health";
import { DuplicateGroupsPageSchema, HealthSummarySchema } from "@shared/contracts/health";
import { AppError } from "@shared/domain/errors";
import { parseLibraryRow, toLibraryItem } from "./library-query";

function parseHealthFile(row: ReturnType<typeof parseLibraryRow>): HealthFile {
  return {
    ...toLibraryItem(row),
    mediaClass: row.media_class,
    path: row.file_path,
    folder: path.dirname(row.file_path),
  };
}

export function rebuildDuplicateGroups(db: Database.Database): void {
  const rebuild = db.transaction(() => {
    db.prepare("DELETE FROM duplicate_members").run();
    db.prepare("DELETE FROM duplicate_groups").run();
    db.prepare(
      `INSERT INTO duplicate_groups (sha256, file_count, total_bytes)
       SELECT h.sha256, COUNT(*), COALESCE(SUM(f.size), 0)
       FROM hashes h
       JOIN files f ON f.id = h.file_id
       WHERE h.status = 'complete' AND f.state = 'present'
       GROUP BY h.sha256
       HAVING COUNT(*) > 1`,
    ).run();
    db.prepare(
      `INSERT INTO duplicate_members (group_id, file_id)
       SELECT g.id, h.file_id
       FROM duplicate_groups g
       JOIN hashes h ON h.sha256 = g.sha256 AND h.status = 'complete'
       JOIN files f ON f.id = h.file_id AND f.state = 'present'`,
    ).run();
  });
  rebuild();
}

function readGroupRows(
  db: Database.Database,
  offset: number,
  limit: number,
): Array<{
  id: number;
  sha256: string;
  file_count: number;
  total_bytes: number;
}> {
  return db
    .prepare(
      `SELECT id, sha256, file_count, total_bytes
       FROM duplicate_groups
       ORDER BY total_bytes DESC, id ASC
       LIMIT ? OFFSET ?`,
    )
    .all(limit, offset) as Array<{
    id: number;
    sha256: string;
    file_count: number;
    total_bytes: number;
  }>;
}

function readDuplicateFiles(db: Database.Database, groupIds: number[]): Map<number, HealthFile[]> {
  const result = new Map<number, HealthFile[]>();
  if (groupIds.length === 0) {
    return result;
  }
  const placeholders = groupIds.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `SELECT
         dm.group_id,
         f.id,
         f.name,
         f.media_class,
         f.format,
         f.size,
         f.width,
         f.height,
         f.duration_seconds,
         f.frame_rate,
         f.state,
         fd.resolved_date,
         fd.precision,
         fd.source,
         fd.is_override,
         1 AS is_duplicate,
         c.status AS thumbnail_status,
         f.path AS file_path
       FROM duplicate_members dm
       JOIN files f ON f.id = dm.file_id
       LEFT JOIN file_dates fd ON fd.file_id = f.id
       LEFT JOIN cache_entries c ON c.file_id = f.id AND c.kind = 'thumbnail'
       WHERE dm.group_id IN (${placeholders})
       ORDER BY f.name COLLATE NOCASE, f.id`,
    )
    .all(...groupIds) as Array<Record<string, unknown> & { group_id: number }>;

  for (const row of rows) {
    const groupId = row.group_id;
    const parsed = parseLibraryRow(row);
    const files = result.get(groupId) ?? [];
    files.push(parseHealthFile(parsed));
    result.set(groupId, files);
  }
  return result;
}

export function getDuplicateGroups(
  db: Database.Database,
  offset: number,
  limit: number,
): DuplicateGroupsPage {
  rebuildDuplicateGroups(db);
  const groupRows = readGroupRows(db, offset, limit);
  const filesByGroup = readDuplicateFiles(
    db,
    groupRows.map((group) => group.id),
  );
  const groups: DuplicateGroup[] = groupRows.map((group) => ({
    groupId: group.id,
    sha256: group.sha256,
    fileCount: group.file_count,
    totalBytes: group.total_bytes,
    files: filesByGroup.get(group.id) ?? [],
  }));
  const totals = db
    .prepare(
      `SELECT COUNT(*) AS groups,
              COALESCE(SUM(file_count), 0) AS files,
              COALESCE(SUM(total_bytes), 0) AS bytes
       FROM duplicate_groups`,
    )
    .get() as { groups: number; files: number; bytes: number };
  return DuplicateGroupsPageSchema.parse({
    groups,
    totalGroups: totals.groups,
    totalFiles: totals.files,
    totalBytes: totals.bytes,
  });
}

interface PendingMovedRow {
  id: number;
  file_id: number;
  new_path: string;
  sha256: string;
}

export function confirmMovedCandidates(
  db: Database.Database,
  candidateIds: number[],
  now: string,
): MovedActionResult {
  const selectCandidate = db.prepare(
    "SELECT id, file_id, new_path, sha256 FROM moved_candidates WHERE id = ? AND state = 'pending'",
  );
  const removeDiscoveredRow = db.prepare("DELETE FROM files WHERE path = ? AND id != ?");
  const updateFile = db.prepare(
    `UPDATE files SET path = ?, name = ?, extension = ?, state = 'present',
       missing_since = NULL, last_seen_at = ?
     WHERE id = ?`,
  );
  const clearMissing = db.prepare("DELETE FROM missing_files WHERE file_id = ?");
  const confirm = db.prepare(
    "UPDATE moved_candidates SET state = 'confirmed', confirmed_at = ? WHERE id = ?",
  );
  const dismissOthers = db.prepare(
    `UPDATE moved_candidates SET state = 'dismissed'
     WHERE file_id = ? AND id != ? AND state = 'pending'`,
  );

  const run = db.transaction(() => {
    let updated = 0;
    let skipped = 0;
    for (const candidateId of candidateIds) {
      const row = selectCandidate.get(candidateId) as PendingMovedRow | undefined;
      if (row === undefined) {
        skipped += 1;
        continue;
      }
      try {
        removeDiscoveredRow.run(row.new_path, row.file_id);
        updateFile.run(
          row.new_path,
          path.basename(row.new_path),
          path.extname(row.new_path).slice(1),
          now,
          row.file_id,
        );
        clearMissing.run(row.file_id);
        confirm.run(now, candidateId);
        dismissOthers.run(row.file_id, candidateId);
        updated += 1;
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        skipped += 1;
      }
    }
    return { updated, skipped };
  });
  return run();
}

export function dismissMovedCandidates(
  db: Database.Database,
  candidateIds: number[],
): MovedActionResult {
  const update = db.prepare(
    "UPDATE moved_candidates SET state = 'dismissed' WHERE id = ? AND state = 'pending'",
  );
  const run = db.transaction(() => {
    let updated = 0;
    for (const id of candidateIds) {
      updated += update.run(id).changes;
    }
    return { updated, skipped: candidateIds.length - updated };
  });
  return run();
}

interface DuplicateTotals {
  groups: number;
  files: number;
  bytes: number;
}

function readDuplicateTotals(db: Database.Database): DuplicateTotals {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS groups,
              COALESCE(SUM(file_count), 0) AS files,
              COALESCE(SUM(total_bytes), 0) AS bytes
       FROM duplicate_groups`,
    )
    .get() as DuplicateTotals;
  return row;
}

function readMissingCount(db: Database.Database): number {
  const row = db
    .prepare("SELECT COUNT(*) AS count FROM missing_files WHERE dismissed_at IS NULL")
    .get() as {
    count: number;
  };
  return row.count;
}

function readMovedCount(db: Database.Database): number {
  const row = db
    .prepare("SELECT COUNT(*) AS count FROM moved_candidates WHERE state = 'pending'")
    .get() as { count: number };
  return row.count;
}

function readLastValidationAt(db: Database.Database): string | null {
  const row = db
    .prepare(
      `SELECT finished_at FROM validation_sessions
       WHERE state = 'complete' AND finished_at IS NOT NULL
       ORDER BY id DESC LIMIT 1`,
    )
    .get() as { finished_at: string } | undefined;
  return row?.finished_at ?? null;
}

export function getHealthSummary(db: Database.Database): HealthSummary {
  const duplicates = readDuplicateTotals(db);
  return HealthSummarySchema.parse({
    duplicateGroups: duplicates.groups,
    duplicateFiles: duplicates.files,
    duplicateBytes: duplicates.bytes,
    missingFiles: readMissingCount(db),
    movedCandidates: readMovedCount(db),
    lastValidationAt: readLastValidationAt(db),
  });
}
