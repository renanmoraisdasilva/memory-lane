import type Database from "better-sqlite3";
import { z } from "zod";
import type {
  DuplicateCleanupApplyResult,
  DuplicateCleanupFinishParams,
  DuplicateCleanupMove,
  DuplicateCleanupPlan,
  DuplicateCleanupRunParams,
  DuplicateCleanupState,
  DuplicateCleanupSummary,
} from "@shared/contracts/health";
import {
  DuplicateCleanupApplyResultSchema,
  DuplicateCleanupPlanSchema,
  DuplicateCleanupStateSchema,
  DuplicateCleanupSummarySchema,
} from "@shared/contracts/health";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { rebuildDuplicateGroups } from "./health-repository";
import {
  buildCleanupPlan,
  loadDuplicateEvaluations,
  summarizeDuplicateEvaluations,
} from "./duplicate-evaluation";
import { refreshAdoptionCounters } from "./replication-adoption-repository";

const CleanupRunRowSchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(["running", "complete", "cancelled", "failed"]),
  groups_total: z.number().int().nonnegative(),
  groups_processed: z.number().int().nonnegative(),
  groups_skipped: z.number().int().nonnegative(),
  files_total: z.number().int().nonnegative(),
  files_moved: z.number().int().nonnegative(),
  files_skipped: z.number().int().nonnegative(),
  bytes_total: z.number().int().nonnegative(),
  bytes_moved: z.number().int().nonnegative(),
  current_path: z.string().nullable(),
  quarantine_path: z.string().min(1),
  error_message: z.string().nullable(),
  started_at: z.string().min(1),
  finished_at: z.string().nullable(),
});

type CleanupRunRow = z.infer<typeof CleanupRunRowSchema>;

function parseRunRow(row: unknown): CleanupRunRow {
  const parsed = CleanupRunRowSchema.safeParse(row);
  if (!parsed.success) {
    throw new AppError(APP_ERROR_CODES.DB_ERROR, "Cleanup run row is invalid", {
      issues: parsed.error.issues,
    });
  }
  return parsed.data;
}

function toCleanupState(row: CleanupRunRow): DuplicateCleanupState {
  return DuplicateCleanupStateSchema.parse({
    runId: row.id,
    status: row.status,
    groupsTotal: row.groups_total,
    groupsProcessed: row.groups_processed,
    groupsSkipped: row.groups_skipped,
    filesTotal: row.files_total,
    filesMoved: row.files_moved,
    filesSkipped: row.files_skipped,
    bytesTotal: row.bytes_total,
    bytesMoved: row.bytes_moved,
    currentPath: row.current_path,
    quarantinePath: row.quarantine_path,
    cancelRequested: false,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  });
}

export function idleCleanupState(): DuplicateCleanupState {
  return DuplicateCleanupStateSchema.parse({
    runId: null,
    status: "idle",
    groupsTotal: 0,
    groupsProcessed: 0,
    groupsSkipped: 0,
    filesTotal: 0,
    filesMoved: 0,
    filesSkipped: 0,
    bytesTotal: 0,
    bytesMoved: 0,
    currentPath: null,
    quarantinePath: null,
    cancelRequested: false,
    errorMessage: null,
    startedAt: null,
    finishedAt: null,
  });
}

function readRun(db: Database.Database, runId: number): CleanupRunRow | null {
  const row = db.prepare("SELECT * FROM cleanup_runs WHERE id = ?").get(runId);
  return row === undefined ? null : parseRunRow(row);
}

export function getCleanupSummary(
  db: Database.Database,
  rootPath: string,
  quarantineRoot: string,
): DuplicateCleanupSummary {
  rebuildDuplicateGroups(db);
  const summary = summarizeDuplicateEvaluations(
    loadDuplicateEvaluations(db).values(),
    rootPath,
    quarantineRoot,
  );
  return DuplicateCleanupSummarySchema.parse(summary);
}

export function getCleanupPlan(
  db: Database.Database,
  rootPath: string,
  quarantineRoot: string,
): DuplicateCleanupPlan {
  rebuildDuplicateGroups(db);
  const plan = buildCleanupPlan(loadDuplicateEvaluations(db).values(), rootPath, quarantineRoot);
  return DuplicateCleanupPlanSchema.parse(plan);
}

