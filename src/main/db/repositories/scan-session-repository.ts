import type Database from "better-sqlite3";
import { z } from "zod";
import {
  SCAN_STAGE_ORDER,
  ScanIntensitySchema,
  type ScanIntensity,
  type ScanMode,
  type ScanReport,
  type ScanStage,
  type ScanStageId,
  type ScanStageState,
  type ScanState,
  type ScanStatus,
} from "@shared/contracts/scan";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { readDriveIdentity } from "./catalog-repository";

const DbSessionStateSchema = z.enum(["running", "paused", "interrupted", "complete"]);
const DbStageStateSchema = z.enum(["queued", "running", "paused", "complete", "failed"]);

const SessionRowSchema = z.object({
  id: z.number().int().positive(),
  started_at: z.string(),
  finished_at: z.string().nullable(),
  state: DbSessionStateSchema,
  mode: z.enum(["initial", "incremental"]),
  last_stage: z.enum(SCAN_STAGE_ORDER).nullable(),
  root_path: z.string().nullable(),
  intensity: ScanIntensitySchema,
  error_message: z.string().nullable(),
  last_saved_at: z.string().nullable(),
  eta_seconds: z.number().int().nonnegative().nullable(),
  new_files: z.number().int().nonnegative(),
  changed_files: z.number().int().nonnegative(),
  missing_files: z.number().int().nonnegative(),
  moved_candidates: z.number().int().nonnegative(),
});

const StageRowSchema = z.object({
  stage: z.enum(SCAN_STAGE_ORDER),
  state: DbStageStateSchema,
  processed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative().nullable(),
});

export type ScanSessionRow = z.infer<typeof SessionRowSchema>;

function parseSession(row: unknown): ScanSessionRow {
  const parsed = SessionRowSchema.safeParse(row);
  if (!parsed.success) {
    throw new AppError(APP_ERROR_CODES.DB_ERROR, "Invalid scan session row", {
      issues: parsed.error.issues,
    });
  }
  return parsed.data;
}

function parseStage(row: unknown): ScanStage {
  const parsed = StageRowSchema.safeParse(row);
  if (!parsed.success) {
    throw new AppError(APP_ERROR_CODES.DB_ERROR, "Invalid scan stage row", {
      issues: parsed.error.issues,
    });
  }
  const state: ScanStageState =
    parsed.data.state === "running"
      ? "active"
      : parsed.data.state === "queued"
        ? "queued"
        : parsed.data.state;
  return {
    id: parsed.data.stage,
    state,
    processed: parsed.data.processed,
    total: parsed.data.total,
  };
}

export function readLatestScanSession(db: Database.Database): ScanSessionRow | null {
  const row = db.prepare("SELECT * FROM scan_sessions ORDER BY id DESC LIMIT 1").get();
  return row === undefined ? null : parseSession(row);
}

function readStages(db: Database.Database, sessionId: number): ScanStage[] {
  const rows = db.prepare("SELECT * FROM scan_stages WHERE session_id = ?").all(sessionId);
  const byId = new Map(rows.map(parseStage).map((stage) => [stage.id, stage]));

  return SCAN_STAGE_ORDER.map(
    (id) => byId.get(id) ?? { id, state: "queued", processed: 0, total: null },
  );
}

function readStoredIntensity(db: Database.Database): ScanIntensity {
  const row = db
    .prepare("SELECT value FROM catalog_settings WHERE key = 'scan.intensity'")
    .get() as { value: string } | undefined;
  const parsed = ScanIntensitySchema.safeParse(row?.value);
  return parsed.success ? parsed.data : "balanced";
}

function mapStatus(session: ScanSessionRow): ScanStatus {
  if (session.state === "complete") {
    return "complete";
  }
  if (session.error_message !== null) {
    return "error";
  }
  return session.state === "running" ? "active" : session.state;
}
function assertVolume(db: Database.Database, volumeId: string): void {
  const identity = readDriveIdentity(db);
  if (identity.volumeId !== volumeId) {
    throw new AppError(APP_ERROR_CODES.CATALOG_MISMATCH, "Scan request targets another catalog", {
      expectedVolumeId: identity.volumeId,
      actualVolumeId: volumeId,
    });
  }
}

