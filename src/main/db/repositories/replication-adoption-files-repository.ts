import type Database from "better-sqlite3";
import { z } from "zod";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { refreshAdoptionCounters } from "./replication-adoption-repository";
import type {
  AdoptionBatchInput,
  AdoptionOrphanWrite,
  AdoptionReplicaRow,
  AdoptionReplicaWrite,
  MarkUnseenInput,
} from "./replication-adoption-types";

const ReplicaRowSchema = z.object({
  file_id: z.number().int().positive(),
  relative_path: z.string(),
  relative_path_key: z.string(),
  source_relative_path: z.string(),
  size_bytes: z.number().int().nonnegative(),
  sha256: z.string().nullable(),
  status: z.enum(["discovered", "copied", "verified", "stale", "missing", "conflict", "failed"]),
  destination_size_at_verify: z.number().int().nonnegative().nullable(),
  destination_modified_at_fs_at_verify: z.string().nullable(),
  verified_at: z.string().nullable(),
  last_checked_at: z.string().nullable(),
});

export function listAdoptionReplicas(
  db: Database.Database,
  destinationRowId: number,
): AdoptionReplicaRow[] {
  const rows = db
    .prepare(
      `SELECT file_id, relative_path, relative_path_key, source_relative_path, size_bytes,
              sha256, status, destination_size_at_verify,
              destination_modified_at_fs_at_verify, verified_at, last_checked_at
       FROM replica_files
       WHERE replica_id = ?`,
    )
    .all(destinationRowId);
  return rows.map((row) => {
    const parsed = ReplicaRowSchema.safeParse(row);
    if (!parsed.success) {
      throw new AppError(APP_ERROR_CODES.DB_ERROR, "Replica row is invalid", {
        issues: parsed.error.issues,
      });
    }
    const data = parsed.data;
    return {
      fileId: data.file_id,
      relativePath: data.relative_path,
      relativePathKey: data.relative_path_key,
      sourceRelativePath: data.source_relative_path,
      sizeBytes: data.size_bytes,
      sha256: data.sha256,
      status: data.status,
      destinationSizeAtVerify: data.destination_size_at_verify,
      destinationModifiedAtFsAtVerify: data.destination_modified_at_fs_at_verify,
      verifiedAt: data.verified_at,
      lastCheckedAt: data.last_checked_at,
    };
  });
}

interface BatchStatements {
  replica: Database.Statement;
  deleteConflictingReplica: Database.Statement;
  deleteOrphan: Database.Statement;
  orphan: Database.Statement;
  touchReplica: Database.Statement;
  deleteReplicaAtOrphanPath: Database.Statement;
}

