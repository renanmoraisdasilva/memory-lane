import type Database from "better-sqlite3";
import path from "node:path";

interface SourceFileRow {
  id: number;
  path: string;
  name: string;
  extension: string | null;
  size: number;
  created_at_fs: string | null;
  modified_at_fs: string | null;
  media_class: string;
  format: string | null;
  mime: string | null;
  state: "present" | "missing";
  missing_since: string | null;
  last_seen_at: string;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  frame_rate: number | null;
}

export interface PromotionFileMergeInput {
  source: Database.Database;
  destination: Database.Database;
  newSourceRoot: string;
  sourceRootRelative: string;
  sourceCatalogPath: string;
  promotedReplicaId: number;
  toSourceRelative: (absolutePath: string) => string;
}

export interface PromotionFileMergeResult {
  fileIdMap: Map<number, number>;
  presentFiles: number;
  presentBytes: number;
}

export function readSourceFiles(source: Database.Database): SourceFileRow[] {
  return source
    .prepare(
      `SELECT id, path, name, extension, size, created_at_fs, modified_at_fs, media_class,
              format, mime, state, missing_since, last_seen_at, width, height,
              duration_seconds, frame_rate
       FROM files
       WHERE source_membership = 'source'
       ORDER BY id ASC`,
    )
    .all() as SourceFileRow[];
}

function replicaPaths(source: Database.Database, replicaId: number): Map<number, string> {
  const rows = source
    .prepare(`SELECT file_id, source_relative_path FROM replica_files WHERE replica_id = ?`)
    .all(replicaId) as Array<{ file_id: number; source_relative_path: string }>;
  return new Map(rows.map((row) => [row.file_id, row.source_relative_path]));
}

function copyMetadata(
  source: Database.Database,
  destination: Database.Database,
  oldFileId: number,
  newFileId: number,
): void {
  const rows = source
    .prepare("SELECT key, value, source, extracted_at FROM file_metadata WHERE file_id = ?")
    .all(oldFileId) as Array<{
    key: string;
    value: string;
    source: string | null;
    extracted_at: string;
  }>;
  const insert = destination.prepare(
    `INSERT INTO file_metadata (file_id, key, value, source, extracted_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(file_id, key, source) DO UPDATE SET
       value = excluded.value, extracted_at = excluded.extracted_at`,
  );
  for (const row of rows) {
    insert.run(newFileId, row.key, row.value, row.source, row.extracted_at);
  }
}

function copyDate(
  source: Database.Database,
  destination: Database.Database,
  oldFileId: number,
  newFileId: number,
): void {
  const row = source.prepare("SELECT * FROM file_dates WHERE file_id = ?").get(oldFileId) as
    Record<string, unknown> | undefined;
  if (row === undefined) {
    return;
  }
  destination
    .prepare(
      `INSERT INTO file_dates (
         file_id, resolved_date, precision, source, confidence, original_value, is_override,
         override_id, extracted_date, extracted_precision, extracted_source,
         extracted_confidence, extracted_original_value
       ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)
       ON CONFLICT(file_id) DO UPDATE SET
         resolved_date = excluded.resolved_date,
         precision = excluded.precision,
         source = excluded.source,
         confidence = excluded.confidence,
         original_value = excluded.original_value,
         is_override = excluded.is_override,
         override_id = NULL,
         extracted_date = excluded.extracted_date,
         extracted_precision = excluded.extracted_precision,
         extracted_source = excluded.extracted_source,
         extracted_confidence = excluded.extracted_confidence,
         extracted_original_value = excluded.extracted_original_value`,
    )
    .run(
      newFileId,
      row.resolved_date,
      row.precision,
      row.source,
      row.confidence,
      row.original_value,
      row.is_override,
      row.extracted_date,
      row.extracted_precision,
      row.extracted_source,
      row.extracted_confidence,
      row.extracted_original_value,
    );
  const overrides = source
    .prepare("SELECT year, month, created_at, reverted_at FROM date_overrides WHERE file_id = ?")
    .all(oldFileId) as Array<{
    year: number;
    month: number | null;
    created_at: string;
    reverted_at: string | null;
  }>;
  const insertOverride = destination.prepare(
    `INSERT INTO date_overrides (file_id, year, month, created_at, reverted_at)
     SELECT ?, ?, ?, ?, ?
     WHERE NOT EXISTS (
       SELECT 1 FROM date_overrides
       WHERE file_id = ? AND year = ? AND month IS ? AND created_at = ?
     )`,
  );
  for (const override of overrides) {
    insertOverride.run(
      newFileId,
      override.year,
      override.month,
      override.created_at,
      override.reverted_at,
      newFileId,
      override.year,
      override.month,
      override.created_at,
    );
  }
}

