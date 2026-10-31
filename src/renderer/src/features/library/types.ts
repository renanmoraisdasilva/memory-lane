/**
 * Renderer-side Phase 2 library view model.
 *
 * Agent A owns the real contract in `src/shared/contracts/library.ts`. That
 * file does not exist yet, so this module mirrors the proposed shapes from
 * `docs/phase-2-scope.md` only to keep the UI typed while it is built and
 * tested. Replace these imports with the shared contract when it lands.
 * No IPC channel, Zod schema, or production mock lives here.
 */

export type LibraryFilter = "all" | "photos" | "videos";
export type LibraryDensity = "comfortable" | "dense";
export type TimelinePrecision = "year" | "month" | "exact";
export type ThumbnailStatus = "pending" | "ready" | "failed";
export type MediaClass = "image" | "video";

export type PeriodAnchor =
  { kind: "year"; year: number } | { kind: "month"; year: number; month: number } | null;

export interface LibraryDate {
  value: string | null;
  precision: TimelinePrecision | null;
  source: string | null;
}

export interface LibraryItem {
  fileId: number;
  name: string;
  mediaClass: MediaClass;
  format: string | null;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  date: LibraryDate;
  thumbnailStatus: ThumbnailStatus;
  thumbnailUrl: string | null;
  isMissing: boolean;
}

export interface LibrarySummary {
  totalItems: number;
  photoCount: number;
  videoCount: number;
  indexedBytes: number;
  undatedCount: number;
  lastScanAt: string | null;
}

export interface LibraryMonth {
  year: number;
  month: number;
  count: number;
}

export interface LibraryTimelinePage {
  items: LibraryItem[];
  nextCursor: string | null;
  total: number;
}

export interface LibraryItemDetails {
  item: LibraryItem;
  path: string;
  folder: string;
  createdAtFs: string | null;
  modifiedAtFs: string;
  metadata: Array<{ key: string; value: string; source: string }>;
  position: number;
  total: number;
  previousFileId: number | null;
  nextFileId: number | null;
  mediaUrl: string | null;
}

export interface LibraryTimelineParams {
  filter: LibraryFilter;
  cursor?: string;
  year?: number;
  month?: number;
  limit?: number;
}

export interface LibraryTimelineIndex {
  months: LibraryMonth[];
}
