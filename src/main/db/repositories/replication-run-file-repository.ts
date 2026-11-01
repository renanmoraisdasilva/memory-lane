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
       SET copied_files = copied_files + ?,
           copied_bytes = copied_bytes + ?,
           verified_files = verified_files + ?,
           verified_bytes = verified_bytes + ?,
           failed_files = failed_files + ?,
           failed_bytes = failed_bytes + ?,
           stale_files = stale_files + ?,
           stale_bytes = stale_bytes + ?,
           last_heartbeat_at = ?
       WHERE id = ?`,
    ),
  };
}

function count(flag: boolean): number {
  return flag ? 1 : 0;
}

function bytes(flag: boolean, size: number): number {
  return flag ? size : 0;
}

function runCounts(input: RunFileResultInput): {
  copiedFiles: number;
  copiedBytes: number;
  verifiedFiles: number;
  verifiedBytes: number;
  failedFiles: number;
  failedBytes: number;
  staleFiles: number;
  staleBytes: number;
} {
  const verified = input.status === "verified";
  const stale = input.status === "stale";
  const failed = input.status === "failed" || input.status === "conflict";
  const copied = verified || input.status === "copied";
  return {
    copiedFiles: count(copied),
    copiedBytes: bytes(copied, input.sizeBytes),
    verifiedFiles: count(verified),
    verifiedBytes: bytes(verified, input.sizeBytes),
    failedFiles: count(failed),
    failedBytes: bytes(failed, input.sizeBytes),
    staleFiles: count(stale),
    staleBytes: bytes(stale, input.sizeBytes),
  };
}

export function saveRunFileResult(db: Database.Database, input: RunFileResultInput): void {
  const statements = prepareStatements(db);
  const counts = runCounts(input);
  const copiedAt =
    input.status === "verified" || input.status === "copied" ? input.lastCheckedAt : null;
  const verifiedAt = input.status === "verified" ? input.lastCheckedAt : null;

  db.transaction(() => {
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
