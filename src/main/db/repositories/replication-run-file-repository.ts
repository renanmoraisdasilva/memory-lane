import type Database from "better-sqlite3";
import { z } from "zod";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { RunFileResultInput } from "./replication-run-types";

const ExistingReplicaSchema = z.object({
  relative_path: z.string(),
  relative_path_key: z.string(),
  sha256: z.string().nullable(),
  status: z.enum(["discovered", "copied", "verified", "stale", "missing", "conflict", "failed"]),
});

export interface ExistingRunReplica {
  relativePath: string;
  relativePathKey: string;
  sha256: string | null;
  status: "discovered" | "copied" | "verified" | "stale" | "missing" | "conflict" | "failed";
}

export function getExistingReplica(
  db: Database.Database,
  destinationRowId: number,
  fileId: number,
): ExistingRunReplica | null {
  const row = db
    .prepare(
      `SELECT relative_path, relative_path_key, sha256, status
       FROM replica_files WHERE replica_id = ? AND file_id = ?`,
    )
    .get(destinationRowId, fileId);
  if (row === undefined) {
    return null;
  }
  const parsed = ExistingReplicaSchema.safeParse(row);
  if (!parsed.success) {
    throw new AppError(APP_ERROR_CODES.DB_ERROR, "Replica row is invalid", {
      issues: parsed.error.issues,
    });
  }
  return {
    relativePath: parsed.data.relative_path,
    relativePathKey: parsed.data.relative_path_key,
    sha256: parsed.data.sha256,
    status: parsed.data.status,
  };
}

interface RunFileStatements {
  replica: Database.Statement;
  deleteConflictingReplica: Database.Statement;
  incrementRun: Database.Statement;
  previousReplica: Database.Statement;
}

function prepareStatements(db: Database.Database): RunFileStatements {
  return {
    replica: db.prepare(
      `INSERT INTO replica_files (
         replica_id, file_id, relative_path, relative_path_key, source_relative_path,
         source_relative_path_key, size_bytes, sha256, status, source_size_at_verify,
         source_modified_at_fs_at_verify, destination_size_at_verify,
         destination_modified_at_fs_at_verify, discovered_at, copied_at, verified_at,
         last_checked_at, last_error
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(replica_id, file_id) DO UPDATE SET
         relative_path = excluded.relative_path,
         relative_path_key = excluded.relative_path_key,
         source_relative_path = excluded.source_relative_path,
         source_relative_path_key = excluded.source_relative_path_key,
         size_bytes = excluded.size_bytes,
         sha256 = excluded.sha256,
         status = excluded.status,
         source_size_at_verify = excluded.source_size_at_verify,
         source_modified_at_fs_at_verify = excluded.source_modified_at_fs_at_verify,
         destination_size_at_verify = excluded.destination_size_at_verify,
         destination_modified_at_fs_at_verify = excluded.destination_modified_at_fs_at_verify,
         copied_at = CASE
           WHEN excluded.status IN ('copied', 'verified') THEN excluded.copied_at
           ELSE replica_files.copied_at
         END,
         verified_at = CASE
           WHEN excluded.status = 'verified' THEN excluded.verified_at
           ELSE replica_files.verified_at
         END,
         last_checked_at = excluded.last_checked_at,
         last_error = excluded.last_error`,
    ),
    deleteConflictingReplica: db.prepare(
      `DELETE FROM replica_files
       WHERE replica_id = ? AND relative_path_key = ? AND file_id <> ?`,
    ),
    incrementRun: db.prepare(
      `UPDATE replication_runs
       SET copied_files = MAX(0, copied_files + ?),
           copied_bytes = MAX(0, copied_bytes + ?),
           verified_files = MAX(0, verified_files + ?),
           verified_bytes = MAX(0, verified_bytes + ?),
           failed_files = MAX(0, failed_files + ?),
           failed_bytes = MAX(0, failed_bytes + ?),
           stale_files = MAX(0, stale_files + ?),
           stale_bytes = MAX(0, stale_bytes + ?),
           last_heartbeat_at = ?
       WHERE id = ?`,
    ),
    previousReplica: db.prepare(
      `SELECT status, size_bytes, copied_at FROM replica_files WHERE replica_id = ? AND file_id = ?`,
    ),
  };
}

