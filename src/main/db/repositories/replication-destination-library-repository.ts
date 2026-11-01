import path from "node:path";
import type Database from "better-sqlite3";
import { assertPathInside } from "../../platform/path-guard";

export interface DestinationLibraryFileInput {
  relativePath: string;
  name: string;
  sizeBytes: number;
  modifiedAtFs: string | null;
  mediaClass: string;
  sha256: string | null;
  resolvedDate: string | null;
}

export interface DestinationLibraryStats {
  files: number;
  bytes: number;
}

export function getDestinationLibraryStats(db: Database.Database): DestinationLibraryStats {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS files, COALESCE(SUM(size), 0) AS bytes
       FROM files
       WHERE state = 'present'`,
    )
    .get() as { files: number; bytes: number } | undefined;
  return { files: row?.files ?? 0, bytes: row?.bytes ?? 0 };
}

export interface UpsertDestinationLibraryInput {
  destinationRoot: string;
  files: DestinationLibraryFileInput[];
  runStartedAt: string;
  now: string;
}

export function upsertDestinationLibraryFiles(
  db: Database.Database,
  input: UpsertDestinationLibraryInput,
): void {
  const { destinationRoot, files, runStartedAt, now } = input;
  const upsertFile = db.prepare(
    `INSERT INTO files (
       path, name, extension, size, modified_at_fs, media_class, state, last_seen_at,
       source_membership, relative_path
     ) VALUES (?, ?, ?, ?, ?, ?, 'present', ?, 'local_only', ?)
     ON CONFLICT(path) DO UPDATE SET
       name = excluded.name,
       extension = excluded.extension,
       size = excluded.size,
       modified_at_fs = excluded.modified_at_fs,
       media_class = excluded.media_class,
       state = 'present',
       missing_since = NULL,
       last_seen_at = excluded.last_seen_at,
       source_membership = 'local_only',
       relative_path = excluded.relative_path
     RETURNING id`,
  );
  const upsertHash = db.prepare(
    `INSERT INTO hashes (file_id, sha256, hashed_at, status)
     VALUES (?, ?, ?, 'complete')
     ON CONFLICT(file_id) DO UPDATE SET
       sha256 = excluded.sha256,
       hashed_at = excluded.hashed_at,
       status = 'complete'`,
  );
  const upsertDate = db.prepare(
    `INSERT INTO file_dates (
       file_id, resolved_date, precision, source, confidence, original_value, is_override
     ) VALUES (?, ?, NULL, 'replication', NULL, NULL, 0)
     ON CONFLICT(file_id) DO UPDATE SET
       resolved_date = excluded.resolved_date,
       precision = excluded.precision,
       source = excluded.source,
       confidence = excluded.confidence,
       original_value = excluded.original_value
     WHERE file_dates.is_override = 0`,
  );
  const markMissing = db.prepare(
    `UPDATE files
     SET state = 'missing', missing_since = ?
     WHERE source_membership = 'local_only' AND state = 'present'
       AND last_seen_at < ?`,
  );

  db.transaction(() => {
    for (const file of files) {
      const absolutePath = path.resolve(destinationRoot, file.relativePath);
      assertPathInside(destinationRoot, absolutePath);
      const extension = path.extname(file.name).replace(/^\./u, "").toLowerCase();
      const row = upsertFile.get(
        absolutePath,
        file.name,
        extension.length === 0 ? null : extension,
        file.sizeBytes,
        file.modifiedAtFs,
        file.mediaClass,
        now,
        file.relativePath,
      ) as { id: number };
      if (file.sha256 !== null) {
        upsertHash.run(row.id, file.sha256, now);
      }
      if (file.resolvedDate !== null) {
        upsertDate.run(row.id, file.resolvedDate);
      }
    }
    markMissing.run(now, runStartedAt);
  })();
}
