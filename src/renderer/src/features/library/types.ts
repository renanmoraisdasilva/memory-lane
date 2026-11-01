export type {
  LibraryClearDateParams,
  LibraryDate,
  LibraryDateMutationResult,
  LibraryFilter,
  LibraryItem,
  LibraryItemDetails,
  LibraryMetadataEntry,
  LibraryMonth,
  LibrarySetDateParams,
  LibrarySummary,
  LibraryTimelineIndex,
  LibraryTimelinePage,
  LibraryTimelineParams,
  LibraryUndatedItem,
  LibraryUndatedPage,
  LibraryUndatedParams,
  ThumbnailStatus,
  TimelinePrecision,
  VideoProxyPrepareParams,
  VideoProxyState,
} from "@shared/contracts/library";

export type LibraryDensity = "comfortable" | "dense";

export type PeriodAnchor =
  { kind: "year"; year: number } | { kind: "month"; year: number; month: number } | null;
