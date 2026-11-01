import path from "node:path";
import type Database from "better-sqlite3";
import { z } from "zod";
import { assertPathInside } from "../../platform/path-guard";
import { resolveRelativePath } from "../../platform/destination-path-policy";
import { readDriveIdentity } from "./catalog-repository";
import { savePreview, saveThumbnail } from "./library-item-repository";

const DestinationMediaRowSchema = z.object({
  id: z.number().int().positive(),
  relative_path: z.string().nullable(),
  path: z.string(),
  mime: z.string().nullable(),
  size: z.number().int().nonnegative(),
  state: z.enum(["present", "missing"]),
  media_class: z.enum(["image", "video"]),
});

const DestinationCacheRowSchema = z.object({
  id: z.number().int().positive(),
  relative_path: z.string().nullable(),
  path: z.string(),
  state: z.enum(["present", "missing"]),
  cache_path: z.string().nullable(),
  status: z.enum(["pending", "ready", "failed"]).nullable(),
});

export interface DestinationMediaFile {
  fileId: number;
  path: string;
  mime: string | null;
  sizeBytes: number;
  state: "present" | "missing";
  mediaClass: "image" | "video";
}

export interface DestinationCacheEntry {
  fileId: number;
  sourcePath: string;
  state: "present" | "missing";
  cachePath: string | null;
  status: "pending" | "ready" | "failed";
}

export interface DestinationLibraryContext {
  volumeId: string;
  driveLabel: string;
  catalogPath: string;
  cachePath: string;
}

function absolutePath(root: string, relativePath: string | null, hint: string): string {
  if (relativePath === null) {
    return hint;
  }
  const resolved = resolveRelativePath(root, relativePath);
  assertPathInside(root, resolved);
  return resolved;
}

export function resolveDestinationMediaFile(
  db: Database.Database,
  root: string,
  fileId: number,
): DestinationMediaFile | null {
  const row = db
    .prepare(
      `SELECT id, relative_path, path, mime, size, state, media_class
       FROM files WHERE id = ? AND media_class IN ('image', 'video')`,
    )
    .get(fileId);
  const parsed = DestinationMediaRowSchema.safeParse(row);
  if (!parsed.success) {
    return null;
  }
  return {
    fileId: parsed.data.id,
    path: absolutePath(root, parsed.data.relative_path, parsed.data.path),
    mime: parsed.data.mime,
    sizeBytes: parsed.data.size,
    state: parsed.data.state,
    mediaClass: parsed.data.media_class,
  };
}

export function resolveDestinationCacheEntry(
  db: Database.Database,
  root: string,
  fileId: number,
  kind: "thumbnail" | "preview",
): DestinationCacheEntry | null {
  const row = db
    .prepare(
      `SELECT f.id, f.relative_path, f.path, f.state, c.path AS cache_path, c.status
       FROM files f
       LEFT JOIN cache_entries c ON c.file_id = f.id AND c.kind = ?
       WHERE f.id = ? AND f.media_class IN ('image', 'video')`,
    )
    .get(kind, fileId);
  const parsed = DestinationCacheRowSchema.safeParse(row);
  if (!parsed.success) {
    return null;
  }
  return {
    fileId: parsed.data.id,
    sourcePath: absolutePath(root, parsed.data.relative_path, parsed.data.path),
    state: parsed.data.state,
    cachePath: parsed.data.cache_path,
    status: parsed.data.status ?? "pending",
  };
}

export function getDestinationLibraryContext(
  db: Database.Database,
  catalogPath: string,
): DestinationLibraryContext {
  const identity = readDriveIdentity(db);
  return {
    volumeId: identity.volumeId,
    driveLabel: identity.label,
    catalogPath,
    cachePath: path.join(path.dirname(catalogPath), "cache"),
  };
}

export function saveDestinationThumbnail(
  db: Database.Database,
  input: {
    fileId: number;
    path: string;
    bytes: number;
    status: "ready" | "failed";
    now: string;
  },
): void {
  saveThumbnail(db, input);
}

export function saveDestinationPreview(
  db: Database.Database,
  input: {
    fileId: number;
    path: string;
    bytes: number;
    status: "ready" | "failed";
    now: string;
  },
): void {
  savePreview(db, input);
}