export function getScanState(db: Database.Database, volumeId: string): ScanState {
  assertVolume(db, volumeId);
  const identity = readDriveIdentity(db);
  const session = readLatestScanSession(db);

  if (session === null) {
    return {
      driveLabel: identity.label,
      volumeId: identity.volumeId,
      status: "idle",
      mode: "initial",
      stages: SCAN_STAGE_ORDER.map((id) => ({
        id,
        state: "queued",
        processed: 0,
        total: null,
      })),
      currentStage: null,
      startedAt: null,
      finishedAt: null,
      lastSavedAt: null,
      etaSeconds: null,
      intensity: readStoredIntensity(db),
      report: null,
      errorMessage: null,
    };
  }

  const status = mapStatus(session);
  const report: ScanReport | null =
    status === "complete"
      ? {
          newFiles: session.new_files,
          changedFiles: session.changed_files,
          missingFiles: session.missing_files,
          movedCandidates: session.moved_candidates,
        }
      : null;
  return {
    driveLabel: identity.label,
    volumeId: identity.volumeId,
    status,
    mode: session.mode,
    stages: readStages(db, session.id),
    currentStage: status === "complete" ? null : session.last_stage,
    startedAt: session.started_at,
    finishedAt: session.finished_at,
    lastSavedAt: session.last_saved_at,
    etaSeconds: session.eta_seconds,
    intensity: session.intensity,
    report,
    errorMessage: session.error_message,
  };
}
export function recoverInterruptedScans(db: Database.Database): void {
  db.prepare(
    "UPDATE scan_sessions SET state = 'interrupted', eta_seconds = NULL WHERE state = 'running'",
  ).run();
  db.prepare(
    `UPDATE scan_stages SET state = 'paused'
     WHERE state = 'running'
       AND session_id IN (SELECT id FROM scan_sessions WHERE state = 'interrupted')`,
  ).run();
}

export interface StartScanInput {
  volumeId: string;
  rootPath: string;
  intensity: ScanIntensity;
  now: string;
}

export function createScanSession(db: Database.Database, input: StartScanInput): ScanState {
  assertVolume(db, input.volumeId);
  const session = readLatestScanSession(db);
  if (session !== null && (session.state === "running" || session.state === "paused")) {
    throw new AppError(
      APP_ERROR_CODES.SCAN_ALREADY_RUNNING,
      "A scan is already running for this catalog",
    );
  }

  const countRow = db.prepare("SELECT COUNT(*) AS count FROM files").get() as
    { count: number } | undefined;
  const mode: ScanMode = (countRow?.count ?? 0) > 0 ? "incremental" : "initial";

  const create = db.transaction(() => {
    const inserted = db
      .prepare(
        `INSERT INTO scan_sessions (
          started_at, state, mode, last_stage, root_path, intensity, last_saved_at
        ) VALUES (?, 'running', ?, 'catalog', ?, ?, ?)
        RETURNING id`,
      )
      .get(input.now, mode, input.rootPath, input.intensity, input.now) as
      { id: number } | undefined;

    if (inserted === undefined) {
      throw new AppError(APP_ERROR_CODES.DB_ERROR, "Scan session was not created");
    }

    const insertStage = db.prepare(
      `INSERT INTO scan_stages (session_id, stage, state, processed, total)
       VALUES (?, ?, 'queued', 0, NULL)`,
    );
    for (const stage of SCAN_STAGE_ORDER) {
      insertStage.run(inserted.id, stage);
    }

    db.prepare("INSERT OR IGNORE INTO scan_roots (path, enabled, created_at) VALUES (?, 1, ?)").run(
      input.rootPath,
      input.now,
    );
  });

  create();
  return getScanState(db, input.volumeId);
}

interface SessionStateInput {
  db: Database.Database;
  volumeId: string;
  state: "running" | "paused" | "interrupted";
  now: string;
  errorMessage: string | null;
}

function updateSessionState(input: SessionStateInput): void {
  assertVolume(input.db, input.volumeId);
  input.db
    .prepare(
      `UPDATE scan_sessions
       SET state = ?, error_message = ?, eta_seconds = NULL, last_saved_at = ?
       WHERE id = (SELECT MAX(id) FROM scan_sessions)`,
    )
    .run(input.state, input.errorMessage, input.now);
}

export function pauseScanSession(db: Database.Database, volumeId: string, now: string): ScanState {
  updateSessionState({ db, volumeId, state: "paused", now, errorMessage: null });
  db.prepare(
    `UPDATE scan_stages SET state = 'paused', updated_at = ?
     WHERE state = 'running'
       AND session_id = (SELECT MAX(id) FROM scan_sessions)`,
  ).run(now);
  return getScanState(db, volumeId);
}