export function startCleanupRun(
  db: Database.Database,
  params: DuplicateCleanupRunParams,
): DuplicateCleanupState {
  const run = db.transaction(() => {
    db.prepare(
      `UPDATE cleanup_runs
       SET status = 'failed', finished_at = ?,
           error_message = 'Interrupted by a new cleanup run'
       WHERE status = 'running'`,
    ).run(params.startedAt);
    return db
      .prepare(
        `INSERT INTO cleanup_runs (
          status, keeper_rule, root_path, quarantine_path, journal_path,
          groups_total, files_total, bytes_total, started_at
        ) VALUES ('running', ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *`,
      )
      .get(
        params.keeperRule,
        params.rootPath,
        params.quarantinePath,
        params.journalPath,
        params.groupsTotal,
        params.filesTotal,
        params.bytesTotal,
        params.startedAt,
      );
  })();
  return toCleanupState(parseRunRow(run));
}

export function applyCleanupMoves(
  db: Database.Database,
  runId: number,
  moves: DuplicateCleanupMove[],
): DuplicateCleanupApplyResult {
  const run = readRun(db, runId);
  if (run === null) {
    throw new AppError(APP_ERROR_CODES.INVALID_REQUEST, "Cleanup run was not found");
  }
  if (run.status !== "running") {
    throw new AppError(APP_ERROR_CODES.INVALID_REQUEST, "Cleanup run is not running");
  }

  const removeFile = db.prepare("DELETE FROM files WHERE id = ? AND path = ?");
  const insertMove = db.prepare(
    `INSERT INTO cleanup_moves (
       run_id, file_id, source_path, quarantine_path, sha256, size_bytes,
       created_at_fs, modified_at_fs, keeper_file_id, keeper_path, moved_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const movedBytes = moves.reduce((sum, move) => sum + move.sizeBytes, 0);

  const result = db.transaction(() => {
    let removed = 0;
    for (const move of moves) {
      removed += removeFile.run(move.fileId, move.sourcePath).changes;
      insertMove.run(
        runId,
        move.fileId,
        move.sourcePath,
        move.quarantinePath,
        move.sha256,
        move.sizeBytes,
        move.createdAtFs,
        move.modifiedAtFs,
        move.keeperFileId,
        move.keeperPath,
        move.movedAt,
      );
    }
    db.prepare(
      `UPDATE cleanup_runs
       SET files_moved = files_moved + ?, bytes_moved = bytes_moved + ?
       WHERE id = ?`,
    ).run(moves.length, movedBytes, runId);
    return { recorded: moves.length, removed };
  })();

  rebuildDuplicateGroups(db);
  if (result.removed > 0) {
    const destinations = db.prepare("SELECT id FROM replica_destinations").all() as Array<{
      id: number;
    }>;
    db.transaction(() => {
      for (const destination of destinations) {
        refreshAdoptionCounters(db, destination.id);
      }
    })();
  }
  return DuplicateCleanupApplyResultSchema.parse(result);
}

export function finishCleanupRun(
  db: Database.Database,
  params: DuplicateCleanupFinishParams,
): DuplicateCleanupState {
  const run = readRun(db, params.runId);
  if (run === null) {
    throw new AppError(APP_ERROR_CODES.INVALID_REQUEST, "Cleanup run was not found");
  }
  const finished = db
    .prepare(
      `UPDATE cleanup_runs
       SET status = ?, groups_processed = ?, groups_skipped = ?, files_moved = ?,
           files_skipped = ?, bytes_moved = ?, current_path = NULL,
           error_message = ?, finished_at = ?
       WHERE id = ?
       RETURNING *`,
    )
    .get(
      params.status,
      params.groupsProcessed,
      params.groupsSkipped,
      params.filesMoved,
      params.filesSkipped,
      params.bytesMoved,
      params.errorMessage,
      params.finishedAt,
      params.runId,
    );
  return toCleanupState(parseRunRow(finished));
}

export function getLatestCleanupState(db: Database.Database, now: string): DuplicateCleanupState {
  const row = db.prepare("SELECT * FROM cleanup_runs ORDER BY id DESC LIMIT 1").get();
  if (row === undefined) {
    return idleCleanupState();
  }
  const latest = parseRunRow(row);
  if (latest.status !== "running") {
    return toCleanupState(latest);
  }
  const interrupted = db
    .prepare(
      `UPDATE cleanup_runs
       SET status = 'failed', finished_at = ?,
           error_message = 'Cleanup was interrupted. Rescan to reconcile the catalog.'
       WHERE id = ?
       RETURNING *`,
    )
    .get(now, latest.id);
  return toCleanupState(parseRunRow(interrupted));
}

export function getLatestQuarantinePath(db: Database.Database): string | null {
  const row = db
    .prepare("SELECT quarantine_path FROM cleanup_runs ORDER BY id DESC LIMIT 1")
    .get() as { quarantine_path: string } | undefined;
  return row?.quarantine_path ?? null;
}
