import type Database from "better-sqlite3";
import { z } from "zod";
import type { LibraryFilter, LibraryItem } from "@shared/contracts/library";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";

export const LibraryRowSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  media_class: z.enum(["image", "video"]),
  format: z.string().nullable(),
  size: z.number().int().nonnegative(),
  width: z.number().int().nonnegative().nullable(),
  height: z.number().int().nonnegative().nullable(),
  duration_seconds: z.number().nonnegative().nullable(),
  state: z.enum(["present", "missing"]),
  resolved_date: z.string().nullable(),
  precision: z.enum(["year", "month", "exact"]).nullable(),
  source: z.string().nullable(),
  is_override: z.number().int().min(0).max(1).nullable(),
  is_duplicate: z.number().int().min(0).max(1).nullable(),
  thumbnail_status: z.enum(["pending", "ready", "failed"]).nullable(),
  file_path: z.string().min(1),
});

export type LibraryRow = z.infer<typeof LibraryRowSchema>;

const CursorSchema = z.object({
  date: z.string().nullable(),
  id: z.number().int().positive(),
});

export interface TimelineCursor {
  date: string | null;
  id: number;
}

export interface SqlCondition {
  sql: string;
  params: Array<string | number>;
}

export function parseLibraryRow(row: unknown): LibraryRow {
  const parsed = LibraryRowSchema.safeParse(row);
  if (!parsed.success) {
    throw new AppError(APP_ERROR_CODES.DB_ERROR, "Invalid library row", {
      issues: parsed.error.issues,
    });
  }
  return parsed.data;
}

export function filterCondition(filter: LibraryFilter): string {
  switch (filter) {
    case "all":
      return "f.media_class IN ('image', 'video')";
    case "photos":
      return "f.media_class = 'image'";
    case "videos":
      return "f.media_class = 'video'";
  }
}

export function encodeCursor(cursor: TimelineCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(value: string): TimelineCursor {
  try {
    const decoded: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    return CursorSchema.parse(decoded);
  } catch {
    throw new AppError(APP_ERROR_CODES.INVALID_REQUEST, "The timeline cursor is invalid");
  }
}

export function cursorCondition(cursor: TimelineCursor): SqlCondition {
  if (cursor.date === null) {
    return {
      sql: "fd.resolved_date IS NULL AND f.id < ?",
      params: [cursor.id],
    };
  }

  return {
    sql: "(fd.resolved_date < ? OR (fd.resolved_date = ? AND f.id < ?) OR fd.resolved_date IS NULL)",
    params: [cursor.date, cursor.date, cursor.id],
  };
}

export function anchorCondition(year: number, month: number | null): SqlCondition {
  const upperBound =
    month === null
      ? new Date(Date.UTC(year + 1, 0, 1)).toISOString()
      : new Date(Date.UTC(year, month, 1)).toISOString();
  return {
    sql: "(fd.resolved_date < ? OR fd.resolved_date IS NULL)",
    params: [upperBound],
  };
}

export function thumbnailUrlFor(
  fileId: number,
  status: LibraryItem["thumbnailStatus"],
): string | null {
  return status === "failed" ? null : `ml-media://thumbnail/${fileId}`;
}

export function mediaUrlFor(fileId: number, isMissing: boolean): string | null {
  return isMissing ? null : `ml-media://media/${fileId}`;
}

export function toLibraryItem(row: LibraryRow): LibraryItem {
  const thumbnailStatus = row.thumbnail_status ?? "pending";
  return {
    fileId: row.id,
    name: row.name,
    mediaClass: row.media_class,
    format: row.format,
    sizeBytes: row.size,
    width: row.width === 0 ? null : row.width,
    height: row.height === 0 ? null : row.height,
    durationSeconds: row.duration_seconds,
    date:
      row.resolved_date === null
        ? { value: null, precision: null, source: null, isOverride: false }
        : {
            value: row.resolved_date,
            precision: row.precision,
            source: row.source,
            isOverride: row.is_override === 1,
          },
    thumbnailStatus,
    thumbnailUrl: thumbnailUrlFor(row.id, thumbnailStatus),
    isMissing: row.state === "missing",
    isDuplicate: row.is_duplicate === 1,
  };
}

export const LIBRARY_SELECT = `
  SELECT
    f.id,
    f.name,
    f.media_class,
    f.format,
    f.size,
    f.width,
    f.height,
    f.duration_seconds,
    f.state,
    fd.resolved_date,
    fd.precision,
    fd.source,
    fd.is_override,
    CASE WHEN dm.file_id IS NULL THEN 0 ELSE 1 END AS is_duplicate,
    c.status AS thumbnail_status,
    f.path AS file_path
  FROM files f
  LEFT JOIN file_dates fd ON fd.file_id = f.id
  LEFT JOIN duplicate_members dm ON dm.file_id = f.id
  LEFT JOIN cache_entries c ON c.file_id = f.id AND c.kind = 'thumbnail'
`;

export function buildTimelineWhere(
  filter: LibraryFilter,
  cursor: TimelineCursor | null,
  year: number | null,
  month: number | null,
): SqlCondition {
  const conditions = [filterCondition(filter)];
  const params: Array<string | number> = [];

  if (cursor !== null) {
    const condition = cursorCondition(cursor);
    conditions.push(condition.sql);
    params.push(...condition.params);
  } else if (year !== null) {
    const condition = anchorCondition(year, month);
    conditions.push(condition.sql);
    params.push(...condition.params);
  }

  return { sql: conditions.join(" AND "), params };
}

export function countLibraryItems(db: Database.Database, filter: LibraryFilter): number {
  const row = db
    .prepare(`SELECT COUNT(*) AS count FROM files f WHERE ${filterCondition(filter)}`)
    .get() as { count: number } | undefined;
  return row?.count ?? 0;
}
