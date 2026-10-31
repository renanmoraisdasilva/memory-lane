export type {
  LibraryDate,
  LibraryFilter,
  LibraryItem,
  LibraryItemDetails,
  LibraryMetadataEntry,
  LibraryMonth,
  LibrarySummary,
  LibraryTimelineIndex,
  LibraryTimelinePage,
  LibraryTimelineParams,
  ThumbnailStatus,
  TimelinePrecision,
} from "@shared/contracts/library";

export type LibraryDensity = "comfortable" | "dense";

export type PeriodAnchor =
  { kind: "year"; year: number } | { kind: "month"; year: number; month: number } | null;
