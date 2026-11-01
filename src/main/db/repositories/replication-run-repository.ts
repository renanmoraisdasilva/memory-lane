import type Database from "better-sqlite3";
import { z } from "zod";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { ReplicationRunStatus } from "@shared/contracts/replication/types";
import type {
  CreateRunInput,
  ReplicationRunRecord,
  UpdateRunPlanInput,
} from "./replication-run-types";

const RunRowSchema = z.object({
  id: z.number().int().positive(),
  status: z.enum([
    "planned",
    "running",
    "paused",
    "stopping",
    "completed",
    "stopped",
    "failed",
    "interrupted",
  ]),
  scope: z.enum(["all_connected", "full_copy_only", "partial_only"]),
  goal: z.enum(["extend_coverage", "full_copy", "both"]),
  plan_revision: z.number().int().positive(),
  plan_hash: z.string().nullable(),
  plan_updated_at: z.string().nullable(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  paused_at: z.string().nullable(),
  resumed_at: z.string().nullable(),
  stop_requested_at: z.string().nullable(),
  last_heartbeat_at: z.string().nullable(),
  destination_snapshot: z.string().nullable(),
  planned_files: z.number().int().nonnegative(),
  planned_bytes: z.number().int().nonnegative(),
  copied_files: z.number().int().nonnegative(),
  copied_bytes: z.number().int().nonnegative(),
  verified_files: z.number().int().nonnegative(),
  verified_bytes: z.number().int().nonnegative(),
  failed_files: z.number().int().nonnegative(),
  failed_bytes: z.number().int().nonnegative(),
  stale_files: z.number().int().nonnegative(),
  stale_bytes: z.number().int().nonnegative(),
  remainder_files: z.number().int().nonnegative(),
  remainder_bytes: z.number().int().nonnegative(),
  error_message: z.string().nullable(),
});

function parseRun(row: unknown): ReplicationRunRecord {
  const parsed = RunRowSchema.safeParse(row);
  if (!parsed.success) {
    throw new AppError(APP_ERROR_CODES.DB_ERROR, "Replication run row is invalid", {
      issues: parsed.error.issues,
    });
  }
  const data = parsed.data;
  return {
    id: data.id,
    status: data.status,
    scope: data.scope,
    goal: data.goal,
    planRevision: data.plan_revision,
    planHash: data.plan_hash,
    planUpdatedAt: data.plan_updated_at,
    startedAt: data.started_at,
    finishedAt: data.finished_at,
    pausedAt: data.paused_at,
    resumedAt: data.resumed_at,
    stopRequestedAt: data.stop_requested_at,
    lastHeartbeatAt: data.last_heartbeat_at,
    destinationSnapshot: data.destination_snapshot,
    plannedFiles: data.planned_files,
    plannedBytes: data.planned_bytes,
    copiedFiles: data.copied_files,
    copiedBytes: data.copied_bytes,
    verifiedFiles: data.verified_files,
    verifiedBytes: data.verified_bytes,
    failedFiles: data.failed_files,
    failedBytes: data.failed_bytes,
    staleFiles: data.stale_files,
    staleBytes: data.stale_bytes,
    remainderFiles: data.remainder_files,
    remainderBytes: data.remainder_bytes,
    errorMessage: data.error_message,
  };
}

export function getRun(db: Database.Database, runId: number): ReplicationRunRecord {
  const row = db.prepare("SELECT * FROM replication_runs WHERE id = ?").get(runId);
  if (row === undefined) {
    throw new AppError(APP_ERROR_CODES.REPLICATION_RUN_NOT_FOUND, "Backup run was not found", {
      runId,
    });
  }
  return parseRun(row);
}

export function getLatestRun(db: Database.Database): ReplicationRunRecord | null {
  const row = db.prepare("SELECT * FROM replication_runs ORDER BY id DESC LIMIT 1").get();
  return row === undefined ? null : parseRun(row);
}

export function getActiveRun(db: Database.Database): ReplicationRunRecord | null {
  const row = db
    .prepare(
      `SELECT * FROM replication_runs
       WHERE status IN ('running', 'paused', 'stopping')
       ORDER BY id DESC LIMIT 1`,
    )
    .get();
  return row === undefined ? null : parseRun(row);
}

export function createRun(db: Database.Database, input: CreateRunInput): ReplicationRunRecord {
  const row = db
    .prepare(
      `INSERT INTO replication_runs (
         status, scope, goal, plan_revision, plan_hash, plan_updated_at, started_at,
         last_heartbeat_at, destination_snapshot, planned_files, planned_bytes,
         remainder_files, remainder_bytes
       ) VALUES ('running', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .get(
      input.scope,
      input.goal,
      input.planRevision,
      input.planHash,
      input.now,
      input.now,
      input.now,
      input.destinationSnapshot,
      input.plannedFiles,
      input.plannedBytes,
      input.remainderFiles,
      input.remainderBytes,
    );
  return parseRun(row);
}

export interface RunStatusInput {
  runId: number;
  status: ReplicationRunStatus;
  now: string;
  errorMessage: string | null;
}

export function setRunStatus(db: Database.Database, input: RunStatusInput): ReplicationRunRecord {
  db.prepare(
    `UPDATE replication_runs
     SET status = ?,
         finished_at = CASE
           WHEN ? IN ('completed', 'stopped', 'failed', 'interrupted') THEN ?
           ELSE finished_at
         END,
         paused_at = CASE WHEN ? = 'paused' THEN ? ELSE paused_at END,
         resumed_at = CASE WHEN ? = 'running' THEN ? ELSE resumed_at END,
         stop_requested_at = CASE WHEN ? = 'stopping' THEN ? ELSE stop_requested_at END,
         last_heartbeat_at = ?,
         error_message = ?
     WHERE id = ?`,
  ).run(
    input.status,
    input.status,
    input.now,
    input.status,
    input.now,
    input.status,
    input.now,
    input.status,
    input.now,
    input.now,
    input.errorMessage,
    input.runId,
  );
  return getRun(db, input.runId);
}

export function updateRunPlan(
  db: Database.Database,
  runId: number,
  input: UpdateRunPlanInput,
): ReplicationRunRecord {
  db.prepare(
    `UPDATE replication_runs
     SET plan_revision = ?, plan_hash = ?, plan_updated_at = ?, destination_snapshot = ?,
         planned_files = ?, planned_bytes = ?, remainder_files = ?, remainder_bytes = ?,
         last_heartbeat_at = ?
     WHERE id = ?`,
  ).run(
    input.planRevision,
    input.planHash,
    input.now,
    input.destinationSnapshot,
    input.plannedFiles,
    input.plannedBytes,
    input.remainderFiles,
    input.remainderBytes,
    input.now,
    runId,
  );
  return getRun(db, runId);
}

export function markInterruptedRuns(db: Database.Database, now: string): number {
  const result = db
    .prepare(
      `UPDATE replication_runs
       SET status = 'interrupted', finished_at = ?, last_heartbeat_at = ?
       WHERE status IN ('running', 'stopping')`,
    )
    .run(now, now);
  return result.changes;
}