function prepareBatchStatements(db: Database.Database): BatchStatements {
  return {
    replica: db.prepare(
      `INSERT INTO replica_files (
         replica_id, file_id, relative_path, relative_path_key, source_relative_path,
         source_relative_path_key, size_bytes, sha256, status, source_size_at_verify,
         source_modified_at_fs_at_verify, destination_size_at_verify,
         destination_modified_at_fs_at_verify, discovered_at, verified_at, last_checked_at,
         last_error
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    deleteOrphan: db.prepare(
      `DELETE FROM replica_orphans WHERE replica_id = ? AND relative_path_key = ?`,
    ),
    orphan: db.prepare(
      `INSERT INTO replica_orphans (
         replica_id, relative_path, relative_path_key, size_bytes, sha256, modified_at_fs,
         classification, matched_source_count, status, discovered_at, last_checked_at, last_error
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'present', ?, ?, ?)
       ON CONFLICT(replica_id, relative_path_key) DO UPDATE SET
         relative_path = excluded.relative_path,
         size_bytes = excluded.size_bytes,
         sha256 = excluded.sha256,
         modified_at_fs = excluded.modified_at_fs,
         classification = excluded.classification,
         matched_source_count = excluded.matched_source_count,
         status = 'present',
         last_checked_at = excluded.last_checked_at,
         last_error = excluded.last_error`,
    ),
    touchReplica: db.prepare(
      `UPDATE replica_files SET last_checked_at = ?, status = 'verified'
       WHERE replica_id = ? AND file_id = ?`,
    ),
    deleteReplicaAtOrphanPath: db.prepare(
      `DELETE FROM replica_files WHERE replica_id = ? AND relative_path_key = ?`,
    ),
  };
}

function writeReplica(
  statements: BatchStatements,
  destinationRowId: number,
  replica: AdoptionReplicaWrite,
): void {
  statements.deleteOrphan.run(destinationRowId, replica.relativePathKey);
  statements.deleteConflictingReplica.run(
    destinationRowId,
    replica.relativePathKey,
    replica.fileId,
  );
  statements.replica.run(
    destinationRowId,
    replica.fileId,
    replica.relativePath,
    replica.relativePathKey,
    replica.sourceRelativePath,
    replica.sourceRelativePathKey,
    replica.sizeBytes,
    replica.sha256,
    replica.status,
    replica.sourceSizeAtVerify,
    replica.sourceModifiedAtFsAtVerify,
    replica.destinationSizeAtVerify,
    replica.destinationModifiedAtFsAtVerify,
    replica.lastCheckedAt,
    replica.status === "verified" ? replica.lastCheckedAt : null,
    replica.lastCheckedAt,
    replica.lastError,
  );
}

function writeOrphan(
  statements: BatchStatements,
  destinationRowId: number,
  orphan: AdoptionOrphanWrite,
): void {
  statements.deleteReplicaAtOrphanPath.run(destinationRowId, orphan.relativePathKey);
  statements.orphan.run(
    destinationRowId,
    orphan.relativePath,
    orphan.relativePathKey,
    orphan.sizeBytes,
    orphan.sha256,
    orphan.modifiedAtFs,
    orphan.classification,
    orphan.matchedSourceCount,
    orphan.lastCheckedAt,
    orphan.lastCheckedAt,
    orphan.lastError,
  );
}

export function saveAdoptionBatch(
  db: Database.Database,
  destinationRowId: number,
  input: AdoptionBatchInput,
): void {
  const statements = prepareBatchStatements(db);
  db.transaction(() => {
    for (const replica of input.replicas) {
      writeReplica(statements, destinationRowId, replica);
    }
    for (const fileId of input.touchedReplicaFileIds) {
      statements.touchReplica.run(input.now, destinationRowId, fileId);
    }
    for (const orphan of input.orphans) {
      writeOrphan(statements, destinationRowId, orphan);
    }
    refreshAdoptionCounters(db, destinationRowId);
  })();
}

export function setReplicaStatus(
  db: Database.Database,
  input: {
    destinationRowId: number;
    fileId: number;
    status: "verified" | "stale" | "missing";
    now: string;
    errorMessage: string | null;
  },
): void {
  db.prepare(
    `UPDATE replica_files
     SET status = ?, last_checked_at = ?, last_error = ?,
         verified_at = CASE WHEN ? = 'verified' THEN ? ELSE verified_at END
     WHERE replica_id = ? AND file_id = ?`,
  ).run(
    input.status,
    input.now,
    input.errorMessage,
    input.status,
    input.now,
    input.destinationRowId,
    input.fileId,
  );
  refreshAdoptionCounters(db, input.destinationRowId);
}

export function markUnseenReplicasMissing(db: Database.Database, input: MarkUnseenInput): void {
  const seenFiles = new Set(input.seenFileIds);
  const seenOrphans = new Set(input.seenOrphanPathKeys);
  db.transaction(() => {
    const rows = db
      .prepare(
        `SELECT file_id FROM replica_files
         WHERE replica_id = ? AND status <> 'missing'`,
      )
      .all(input.destinationRowId) as Array<{ file_id: number }>;
    const markReplica = db.prepare(
      `UPDATE replica_files
       SET status = 'missing', last_checked_at = ?, last_error = 'Destination file is missing'
       WHERE replica_id = ? AND file_id = ?`,
    );
    for (const row of rows) {
      if (!seenFiles.has(row.file_id)) {
        markReplica.run(input.now, input.destinationRowId, row.file_id);
      }
    }

    const orphans = db
      .prepare(
        `SELECT relative_path_key FROM replica_orphans
         WHERE replica_id = ? AND status = 'present'`,
      )
      .all(input.destinationRowId) as Array<{ relative_path_key: string }>;
    const markOrphan = db.prepare(
      `UPDATE replica_orphans
       SET status = 'missing', last_checked_at = ?
       WHERE replica_id = ? AND relative_path_key = ?`,
    );
    for (const row of orphans) {
      if (!seenOrphans.has(row.relative_path_key)) {
        markOrphan.run(input.now, input.destinationRowId, row.relative_path_key);
      }
    }
    refreshAdoptionCounters(db, input.destinationRowId);
  })();
}