function copyHash(
  source: Database.Database,
  destination: Database.Database,
  oldFileId: number,
  newFileId: number,
): void {
  const row = source
    .prepare(
      `SELECT sha256, hashed_at, status, source_size_at_hash, source_modified_at_fs_at_hash
       FROM hashes WHERE file_id = ?`,
    )
    .get(oldFileId) as
    | {
        sha256: string;
        hashed_at: string;
        status: string;
        source_size_at_hash: number | null;
        source_modified_at_fs_at_hash: string | null;
      }
    | undefined;
  if (row === undefined) {
    return;
  }
  destination
    .prepare(
      `INSERT INTO hashes (
         file_id, sha256, hashed_at, status, source_size_at_hash, source_modified_at_fs_at_hash
       ) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(file_id) DO UPDATE SET
         sha256 = excluded.sha256, hashed_at = excluded.hashed_at, status = excluded.status,
         source_size_at_hash = excluded.source_size_at_hash,
         source_modified_at_fs_at_hash = excluded.source_modified_at_fs_at_hash`,
    )
    .run(
      newFileId,
      row.sha256,
      row.hashed_at,
      row.status,
      row.source_size_at_hash,
      row.source_modified_at_fs_at_hash,
    );
}

function copyDuplicateMemberships(
  source: Database.Database,
  destination: Database.Database,
  oldFileId: number,
  newFileId: number,
): void {
  const groups = source
    .prepare(
      `SELECT g.sha256 FROM duplicate_members m
       JOIN duplicate_groups g ON g.id = m.group_id
       WHERE m.file_id = ?`,
    )
    .all(oldFileId) as Array<{ sha256: string }>;
  for (const group of groups) {
    const inserted = destination
      .prepare(
        `INSERT INTO duplicate_groups (sha256, file_count, total_bytes)
         VALUES (?, 0, 0)
         ON CONFLICT(sha256) DO UPDATE SET file_count = file_count
         RETURNING id`,
      )
      .get(group.sha256) as { id: number };
    destination
      .prepare("INSERT OR IGNORE INTO duplicate_members (group_id, file_id) VALUES (?, ?)")
      .run(inserted.id, newFileId);
    destination
      .prepare(
        `UPDATE duplicate_groups
         SET file_count = (SELECT COUNT(*) FROM duplicate_members WHERE group_id = ?),
             total_bytes = (
               SELECT COALESCE(SUM(f.size), 0) FROM duplicate_members m
               JOIN files f ON f.id = m.file_id WHERE m.group_id = ?
             )
         WHERE id = ?`,
      )
      .run(inserted.id, inserted.id, inserted.id);
  }
}

function copyMissingRow(input: {
  source: Database.Database;
  destination: Database.Database;
  oldFileId: number;
  newFileId: number;
  newPath: string;
}): void {
  const row = input.source
    .prepare("SELECT last_path, last_seen_at, reason FROM missing_files WHERE file_id = ?")
    .get(input.oldFileId) as
    { last_path: string; last_seen_at: string | null; reason: string | null } | undefined;
  if (row === undefined) {
    return;
  }
  input.destination
    .prepare(
      `INSERT INTO missing_files (file_id, last_path, last_seen_at, reason)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(file_id) DO UPDATE SET
         last_path = excluded.last_path, last_seen_at = excluded.last_seen_at,
         reason = excluded.reason`,
    )
    .run(input.newFileId, input.newPath, row.last_seen_at, row.reason);
}

export function mergeSourceFiles(input: PromotionFileMergeInput): PromotionFileMergeResult {
  const { source, destination, newSourceRoot } = input;
  const sources = readSourceFiles(source);
  const replica = replicaPaths(source, input.promotedReplicaId);
  const fileIdMap = new Map<number, number>();
  let presentFiles = 0;
  let presentBytes = 0;

  const upsert = destination.prepare(
    `INSERT INTO files (
       path, name, extension, size, created_at_fs, modified_at_fs, media_class, format, mime,
       state, missing_since, last_seen_at, width, height, duration_seconds, frame_rate,
       source_membership, relative_path
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'source', ?)
     ON CONFLICT(path) DO UPDATE SET
       name = excluded.name, extension = excluded.extension, size = excluded.size,
       created_at_fs = excluded.created_at_fs, modified_at_fs = excluded.modified_at_fs,
       media_class = excluded.media_class, format = excluded.format, mime = excluded.mime,
       state = excluded.state, missing_since = excluded.missing_since,
       last_seen_at = excluded.last_seen_at, width = excluded.width, height = excluded.height,
       duration_seconds = excluded.duration_seconds, frame_rate = excluded.frame_rate,
       source_membership = 'source', relative_path = excluded.relative_path
     RETURNING id`,
  );

  for (const file of sources) {
    const relative = replica.get(file.id) ?? input.toSourceRelative(file.path);
    const newPath = path.resolve(newSourceRoot, relative);
    const row = upsert.get(
      newPath,
      file.name,
      file.extension,
      file.size,
      file.created_at_fs,
      file.modified_at_fs,
      file.media_class,
      file.format,
      file.mime,
      file.state,
      file.missing_since,
      file.last_seen_at,
      file.width,
      file.height,
      file.duration_seconds,
      file.frame_rate,
      relative,
    ) as { id: number };
    fileIdMap.set(file.id, row.id);
    if (file.state === "present") {
      presentFiles += 1;
      presentBytes += file.size;
    }
    copyMetadata(source, destination, file.id, row.id);
    copyDate(source, destination, file.id, row.id);
    copyHash(source, destination, file.id, row.id);
    copyDuplicateMemberships(source, destination, file.id, row.id);
    copyMissingRow({
      source,
      destination,
      oldFileId: file.id,
      newFileId: row.id,
      newPath,
    });
  }

  return { fileIdMap, presentFiles, presentBytes };
}