export function resumeScanSession(db: Database.Database, volumeId: string, now: string): ScanState {
  assertVolume(db, volumeId);
  const session = readLatestScanSession(db);
  if (session === null || session.state === "complete") {
    throw new AppError(APP_ERROR_CODES.SCAN_STATE_INVALID, "There is no scan to resume");
  }

  updateSessionState({ db, volumeId, state: "running", now, errorMessage: null });
  db.prepare(
    `UPDATE scan_stages SET state = 'running', updated_at = ?
     WHERE state = 'paused'
       AND session_id = (SELECT MAX(id) FROM scan_sessions)`,
  ).run(now);
  return getScanState(db, volumeId);
}

export function interruptScanSession(
  db: Database.Database,
  volumeId: string,
  now: string,
): ScanState {
  const session = readLatestScanSession(db);
  if (session !== null && session.state !== "complete") {
    updateSessionState({ db, volumeId, state: "interrupted", now, errorMessage: null });
    db.prepare(
      `UPDATE scan_stages SET state = 'paused', updated_at = ?
       WHERE state = 'running'
         AND session_id = (SELECT MAX(id) FROM scan_sessions)`,
    ).run(now);
  }
  return getScanState(db, volumeId);
}

export function failScanSession(
  db: Database.Database,
  volumeId: string,
  message: string,
  now: string,
): ScanState {
  const session = readLatestScanSession(db);
  if (session !== null && session.state !== "complete") {
    updateSessionState({ db, volumeId, state: "interrupted", now, errorMessage: message });
    db.prepare(
      `UPDATE scan_stages SET state = 'failed', updated_at = ?
       WHERE stage = ? AND session_id = (SELECT MAX(id) FROM scan_sessions)`,
    ).run(now, session.last_stage ?? "catalog");
  }
  return getScanState(db, volumeId);
}

export interface BeginStageInput {
  volumeId: string;
  stage: ScanStageId;
  total: number | null;
  now: string;
}

export function beginScanStage(db: Database.Database, input: BeginStageInput): ScanState {
  assertVolume(db, input.volumeId);
  db.prepare(
    `UPDATE scan_stages
     SET state = 'running',
         total = COALESCE(?, total),
         started_at = COALESCE(started_at, ?),
         updated_at = ?
     WHERE stage = ? AND session_id = (SELECT MAX(id) FROM scan_sessions)`,
  ).run(input.total, input.now, input.now, input.stage);
  db.prepare(
    `UPDATE scan_sessions SET last_stage = ?, last_saved_at = ?
     WHERE id = (SELECT MAX(id) FROM scan_sessions)`,
  ).run(input.stage, input.now);
  return getScanState(db, input.volumeId);
}

export interface ScanProgressInput {
  volumeId: string;
  stage: ScanStageId;
  processed: number;
  total: number | null;
  etaSeconds: number | null;
  now: string;
}

export function saveScanProgress(db: Database.Database, input: ScanProgressInput): void {
  assertVolume(db, input.volumeId);
  db.prepare(
    `UPDATE scan_stages SET processed = ?, total = ?, updated_at = ?
     WHERE stage = ? AND session_id = (SELECT MAX(id) FROM scan_sessions)`,
  ).run(input.processed, input.total, input.now, input.stage);
  db.prepare(
    `UPDATE scan_sessions
     SET eta_seconds = CASE WHEN state = 'running' THEN ? ELSE NULL END, last_saved_at = ?
     WHERE id = (SELECT MAX(id) FROM scan_sessions)`,
  ).run(input.etaSeconds, input.now);
}

export interface CompleteStageInput {
  volumeId: string;
  stage: ScanStageId;
  processed: number;
  total: number | null;
  now: string;
}

export function completeScanStage(db: Database.Database, input: CompleteStageInput): ScanState {
  assertVolume(db, input.volumeId);
  db.prepare(
    `UPDATE scan_stages
     SET state = 'complete', processed = ?, total = ?, finished_at = ?, updated_at = ?
     WHERE stage = ? AND session_id = (SELECT MAX(id) FROM scan_sessions)`,
  ).run(input.processed, input.total, input.now, input.now, input.stage);
  db.prepare(
    `UPDATE scan_sessions SET last_saved_at = ? WHERE id = (SELECT MAX(id) FROM scan_sessions)`,
  ).run(input.now);
  return getScanState(db, input.volumeId);
}

export function setScanIntensity(
  db: Database.Database,
  volumeId: string,
  intensity: ScanIntensity,
  now: string,
): ScanState {
  assertVolume(db, volumeId);
  db.prepare(
    `INSERT INTO catalog_settings (key, value, updated_at) VALUES ('scan.intensity', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(intensity, now);
  db.prepare(
    `UPDATE scan_sessions SET intensity = ? WHERE id = (SELECT MAX(id) FROM scan_sessions)`,
  ).run(intensity);
  return getScanState(db, volumeId);
}