interface RunCounts {
  copiedFiles: number;
  copiedBytes: number;
  verifiedFiles: number;
  verifiedBytes: number;
  failedFiles: number;
  failedBytes: number;
  staleFiles: number;
  staleBytes: number;
}

function zeroCounts(): RunCounts {
  return {
    copiedFiles: 0,
    copiedBytes: 0,
    verifiedFiles: 0,
    verifiedBytes: 0,
    failedFiles: 0,
    failedBytes: 0,
    staleFiles: 0,
    staleBytes: 0,
  };
}

function countsForStatus(status: string, sizeBytes: number): RunCounts {
  const counts = zeroCounts();
  if (status === "verified") {
    counts.copiedFiles = 1;
    counts.copiedBytes = sizeBytes;
    counts.verifiedFiles = 1;
    counts.verifiedBytes = sizeBytes;
  } else if (status === "copied") {
    counts.copiedFiles = 1;
    counts.copiedBytes = sizeBytes;
  } else if (status === "stale") {
    counts.staleFiles = 1;
    counts.staleBytes = sizeBytes;
  } else if (status === "failed" || status === "conflict") {
    counts.failedFiles = 1;
    counts.failedBytes = sizeBytes;
  }
  return counts;
}

function subtractCounts(next: RunCounts, previous: RunCounts): RunCounts {
  return {
    copiedFiles: next.copiedFiles - previous.copiedFiles,
    copiedBytes: next.copiedBytes - previous.copiedBytes,
    verifiedFiles: next.verifiedFiles - previous.verifiedFiles,
    verifiedBytes: next.verifiedBytes - previous.verifiedBytes,
    failedFiles: next.failedFiles - previous.failedFiles,
    failedBytes: next.failedBytes - previous.failedBytes,
    staleFiles: next.staleFiles - previous.staleFiles,
    staleBytes: next.staleBytes - previous.staleBytes,
  };
}

export function saveRunFileResult(db: Database.Database, input: RunFileResultInput): void {
  const statements = prepareStatements(db);
  const copiedAt =
    input.status === "verified" || input.status === "copied" ? input.lastCheckedAt : null;
  const verifiedAt = input.status === "verified" ? input.lastCheckedAt : null;

  db.transaction(() => {
    const previous = statements.previousReplica.get(input.destinationRowId, input.fileId) as
      { status: string; size_bytes: number; copied_at: string | null } | undefined;
    const counts = subtractCounts(
      countsForStatus(input.status, input.sizeBytes),
      previous === undefined ? zeroCounts() : countsForStatus(previous.status, previous.size_bytes),
    );
    const wasCopied = previous !== undefined && previous.copied_at !== null;
    const isCopied = input.status === "copied" || input.status === "verified";
    counts.copiedFiles = isCopied && !wasCopied ? 1 : 0;
    counts.copiedBytes = isCopied && !wasCopied ? input.sizeBytes : 0;
    statements.deleteConflictingReplica.run(
      input.destinationRowId,
      input.relativePathKey,
      input.fileId,
    );
    statements.replica.run(
      input.destinationRowId,
      input.fileId,
      input.relativePath,
      input.relativePathKey,
      input.sourceRelativePath,
      input.sourceRelativePathKey,
      input.sizeBytes,
      input.sha256,
      input.status,
      input.sourceSizeAtVerify,
      input.sourceModifiedAtFsAtVerify,
      input.destinationSizeAtVerify,
      input.destinationModifiedAtFsAtVerify,
      input.lastCheckedAt,
      copiedAt,
      verifiedAt,
      input.lastCheckedAt,
      input.lastError,
    );
    statements.incrementRun.run(
      counts.copiedFiles,
      counts.copiedBytes,
      counts.verifiedFiles,
      counts.verifiedBytes,
      counts.failedFiles,
      counts.failedBytes,
      counts.staleFiles,
      counts.staleBytes,
      input.lastCheckedAt,
      input.runId,
    );
  })();
}
