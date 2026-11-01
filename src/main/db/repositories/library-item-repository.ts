import path from "node:path";
import type Database from "better-sqlite3";
import { z } from "zod";
import type { LibraryFilter, LibraryItemDetails, LibraryItem } from "@shared/contracts/library";
import { LibraryItemDetailsSchema } from "@shared/contracts/library";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { readDriveIdentity } from "./catalog-repository";
import {
  LIBRARY_SELECT,
  filterCondition,
  mediaUrlFor,
  parseLibraryRow,
  toLibraryItem,
} from "./library-query";

const MediaRowSchema = z.object({
  id: z.number().int().positive(),
  path: z.string().min(1),
  mime: z.string().nullable(),
  size: z.number().int().nonnegative(),
  state: z.enum(["present", "missing"]),
  media_class: z.enum(["image", "video", "other"]),
});

const DetailFileRowSchema = z.object({
  path: z.string().min(1),
  created_at_fs: z.string().nullable(),
  modified_at_fs: z.string(),
});

const MetadataRowSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  source: z.string().min(1),
});

const OrderRowSchema = z.object({
  position: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  prev_id: z.number().int().positive().nullable(),
  next_id: z.number().int().positive().nullable(),
});

const CacheEntryRowSchema = z.object({
  id: z.number().int().positive(),
  path: z.string().min(1),
  state: z.enum(["present", "missing"]),
  cache_path: z.string().nullable(),
  status: z.enum(["pending", "ready", "failed"]).nullable(),
});

export interface ResolvedMedia {
  fileId: number;
  path: string;
  mime: string | null;
  sizeBytes: number;
  state: "present" | "missing";
  mediaClass: "image" | "video" | "other";
}

export interface ResolvedCacheEntry {
  fileId: number;
  sourcePath: string;
  state: "present" | "missing";
  cachePath: string | null;
  status: "pending" | "ready" | "failed";
}

export type ResolvedThumbnail = ResolvedCacheEntry;
export type ResolvedPreview = ResolvedCacheEntry;

export interface LibraryContext {
  volumeId: string;
  driveLabel: string;
  catalogPath: string;
  cachePath: string;
}

export interface SaveCacheEntryInput {
  fileId: number;
  path: string;
  bytes: number;
  status: "ready" | "failed";
  now: string;
}

export type SaveThumbnailInput = SaveCacheEntryInput;
export type SavePreviewInput = SaveCacheEntryInput;

function parseMedia(row: unknown): ResolvedMedia {
  const parsed = MediaRowSchema.safeParse(row);
  if (!parsed.success) {
    throw new AppError(APP_ERROR_CODES.DB_ERROR, "Invalid media row", {
      issues: parsed.error.issues,
    });
  }
  return {
    fileId: parsed.data.id,
    path: parsed.data.path,
    mime: parsed.data.mime,
    sizeBytes: parsed.data.size,
    state: parsed.data.state,
    mediaClass: parsed.data.media_class,
  };
}

function readOrderRow(db: Database.Database, fileId: number, filter: LibraryFilter) {
  const row = db
    .prepare(
      `WITH ordered AS (
         SELECT f.id,
                ROW_NUMBER() OVER (ORDER BY fd.resolved_date DESC, f.id DESC) AS position,
                LEAD(f.id) OVER (ORDER BY fd.resolved_date DESC, f.id DESC) AS next_id,
                LAG(f.id) OVER (ORDER BY fd.resolved_date DESC, f.id DESC) AS prev_id,
                COUNT(*) OVER () AS total
         FROM files f
         LEFT JOIN file_dates fd ON fd.file_id = f.id
         WHERE ${filterCondition(filter)}
       )
       SELECT position, total, prev_id, next_id FROM ordered WHERE id = ?`,
    )
    .get(fileId);

  const parsed = OrderRowSchema.safeParse(row);
  if (!parsed.success) {
    throw new AppError(APP_ERROR_CODES.LIBRARY_ITEM_NOT_FOUND, "Catalog item was not found");
  }
  return parsed.data;
}

