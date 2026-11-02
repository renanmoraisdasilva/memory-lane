import type Database from "better-sqlite3";
import { z } from "zod";
import type { ValidationLevel, ValidationReport, ValidationState } from "@shared/contracts/health";
import { ValidationLevelSchema, ValidationStateSchema } from "@shared/contracts/health";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { rebuildDuplicateGroups } from "./health-repository";

const SessionRowSchema = z.object({
  id: z.number().int().positive(),
  levels: z.string().min(1),
  state: z.enum(["running", "paused", "complete", "failed"]),
  total: z.number().int().nonnegative(),
  processed: z.number().int().nonnegative(),
  current_level: z.string().nullable(),
  started_at: z.string().min(1),
  finished_at: z.string().nullable(),
  error_message: z.string().nullable(),
});

const PendingValidationRowSchema = z.object({
  id: z.number().int().positive(),
  path: z.string().min(1),
  size: z.number().int().nonnegative(),
  created_at_fs: z.string().nullable(),
  modified_at_fs: z.string().nullable(),
  state: z.enum(["present", "missing"]),
  sha256: z.string().nullable(),
});

export interface PendingValidationFile {
  fileId: number;
  path: string;
  sizeBytes: number;
  createdAtFs: string | null;
  modifiedAtFs: string | null;
  state: "present" | "missing";
  sha256: string | null;
}

export interface ValidationResultInput {
  fileId: number;
  level: ValidationLevel;
  result:
    | "verified"
    | "missing"
    | "metadataChanged"
    | "hashVerified"
    | "hashMismatch"
    | "metadataUpdated"
    | "metadataFailed"
    | "unreadable";
  detail: string | null;
  actualHash?: string | null | undefined;
}

function parseLevels(value: string): ValidationLevel[] {
  try {
    const decoded: unknown = JSON.parse(value);
    return z.array(ValidationLevelSchema).parse(decoded);
  } catch {
    return [];
  }
}

function readSession(db: Database.Database): z.infer<typeof SessionRowSchema> | null {
  const row = db.prepare("SELECT * FROM validation_sessions ORDER BY id DESC LIMIT 1").get();
  if (row === undefined) {
    return null;
  }
  const parsed = SessionRowSchema.safeParse(row);
  if (!parsed.success) {
    throw new AppError(APP_ERROR_CODES.DB_ERROR, "Invalid validation session row");
  }
  return parsed.data;
}

function readReport(db: Database.Database, sessionId: number): ValidationReport | null {
  const rows = db
    .prepare(
      `SELECT result, COUNT(*) AS count
       FROM validation_results
       WHERE session_id = ?
       GROUP BY result`,
    )
    .all(sessionId) as Array<{ result: string; count: number }>;
  if (rows.length === 0) {
    return null;
  }
  const counts = new Map(rows.map((row) => [row.result, row.count]));
  const get = (key: string): number => counts.get(key) ?? 0;
  const verified = get("verified") + get("hashVerified");
  const missing = get("missing");
  const metadataChanged = get("metadataChanged");
  const hashMismatch = get("hashMismatch");
  const metadataUpdated = get("metadataUpdated");
  const unreadable = get("metadataFailed") + get("unreadable");
  return {
    total: verified + missing + metadataChanged + hashMismatch + metadataUpdated + unreadable,
    verified,
    missing,
    metadataChanged,
    hashMismatch,
    metadataUpdated,
    unreadable,
    startedAt: null,
    finishedAt: null,
  };
}

function toState(
  db: Database.Database,
  session: z.infer<typeof SessionRowSchema>,
): ValidationState {
  const report = readReport(db, session.id);
  return ValidationStateSchema.parse({
    sessionId: session.id,
    status: session.state,
    levels: parseLevels(session.levels),
    total: session.total,
    processed: session.processed,
    currentLevel:
      session.current_level === null ? null : ValidationLevelSchema.parse(session.current_level),
    startedAt: session.started_at,
    finishedAt: session.finished_at,
    errorMessage: session.error_message,
    report:
      report === null
        ? null
        : {
            ...report,
            startedAt: session.started_at,
            finishedAt: session.finished_at,
          },
  });
}

export function getValidationState(db: Database.Database): ValidationState {
  const session = readSession(db);
  if (session === null) {
    return {
      sessionId: null,
      status: "idle",
      levels: [],
      total: 0,
      processed: 0,
      currentLevel: null,
      startedAt: null,
      finishedAt: null,
      errorMessage: null,
      report: null,
    };
  }
  return toState(db, session);
}

