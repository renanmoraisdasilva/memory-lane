import path from "node:path";
import type Database from "better-sqlite3";
import { z } from "zod";
import type { ScanState } from "@shared/contracts/scan";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { ScannedFile } from "../../modules/scanning/domain/scan-files";
import { recordScanStats } from "./app-repository";
import { readDriveIdentity } from "./catalog-repository";
import {
  getScanState,
  readLatestScanSession,
  type ScanSessionRow,
} from "./scan-session-repository";
import { rebuildDuplicateGroups } from "./health-repository";

const ExistingFileRowSchema = z.object({
  id: z.number().int().positive(),
  size: z.number().int().nonnegative(),
  modified_at_fs: z.string().nullable(),
  state: z.enum(["present", "missing"]),
});

function parseExisting(row: unknown): z.infer<typeof ExistingFileRowSchema> {
  const parsed = ExistingFileRowSchema.safeParse(row);
  if (!parsed.success) {
    throw new AppError(APP_ERROR_CODES.DB_ERROR, "Invalid catalog file row", {
      issues: parsed.error.issues,
    });
  }
  return parsed.data;
}

function assertVolume(db: Database.Database, volumeId: string): void {
  const identity = readDriveIdentity(db);
  if (identity.volumeId !== volumeId) {
    throw new AppError(APP_ERROR_CODES.CATALOG_MISMATCH, "Scan request targets another catalog");
  }
}

function requireSession(db: Database.Database): ScanSessionRow {
  const session = readLatestScanSession(db);
  if (session === null) {
    throw new AppError(APP_ERROR_CODES.SCAN_STATE_INVALID, "No scan session is available");
  }
  return session;
}

function countSeenFiles(db: Database.Database, startedAt: string): number {
  const row = db
    .prepare("SELECT COUNT(*) AS count FROM files WHERE last_seen_at >= ?")
    .get(startedAt) as { count: number } | undefined;
  return row?.count ?? 0;
}

function invalidateFile(db: Database.Database, fileId: number, filePath: string): void {
  db.prepare("DELETE FROM file_metadata WHERE file_id = ?").run(fileId);
  db.prepare("DELETE FROM file_dates WHERE file_id = ? AND is_override = 0").run(fileId);
  db.prepare("DELETE FROM hashes WHERE file_id = ?").run(fileId);
  db.prepare("DELETE FROM quick_hashes WHERE file_id = ?").run(fileId);
  db.prepare("DELETE FROM cache_entries WHERE file_id = ?").run(fileId);
  db.prepare("DELETE FROM missing_files WHERE file_id = ?").run(fileId);
  db.prepare("DELETE FROM moved_candidates WHERE file_id = ? OR new_path = ?").run(
    fileId,
    filePath,
  );
}

export interface ApplyCatalogInput {
  volumeId: string;
  files: ScannedFile[];
  seenAt: string;
}

export interface ApplyCatalogResult {
  newFiles: number;
  changedFiles: number;
  processed: number;
}

export function applyCatalogBatch(
  db: Database.Database,
  input: ApplyCatalogInput,
): ApplyCatalogResult {
  assertVolume(db, input.volumeId);
  const session = requireSession(db);
  const startedAt = session.started_at;
  let newFiles = 0;
  let changedFiles = 0;

  const selectExisting = db.prepare(
    "SELECT id, size, modified_at_fs, state FROM files WHERE path = ?",
  );
  const insertFile = db.prepare(
    `INSERT INTO files (
      path, name, extension, size, created_at_fs, modified_at_fs,
      media_class, format, mime, state, last_seen_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'present', ?)`,
  );
  const updateFile = db.prepare(
    `UPDATE files SET
      name = ?, extension = ?, size = ?, created_at_fs = ?, modified_at_fs = ?,
      media_class = ?, format = ?, mime = ?, state = 'present',
      missing_since = NULL, last_seen_at = ?
     WHERE id = ?`,
  );
  const touchFile = db.prepare(
    `UPDATE files SET state = 'present', missing_since = NULL, last_seen_at = ?
     WHERE id = ?`,
  );

  const apply = db.transaction(() => {
    for (const file of input.files) {
      const existing = selectExisting.get(file.path);
      if (existing === undefined) {
        insertFile.run(
          file.path,
          file.name,
          file.extension,
          file.size,
          file.createdAtFs,
          file.modifiedAtFs,
          file.mediaClass,
          file.format,
          file.mime,
          input.seenAt,
        );
        newFiles += 1;
        continue;
      }

      const existingFile = parseExisting(existing);
      const id = existingFile.id;
      const changed =
        existingFile.size !== file.size ||
        existingFile.modified_at_fs !== file.modifiedAtFs ||
        existingFile.state === "missing";

      if (changed) {
        updateFile.run(
          file.name,
          file.extension,
          file.size,
          file.createdAtFs,
          file.modifiedAtFs,
          file.mediaClass,
          file.format,
          file.mime,
          input.seenAt,
          id,
        );
        invalidateFile(db, id, file.path);
        changedFiles += 1;
      } else {
        touchFile.run(input.seenAt, id);
      }
    }

    db.prepare(
      `UPDATE scan_sessions SET new_files = new_files + ?, changed_files = changed_files + ?
       WHERE id = ?`,
    ).run(newFiles, changedFiles, session.id);
  });

  apply();
  const processed = countSeenFiles(db, startedAt);
  db.prepare(
    `UPDATE scan_stages SET processed = ?, updated_at = ?
     WHERE stage = 'catalog' AND session_id = ?`,
  ).run(processed, input.seenAt, session.id);
  db.prepare("UPDATE scan_sessions SET last_saved_at = ? WHERE id = ?").run(
    input.seenAt,
    session.id,
  );

  return { newFiles, changedFiles, processed };
}

