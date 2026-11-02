import type Database from "better-sqlite3";
import { z } from "zod";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type {
  AdoptionStatusChangeInput,
  ReplicationAdoptionRecord,
} from "./replication-adoption-types";

const AdoptionRowSchema = z.object({
  destination_row_id: z.number().int().positive(),
  destination_key: z.string().min(1),
  status: z.enum(["idle", "scanning", "hashing", "paused", "complete", "failed", "interrupted"]),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  last_saved_at: z.string().nullable(),
  scanned_files: z.number().int().nonnegative(),
  matched_files: z.number().int().nonnegative(),
  verified_files: z.number().int().nonnegative(),
  conflict_files: z.number().int().nonnegative(),
  stale_files: z.number().int().nonnegative(),
  ambiguous_files: z.number().int().nonnegative(),
  extra_files: z.number().int().nonnegative(),
  unreadable_files: z.number().int().nonnegative(),
  error_message: z.string().nullable(),
});

const SELECT_ADOPTION = `
  SELECT
    a.destination_id AS destination_row_id,
    d.destination_id AS destination_key,
    a.status, a.started_at, a.finished_at, a.last_saved_at,
    a.scanned_files, a.matched_files, a.verified_files, a.conflict_files,
    a.stale_files, a.ambiguous_files, a.extra_files, a.unreadable_files,
    a.error_message
  FROM replication_adoptions a
  JOIN replica_destinations d ON d.id = a.destination_id
`;

function parseAdoption(row: unknown): ReplicationAdoptionRecord {
  const parsed = AdoptionRowSchema.safeParse(row);
  if (!parsed.success) {
    throw new AppError(APP_ERROR_CODES.DB_ERROR, "Adoption row is invalid", {
      issues: parsed.error.issues,
    });
  }
  const data = parsed.data;
  return {
    destinationRowId: data.destination_row_id,
    destinationKey: data.destination_key,
    status: data.status,
    startedAt: data.started_at,
    finishedAt: data.finished_at,
    lastSavedAt: data.last_saved_at,
    scannedFiles: data.scanned_files,
    matchedFiles: data.matched_files,
    verifiedFiles: data.verified_files,
    conflictFiles: data.conflict_files,
    staleFiles: data.stale_files,
    ambiguousFiles: data.ambiguous_files,
    extraFiles: data.extra_files,
    unreadableFiles: data.unreadable_files,
    errorMessage: data.error_message,
  };
}

export function getAdoptionByKey(
  db: Database.Database,
  destinationKey: string,
): ReplicationAdoptionRecord {
  const row = db.prepare(`${SELECT_ADOPTION} WHERE d.destination_id = ?`).get(destinationKey);
  if (row === undefined) {
    throw new AppError(APP_ERROR_CODES.DESTINATION_NOT_FOUND, "Destination was not found", {
      destinationId: destinationKey,
    });
  }
  return parseAdoption(row);
}

export function getAdoptionByRowId(
  db: Database.Database,
  destinationRowId: number,
): ReplicationAdoptionRecord {
  const row = db.prepare(`${SELECT_ADOPTION} WHERE a.destination_id = ?`).get(destinationRowId);
  if (row === undefined) {
    throw new AppError(APP_ERROR_CODES.DESTINATION_NOT_FOUND, "Destination was not found", {
      destinationId: destinationRowId,
    });
  }
  return parseAdoption(row);
}

export function listAdoptions(db: Database.Database): ReplicationAdoptionRecord[] {
  const rows = db.prepare(`${SELECT_ADOPTION} ORDER BY a.id ASC`).all();
  return rows.map(parseAdoption);
}

export function beginAdoption(
  db: Database.Database,
  destinationRowId: number,
  now: string,
): ReplicationAdoptionRecord {
  db.prepare(
    `UPDATE replication_adoptions
     SET status = 'scanning', started_at = ?, finished_at = NULL, last_saved_at = ?,
         error_message = NULL
     WHERE destination_id = ?`,
  ).run(now, now, destinationRowId);
  return getAdoptionByRowId(db, destinationRowId);
}

export function setAdoptionStatus(
  db: Database.Database,
  input: AdoptionStatusChangeInput,
): ReplicationAdoptionRecord {
  db.prepare(
    `UPDATE replication_adoptions
     SET status = ?, last_saved_at = ?, error_message = ?
     WHERE destination_id = ?`,
  ).run(input.status, input.now, input.errorMessage, input.destinationRowId);
  return getAdoptionByRowId(db, input.destinationRowId);
}

export function finishAdoption(
  db: Database.Database,
  input: AdoptionStatusChangeInput,
): ReplicationAdoptionRecord {
  db.prepare(
    `UPDATE replication_adoptions
     SET status = ?, finished_at = ?, last_saved_at = ?, error_message = ?
     WHERE destination_id = ?`,
  ).run(input.status, input.now, input.now, input.errorMessage, input.destinationRowId);
  refreshAdoptionCounters(db, input.destinationRowId);
  return getAdoptionByRowId(db, input.destinationRowId);
}

export function refreshAdoptionCounters(db: Database.Database, destinationRowId: number): void {
  db.prepare(
    `UPDATE replication_adoptions
     SET scanned_files =
           (SELECT COUNT(*) FROM replica_files WHERE replica_id = ?) +
           (SELECT COUNT(*) FROM replica_orphans WHERE replica_id = ?),
         matched_files = (SELECT COUNT(*) FROM replica_files WHERE replica_id = ?),
         verified_files = (SELECT COUNT(*) FROM replica_files WHERE replica_id = ? AND status = 'verified'),
         conflict_files = (SELECT COUNT(*) FROM replica_files WHERE replica_id = ? AND status = 'conflict'),
         stale_files = (SELECT COUNT(*) FROM replica_files WHERE replica_id = ? AND status = 'stale'),
         ambiguous_files = (SELECT COUNT(*) FROM replica_orphans WHERE replica_id = ? AND classification = 'ambiguous'),
         extra_files = (SELECT COUNT(*) FROM replica_orphans WHERE replica_id = ? AND classification = 'extra'),
         unreadable_files = (SELECT COUNT(*) FROM replica_orphans WHERE replica_id = ? AND classification = 'unreadable')
     WHERE destination_id = ?`,
  ).run(
    destinationRowId,
    destinationRowId,
    destinationRowId,
    destinationRowId,
    destinationRowId,
    destinationRowId,
    destinationRowId,
    destinationRowId,
    destinationRowId,
    destinationRowId,
  );
}

export function markInterruptedAdoptions(db: Database.Database, now: string): number {
  const result = db
    .prepare(
      `UPDATE replication_adoptions
       SET status = 'interrupted', last_saved_at = ?, finished_at = ?
       WHERE status IN ('scanning', 'hashing')`,
    )
    .run(now, now);
  return result.changes;
}