export function createValidation(
  db: Database.Database,
  levels: ValidationLevel[],
  now: string,
): ValidationState {
  const count = db.prepare("SELECT COUNT(*) AS count FROM files").get() as { count: number };
  const total = count.count * levels.length;
  const row = db
    .prepare(
      `INSERT INTO validation_sessions (
         levels, state, total, processed, current_level, started_at, last_saved_at
       ) VALUES (?, 'running', ?, 0, NULL, ?, ?)
       RETURNING *`,
    )
    .get(JSON.stringify(levels), total, now, now);
  const parsed = SessionRowSchema.safeParse(row);
  if (!parsed.success) {
    throw new AppError(APP_ERROR_CODES.DB_ERROR, "Validation session was not created");
  }
  return toState(db, parsed.data);
}

export function setValidationLevel(
  db: Database.Database,
  sessionId: number,
  level: ValidationLevel,
  now: string,
): void {
  db.prepare(
    "UPDATE validation_sessions SET current_level = ?, last_saved_at = ? WHERE id = ?",
  ).run(level, now, sessionId);
}

export function pauseValidation(db: Database.Database, sessionId: number, now: string): void {
  db.prepare("UPDATE validation_sessions SET state = 'paused', last_saved_at = ? WHERE id = ?").run(
    now,
    sessionId,
  );
}

export function resumeValidation(db: Database.Database, sessionId: number, now: string): void {
  db.prepare(
    "UPDATE validation_sessions SET state = 'running', last_saved_at = ? WHERE id = ?",
  ).run(now, sessionId);
}

export function finishValidation(db: Database.Database, sessionId: number, now: string): void {
  db.prepare(
    `UPDATE validation_sessions
     SET state = 'complete', finished_at = ?, current_level = NULL,
         last_saved_at = ?, error_message = NULL
     WHERE id = ?`,
  ).run(now, now, sessionId);
  rebuildDuplicateGroups(db);
}

export function failValidation(
  db: Database.Database,
  sessionId: number,
  message: string,
  now: string,
): void {
  db.prepare(
    `UPDATE validation_sessions
     SET state = 'failed', finished_at = ?, last_saved_at = ?, error_message = ?
     WHERE id = ?`,
  ).run(now, now, message, sessionId);
}

export function listPendingValidation(
  db: Database.Database,
  sessionId: number,
  level: ValidationLevel,
  limit: number,
): PendingValidationFile[] {
  const rows = db
    .prepare(
      `SELECT f.id, f.path, f.size, f.created_at_fs, f.modified_at_fs, f.state, h.sha256
       FROM files f
       LEFT JOIN hashes h ON h.file_id = f.id AND h.status = 'complete'
       WHERE NOT EXISTS (
         SELECT 1 FROM validation_results vr
         WHERE vr.session_id = ? AND vr.file_id = f.id AND vr.level = ?
       )
       ORDER BY f.id
       LIMIT ?`,
    )
    .all(sessionId, level, limit);
  return rows.map((row) => {
    const parsed = PendingValidationRowSchema.safeParse(row);
    if (!parsed.success) {
      throw new AppError(APP_ERROR_CODES.DB_ERROR, "Invalid pending validation row");
    }
    return {
      fileId: parsed.data.id,
      path: parsed.data.path,
      sizeBytes: parsed.data.size,
      createdAtFs: parsed.data.created_at_fs,
      modifiedAtFs: parsed.data.modified_at_fs,
      state: parsed.data.state,
      sha256: parsed.data.sha256,
    };
  });
}

export function saveValidationResults(
  db: Database.Database,
  sessionId: number,
  items: ValidationResultInput[],
  now: string,
): void {
  const insert = db.prepare(
    `INSERT OR REPLACE INTO validation_results (session_id, file_id, level, result, detail)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const markMissing = db.prepare(
    `UPDATE files SET state = 'missing', missing_since = COALESCE(missing_since, ?) WHERE id = ?`,
  );
  const insertMissing = db.prepare(
    `INSERT INTO missing_files (file_id, last_path, last_seen_at, reason)
     SELECT id, path, last_seen_at, 'validation_missing' FROM files WHERE id = ?
     ON CONFLICT(file_id) DO UPDATE SET
       last_path = excluded.last_path,
       last_seen_at = excluded.last_seen_at,
       reason = excluded.reason`,
  );
  const saveHash = db.prepare(
    `INSERT INTO hashes (file_id, sha256, hashed_at, status)
     VALUES (?, ?, ?, 'complete')
     ON CONFLICT(file_id) DO UPDATE SET
       sha256 = excluded.sha256,
       hashed_at = excluded.hashed_at,
       status = 'complete'`,
  );

  const save = db.transaction(() => {
    for (const item of items) {
      insert.run(sessionId, item.fileId, item.level, item.result, item.detail);
      if (item.result === "missing") {
        markMissing.run(now, item.fileId);
        insertMissing.run(item.fileId);
      }
      if (item.actualHash !== undefined && item.actualHash !== null) {
        saveHash.run(item.fileId, item.actualHash, now);
      }
    }
    db.prepare(
      `UPDATE validation_sessions
       SET processed = processed + ?, last_saved_at = ?
       WHERE id = ?`,
    ).run(items.length, now, sessionId);
  });
  save();
}