export interface FinishCatalogInput {
  volumeId: string;
  rootPath: string;
  seenAt: string;
  markMissing: boolean;
}

export interface FinishCatalogResult {
  processed: number;
  missingFiles: number;
}

function rootPrefix(rootPath: string): string {
  const resolved = path.resolve(rootPath);
  return resolved.endsWith(path.sep) ? resolved : `${resolved}${path.sep}`;
}

export function finishCatalog(
  db: Database.Database,
  input: FinishCatalogInput,
): FinishCatalogResult {
  assertVolume(db, input.volumeId);
  const session = requireSession(db);
  const prefix = rootPrefix(input.rootPath);
  let missingFiles = 0;

  if (input.markMissing) {
    db.prepare(
      `INSERT OR REPLACE INTO missing_files (file_id, last_path, last_seen_at, reason)
       SELECT id, path, last_seen_at, 'not_found_on_scan'
       FROM files
       WHERE state = 'present'
         AND substr(path, 1, length(?)) = ?
         AND last_seen_at < ?`,
    ).run(prefix, prefix, session.started_at);

    const result = db
      .prepare(
        `UPDATE files SET state = 'missing', missing_since = ?
         WHERE state = 'present'
           AND substr(path, 1, length(?)) = ?
           AND last_seen_at < ?`,
      )
      .run(input.seenAt, prefix, prefix, session.started_at);
    missingFiles = result.changes;
  }

  const processed = countSeenFiles(db, session.started_at);
  db.prepare("UPDATE scan_sessions SET missing_files = ?, last_saved_at = ? WHERE id = ?").run(
    missingFiles,
    input.seenAt,
    session.id,
  );
  db.prepare(
    `UPDATE scan_stages SET processed = ?, total = ?, updated_at = ?
     WHERE stage = 'catalog' AND session_id = ?`,
  ).run(processed, processed, input.seenAt, session.id);

  return { processed, missingFiles };
}

export interface FinalizeScanInput {
  catalogDb: Database.Database;
  appDb: Database.Database;
  volumeId: string;
  now: string;
}

export function finalizeScan(catalogDb: Database.Database, input: FinalizeScanInput): ScanState {
  assertVolume(catalogDb, input.volumeId);
  const session = requireSession(catalogDb);

  const moved = catalogDb
    .prepare(
      `INSERT OR IGNORE INTO moved_candidates (file_id, old_path, new_path, sha256, state)
       SELECT mf.file_id, mf.last_path, nf.path, h.sha256, 'pending'
       FROM missing_files mf
       JOIN files old ON old.id = mf.file_id
       JOIN hashes h ON h.file_id = old.id AND h.status = 'complete'
       JOIN files nf ON nf.state = 'present' AND nf.size = old.size AND nf.id != old.id
       JOIN hashes nh ON nh.file_id = nf.id AND nh.sha256 = h.sha256 AND nh.status = 'complete'
       WHERE old.missing_since >= ?
         AND nf.last_seen_at >= ?`,
    )
    .run(session.started_at, session.started_at);

  catalogDb
    .prepare(
      `UPDATE scan_sessions
       SET state = 'complete', finished_at = ?, last_stage = NULL,
           moved_candidates = ?, eta_seconds = NULL, last_saved_at = ?, error_message = NULL
       WHERE id = ?`,
    )
    .run(input.now, moved.changes, input.now, session.id);

  const countRow = catalogDb
    .prepare("SELECT COUNT(*) AS count FROM files WHERE state = 'present'")
    .get() as { count: number } | undefined;
  recordScanStats(input.appDb, {
    volumeId: input.volumeId,
    lastScanAt: input.now,
    indexedFiles: countRow?.count ?? 0,
  });
  rebuildDuplicateGroups(catalogDb);

  return getScanState(catalogDb, input.volumeId);
}
