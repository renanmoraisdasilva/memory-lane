import path from "node:path";
import type Database from "better-sqlite3";
import { z } from "zod";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";

const SourceFileRowSchema = z.object({
  id: z.number().int().positive(),
  path: z.string().min(1),
  name: z.string().min(1),
  size: z.number().int().nonnegative(),
  modified_at_fs: z.string().nullable(),
  state: z.enum(["present", "missing"]),
  media_class: z.string().min(1),
  sha256: z.string().nullable(),
  source_size_at_hash: z.number().int().nonnegative().nullable(),
  source_modified_at_fs_at_hash: z.string().nullable(),
  resolved_date: z.string().nullable(),
});

export interface ReplicationSourceFile {
  id: number;
  absolutePath: string;
  sourceRelativePath: string;
  name: string;
  size: number;
  modifiedAtFs: string | null;
  state: "present" | "missing";
  mediaClass: string;
  sha256: string | null;
  sourceSizeAtHash: number | null;
  sourceModifiedAtFsAtHash: string | null;
  resolvedDate: string | null;
}

export function catalogRootPath(catalogPath: string): string {
  return path.dirname(path.dirname(catalogPath));
}

export function toSourceRelativePath(catalogPath: string, absolutePath: string): string {
  const relative = path.relative(catalogRootPath(catalogPath), absolutePath);
  if (
    relative.length === 0 ||
    relative === ".." ||
    relative.startsWith("..\\") ||
    relative.startsWith("../") ||
    path.isAbsolute(relative)
  ) {
    throw new AppError(
      APP_ERROR_CODES.SOURCE_CHANGED,
      "A source file is outside the archive root; rebuild the source root before replicating.",
      { absolutePath },
    );
  }
  return relative;
}

export function listSourceFiles(
  db: Database.Database,
  catalogPath: string,
): ReplicationSourceFile[] {
  const rows = db
    .prepare(
      `SELECT
         f.id, f.path, f.name, f.size, f.modified_at_fs, f.state, f.media_class,
         h.sha256, h.source_size_at_hash, h.source_modified_at_fs_at_hash,
         fd.resolved_date
       FROM files f
       LEFT JOIN hashes h ON h.file_id = f.id AND h.status = 'complete'
       LEFT JOIN file_dates fd ON fd.file_id = f.id
       WHERE f.source_membership = 'source'
       ORDER BY f.id ASC`,
    )
    .all();
  return rows.map((row) => {
    const parsed = SourceFileRowSchema.safeParse(row);
    if (!parsed.success) {
      throw new AppError(APP_ERROR_CODES.DB_ERROR, "Source file row is invalid", {
        issues: parsed.error.issues,
      });
    }
    const data = parsed.data;
    return {
      id: data.id,
      absolutePath: data.path,
      sourceRelativePath: toSourceRelativePath(catalogPath, data.path),
      name: data.name,
      size: data.size,
      modifiedAtFs: data.modified_at_fs,
      state: data.state,
      mediaClass: data.media_class,
      sha256: data.sha256,
      sourceSizeAtHash: data.source_size_at_hash,
      sourceModifiedAtFsAtHash: data.source_modified_at_fs_at_hash,
      resolvedDate: data.resolved_date,
    };
  });
}

export interface SaveSourceHashInput {
  fileId: number;
  sha256: string;
  size: number;
  modifiedAtFs: string | null;
  now: string;
}

export function saveSourceHash(db: Database.Database, input: SaveSourceHashInput): void {
  db.prepare(
    `INSERT INTO hashes (
       file_id, sha256, hashed_at, status, source_size_at_hash, source_modified_at_fs_at_hash
     ) VALUES (?, ?, ?, 'complete', ?, ?)
     ON CONFLICT(file_id) DO UPDATE SET
       sha256 = excluded.sha256,
       hashed_at = excluded.hashed_at,
       status = 'complete',
       source_size_at_hash = excluded.source_size_at_hash,
       source_modified_at_fs_at_hash = excluded.source_modified_at_fs_at_hash`,
  ).run(input.fileId, input.sha256, input.now, input.size, input.modifiedAtFs);
}
