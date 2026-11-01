import type Database from "better-sqlite3";
import { z } from "zod";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { CoverageMapCell } from "@shared/contracts/replication/types";
import type { ReplicaStatusCounts } from "../../modules/replication/domain/replication-types";

const CoverageRowSchema = z.object({
  destination_id: z.number().int().positive(),
  file_id: z.number().int().positive(),
  size: z.number().int().nonnegative(),
  verified_at: z.string().nullable(),
});

const CoverageMapRowSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12).nullable(),
  count: z.number().int().nonnegative(),
});

const StatusCountRowSchema = z.object({
  status: z.string(),
  count: z.number().int().nonnegative(),
});

export interface DestinationCoverage {
  destinationRowId: number;
  verifiedFileIds: ReadonlySet<number>;
  verifiedBytes: number;
  lastVerifiedAt: string | null;
}

export function listVerifiedCoverage(db: Database.Database): DestinationCoverage[] {
  const rows = db
    .prepare(
      `SELECT d.id AS destination_id, rf.file_id, f.size, rf.verified_at
       FROM replica_destinations d
       JOIN replica_files rf ON rf.replica_id = d.id AND rf.status = 'verified'
       JOIN files f ON f.id = rf.file_id AND f.state = 'present'
         AND f.source_membership = 'source'
       WHERE rf.source_size_at_verify = f.size
         AND rf.source_modified_at_fs_at_verify IS f.modified_at_fs
       ORDER BY d.id ASC, rf.file_id ASC`,
    )
    .all();
  const byDestination = new Map<number, { ids: Set<number>; bytes: number; last: string | null }>();
  for (const row of rows) {
    const parsed = CoverageRowSchema.safeParse(row);
    if (!parsed.success) {
      throw new AppError(APP_ERROR_CODES.DB_ERROR, "Coverage row is invalid", {
        issues: parsed.error.issues,
      });
    }
    const data = parsed.data;
    const current = byDestination.get(data.destination_id) ?? {
      ids: new Set<number>(),
      bytes: 0,
      last: null,
    };
    current.ids.add(data.file_id);
    current.bytes += data.size;
    if (data.verified_at !== null && (current.last === null || data.verified_at > current.last)) {
      current.last = data.verified_at;
    }
    byDestination.set(data.destination_id, current);
  }
  return [...byDestination.entries()].map(([destinationRowId, value]) => ({
    destinationRowId,
    verifiedFileIds: value.ids,
    verifiedBytes: value.bytes,
    lastVerifiedAt: value.last,
  }));
}

export function getDestinationCoverageMap(
  db: Database.Database,
  destinationRowId: number,
): CoverageMapCell[] {
  const rows = db
    .prepare(
      `SELECT
         CAST(substr(fd.resolved_date, 1, 4) AS INTEGER) AS year,
         CAST(substr(fd.resolved_date, 6, 2) AS INTEGER) AS month,
         COUNT(DISTINCT rf.file_id) AS count
       FROM replica_files rf
       JOIN files f ON f.id = rf.file_id AND f.state = 'present'
         AND f.source_membership = 'source'
       JOIN file_dates fd ON fd.file_id = f.id
       WHERE rf.replica_id = ? AND rf.status = 'verified'
         AND fd.resolved_date IS NOT NULL
         AND rf.source_size_at_verify = f.size
         AND rf.source_modified_at_fs_at_verify IS f.modified_at_fs
       GROUP BY year, month
       ORDER BY year ASC, month ASC`,
    )
    .all(destinationRowId);
  return rows.map((row) => {
    const parsed = CoverageMapRowSchema.safeParse(row);
    if (!parsed.success) {
      throw new AppError(APP_ERROR_CODES.DB_ERROR, "Coverage map row is invalid", {
        issues: parsed.error.issues,
      });
    }
    return parsed.data;
  });
}

export function getDestinationReplicaHealth(
  db: Database.Database,
  destinationRowId: number,
): ReplicaStatusCounts {
  const rows = db
    .prepare(
      `SELECT status, COUNT(*) AS count
       FROM replica_files
       WHERE replica_id = ?
       GROUP BY status`,
    )
    .all(destinationRowId);
  const counts: ReplicaStatusCounts = {
    conflictFiles: 0,
    staleFiles: 0,
    missingFiles: 0,
  };
  for (const row of rows) {
    const parsed = StatusCountRowSchema.safeParse(row);
    if (!parsed.success) {
      continue;
    }
    if (parsed.data.status === "conflict") {
      counts.conflictFiles = parsed.data.count;
    } else if (parsed.data.status === "stale") {
      counts.staleFiles = parsed.data.count;
    } else if (parsed.data.status === "missing") {
      counts.missingFiles = parsed.data.count;
    }
  }
  return counts;
}

export function getOverlapBytes(db: Database.Database): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(f.size), 0) AS bytes
       FROM files f
       WHERE f.state = 'present' AND f.source_membership = 'source'
         AND (
           SELECT COUNT(DISTINCT rf.replica_id)
           FROM replica_files rf
           JOIN replica_destinations d ON d.id = rf.replica_id
           WHERE rf.file_id = f.id AND rf.status = 'verified' AND d.status = 'active'
             AND rf.source_size_at_verify = f.size
             AND rf.source_modified_at_fs_at_verify IS f.modified_at_fs
         ) >= 2`,
    )
    .get() as { bytes: number } | undefined;
  return row?.bytes ?? 0;
}

export function getDestinationOverlapBytes(
  db: Database.Database,
  destinationRowId: number,
): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(f.size), 0) AS bytes
       FROM replica_files mine
       JOIN files f ON f.id = mine.file_id
         AND f.state = 'present' AND f.source_membership = 'source'
       WHERE mine.replica_id = ? AND mine.status = 'verified'
         AND mine.source_size_at_verify = f.size
         AND mine.source_modified_at_fs_at_verify IS f.modified_at_fs
         AND EXISTS (
           SELECT 1
           FROM replica_files other
           JOIN replica_destinations d ON d.id = other.replica_id
           WHERE other.file_id = mine.file_id AND other.status = 'verified'
             AND other.replica_id <> mine.replica_id AND d.status = 'active'
         )`,
    )
    .get(destinationRowId) as { bytes: number } | undefined;
  return row?.bytes ?? 0;
}