export function getLibraryItem(
  db: Database.Database,
  fileId: number,
  filter: LibraryFilter,
): LibraryItemDetails {
  const itemRow = db
    .prepare(`${LIBRARY_SELECT} WHERE f.id = ? AND ${filterCondition(filter)}`)
    .get(fileId);
  if (itemRow === undefined) {
    throw new AppError(APP_ERROR_CODES.LIBRARY_ITEM_NOT_FOUND, "Catalog item was not found");
  }

  const item: LibraryItem = toLibraryItem(parseLibraryRow(itemRow));
  const order = readOrderRow(db, fileId, filter);

  const fileRow = db
    .prepare("SELECT path, created_at_fs, modified_at_fs FROM files WHERE id = ?")
    .get(fileId);
  const parsedFile = DetailFileRowSchema.safeParse(fileRow);
  if (!parsedFile.success) {
    throw new AppError(APP_ERROR_CODES.DB_ERROR, "Invalid catalog file details");
  }

  const metadataRows = db
    .prepare(
      `SELECT key, value, COALESCE(source, 'unknown') AS source
       FROM file_metadata WHERE file_id = ? ORDER BY key`,
    )
    .all(fileId);
  const metadata = metadataRows.map((row) => {
    const parsed = MetadataRowSchema.safeParse(row);
    if (!parsed.success) {
      throw new AppError(APP_ERROR_CODES.DB_ERROR, "Invalid catalog metadata row");
    }
    return parsed.data;
  });

  return LibraryItemDetailsSchema.parse({
    item,
    path: parsedFile.data.path,
    folder: path.dirname(parsedFile.data.path),
    createdAtFs: parsedFile.data.created_at_fs,
    modifiedAtFs: parsedFile.data.modified_at_fs,
    metadata,
    position: order.position,
    total: order.total,
    previousFileId: order.prev_id,
    nextFileId: order.next_id,
    mediaUrl: mediaUrlFor(item.fileId, item.isMissing),
  });
}

export function resolveMediaFile(db: Database.Database, fileId: number): ResolvedMedia | null {
  const row = db
    .prepare(
      `SELECT id, path, mime, size, state, media_class
       FROM files WHERE id = ? AND media_class IN ('image', 'video')`,
    )
    .get(fileId);
  return row === undefined ? null : parseMedia(row);
}

export function resolveCatalogFile(db: Database.Database, fileId: number): ResolvedMedia | null {
  const row = db
    .prepare("SELECT id, path, mime, size, state, media_class FROM files WHERE id = ?")
    .get(fileId);
  return row === undefined ? null : parseMedia(row);
}

function resolveCacheEntry(
  db: Database.Database,
  fileId: number,
  kind: "thumbnail" | "preview",
): ResolvedCacheEntry | null {
  const row = db
    .prepare(
      `SELECT f.id, f.path, f.state, c.path AS cache_path, c.status
       FROM files f
       LEFT JOIN cache_entries c ON c.file_id = f.id AND c.kind = ?
       WHERE f.id = ? AND f.media_class IN ('image', 'video')`,
    )
    .get(kind, fileId);

  const parsed = CacheEntryRowSchema.safeParse(row);
  if (!parsed.success) {
    return null;
  }
  return {
    fileId: parsed.data.id,
    sourcePath: parsed.data.path,
    state: parsed.data.state,
    cachePath: parsed.data.cache_path,
    status: parsed.data.status ?? "pending",
  };
}

function saveCacheEntry(
  db: Database.Database,
  kind: "thumbnail" | "preview",
  input: SaveCacheEntryInput,
): void {
  db.prepare(
    `INSERT INTO cache_entries (file_id, kind, path, bytes, generated_at, status)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(file_id, kind) DO UPDATE SET
       path = excluded.path,
       bytes = excluded.bytes,
       generated_at = excluded.generated_at,
       status = excluded.status`,
  ).run(input.fileId, kind, input.path, input.bytes, input.now, input.status);
}

export function resolveThumbnail(db: Database.Database, fileId: number): ResolvedThumbnail | null {
  return resolveCacheEntry(db, fileId, "thumbnail");
}

export function resolvePreview(db: Database.Database, fileId: number): ResolvedPreview | null {
  return resolveCacheEntry(db, fileId, "preview");
}

export function saveThumbnail(db: Database.Database, input: SaveThumbnailInput): void {
  saveCacheEntry(db, "thumbnail", input);
}

export function savePreview(db: Database.Database, input: SavePreviewInput): void {
  saveCacheEntry(db, "preview", input);
}

export function getLibraryContext(db: Database.Database, catalogPath: string): LibraryContext {
  const identity = readDriveIdentity(db);
  return {
    volumeId: identity.volumeId,
    driveLabel: identity.label,
    catalogPath,
    cachePath: path.join(path.dirname(catalogPath), "cache"),
  };
}
