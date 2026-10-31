export const queryKeys = {
  appInfo: ["app-info"] as const,
  drives: ["drives"] as const,
  scan: (volumeId: string) => ["scan", volumeId] as const,
  librarySummary: ["library", "summary"] as const,
  libraryTimeline: (filter: string, year: number | null, month: number | null) =>
    ["library", "timeline", filter, year, month] as const,
  libraryTimelineIndex: (filter: string) => ["library", "timeline-index", filter] as const,
  libraryItem: (fileId: number, filter: string) => ["library", "item", fileId, filter] as const,
};
