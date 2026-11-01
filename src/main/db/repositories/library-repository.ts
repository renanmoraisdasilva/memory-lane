import type Database from "better-sqlite3";
import type {
  LibraryFilter,
  LibraryMonth,
  LibrarySummary,
  LibraryTimelineIndex,
  LibraryTimelinePage,
} from "@shared/contracts/library";
import { LibraryTimelineIndexSchema, LibraryTimelinePageSchema } from "@shared/contracts/library";
import { METADATA_EXTRACTOR_VERSION } from "@shared/domain/metadata";
import {
  LIBRARY_SELECT,
  buildTimelineWhere,
  countLibraryItems,
  decodeCursor,
  encodeCursor,
  filterCondition,
  parseLibraryRow,
  toLibraryItem,
} from "./library-query";

interface SummaryCountRow {
  total: number;
  photos: number;
  videos: number;
  bytes: number;
}

function readSummaryCounts(db: Database.Database): SummaryCountRow | undefined {
  return db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN f.media_class = 'image' THEN 1 ELSE 0 END), 0) AS photos,
         COALESCE(SUM(CASE WHEN f.media_class = 'video' THEN 1 ELSE 0 END), 0) AS videos,
         COALESCE(SUM(CASE WHEN f.state = 'present' THEN f.size ELSE 0 END), 0) AS bytes
       FROM files f
       WHERE ${filterCondition("all")}`,
    )
    .get() as SummaryCountRow | undefined;
}

function readUndatedCount(db: Database.Database): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM files f
       LEFT JOIN file_dates fd ON fd.file_id = f.id
       WHERE ${filterCondition("all")} AND fd.resolved_date IS NULL`,
    )
    .get() as { count: number } | undefined;
  return row?.count ?? 0;
}

function readLastScanAt(db: Database.Database): string | null {
  const row = db
    .prepare(
      `SELECT finished_at FROM scan_sessions
       WHERE state = 'complete' AND finished_at IS NOT NULL
       ORDER BY id DESC LIMIT 1`,
    )
    .get() as { finished_at: string } | undefined;
  return row?.finished_at ?? null;
}

function readMetadataRefreshCount(db: Database.Database): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count FROM files f
       WHERE f.state = 'present'
         AND EXISTS (
           SELECT 1 FROM file_metadata m WHERE m.file_id = f.id AND m.key = 'scan.metadata'
         )
         AND COALESCE((
           SELECT CAST(m.value AS INTEGER) FROM file_metadata m
           WHERE m.file_id = f.id AND m.key = 'scan.metadataVersion'
           LIMIT 1
         ), 0) < ?`,
    )
    .get(METADATA_EXTRACTOR_VERSION) as { count: number } | undefined;
  return row?.count ?? 0;
}

export function getLibrarySummary(db: Database.Database): LibrarySummary {
  const row = readSummaryCounts(db);
  return {
    totalItems: row?.total ?? 0,
    photoCount: row?.photos ?? 0,
    videoCount: row?.videos ?? 0,
    indexedBytes: row?.bytes ?? 0,
    undatedCount: readUndatedCount(db),
    lastScanAt: readLastScanAt(db),
    metadataRefreshCount: readMetadataRefreshCount(db),
  };
}

export interface TimelineQuery {
  filter: LibraryFilter;
  cursor: string | null;
  year: number | null;
  month: number | null;
  limit: number;
}

export function getLibraryTimeline(
  db: Database.Database,
  query: TimelineQuery,
): LibraryTimelinePage {
  const cursor = query.cursor === null ? null : decodeCursor(query.cursor);
  const where = buildTimelineWhere(query.filter, cursor, query.year, query.month);
  const rows = db
    .prepare(
      `${LIBRARY_SELECT}
       WHERE ${where.sql}
       ORDER BY fd.resolved_date DESC, f.id DESC
       LIMIT ?`,
    )
    .all(...where.params, query.limit + 1);

  const items = rows.map((row) => toLibraryItem(parseLibraryRow(row)));
  const pageItems = items.slice(0, query.limit);
  const last = pageItems[pageItems.length - 1];
  const nextCursor =
    items.length > query.limit && last !== undefined
      ? encodeCursor({ date: last.date.value, id: last.fileId })
      : null;

  return LibraryTimelinePageSchema.parse({
    items: pageItems,
    nextCursor,
    total: countLibraryItems(db, query.filter),
  });
}

export function getLibraryTimelineIndex(
  db: Database.Database,
  filter: LibraryFilter,
): LibraryTimelineIndex {
  const rows = db
    .prepare(
      `SELECT
         CAST(substr(fd.resolved_date, 1, 4) AS INTEGER) AS year,
         CAST(substr(fd.resolved_date, 6, 2) AS INTEGER) AS month,
         COUNT(*) AS count
       FROM files f
       JOIN file_dates fd ON fd.file_id = f.id
       WHERE ${filterCondition(filter)} AND fd.resolved_date IS NOT NULL
       GROUP BY year, month
       ORDER BY year DESC, month DESC`,
    )
    .all() as LibraryMonth[];

  return LibraryTimelineIndexSchema.parse({ months: rows });
}
