import type Database from "better-sqlite3";
import type { MovedCandidate, MovedCandidatesPage } from "@shared/contracts/health";
import { MovedCandidatesPageSchema } from "@shared/contracts/health";

interface MovedCandidateRow {
  id: number;
  file_id: number;
  name: string;
  old_path: string;
  new_path: string;
  size: number;
  sha256: string;
}

function toMovedCandidate(row: MovedCandidateRow): MovedCandidate {
  return {
    id: row.id,
    fileId: row.file_id,
    name: row.name,
    oldPath: row.old_path,
    newPath: row.new_path,
    sizeBytes: row.size,
    sha256: row.sha256,
  };
}

const MOVED_CANDIDATE_SELECT = `SELECT mc.id, mc.file_id, f.name, mc.old_path, mc.new_path, f.size, mc.sha256
  FROM moved_candidates mc
  JOIN files f ON f.id = mc.file_id
  WHERE mc.state = 'pending'`;

export function getMovedCandidates(
  db: Database.Database,
  offset = 0,
  limit = 50,
): MovedCandidatesPage {
  const totalRow = db
    .prepare("SELECT COUNT(*) AS count FROM moved_candidates WHERE state = 'pending'")
    .get() as { count: number };
  const rows = db
    .prepare(
      `${MOVED_CANDIDATE_SELECT}
       ORDER BY f.name COLLATE NOCASE, mc.id
       LIMIT ? OFFSET ?`,
    )
    .all(limit, offset) as MovedCandidateRow[];
  return MovedCandidatesPageSchema.parse({
    items: rows.map(toMovedCandidate),
    total: totalRow.count,
  });
}

export function getMovedCandidatesByIds(
  db: Database.Database,
  candidateIds: number[],
): MovedCandidatesPage {
  const uniqueIds = [...new Set(candidateIds)];
  if (uniqueIds.length === 0) {
    return { items: [], total: 0 };
  }
  const placeholders = uniqueIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `${MOVED_CANDIDATE_SELECT}
         AND mc.id IN (${placeholders})
       ORDER BY mc.id`,
    )
    .all(...uniqueIds) as MovedCandidateRow[];
  return MovedCandidatesPageSchema.parse({
    items: rows.map(toMovedCandidate),
    total: rows.length,
  });
}
