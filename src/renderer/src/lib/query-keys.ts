export const queryKeys = {
  appInfo: ["app-info"] as const,
  drives: ["drives"] as const,
  scan: (volumeId: string) => ["scan", volumeId] as const,
  librarySummary: ["library", "summary"] as const,
  libraryTimeline: (filter: string, year: number | null, month: number | null) =>
    ["library", "timeline", filter, year, month] as const,
  libraryTimelineIndex: (filter: string) => ["library", "timeline-index", filter] as const,
  libraryItem: (fileId: number, filter: string) => ["library", "item", fileId, filter] as const,
  libraryUndated: ["library", "undated"] as const,
  otherFiles: (category: string, offset: number, limit: number) =>
    ["other-files", category, offset, limit] as const,
  settingsInfo: ["settings", "info"] as const,
  healthSummary: ["health", "summary"] as const,
  healthDuplicates: (offset: number, limit: number) =>
    ["health", "duplicates", offset, limit] as const,
  healthMissing: (offset: number, limit: number) => ["health", "missing", offset, limit] as const,
  healthMoved: ["health", "moved"] as const,
  healthValidation: ["health", "validation"] as const,
  replicationOverview: ["replication", "overview"] as const,
  replicationPlan: ["replication", "plan"] as const,
  replicationDestinations: ["replication", "destinations"] as const,
  replicationDestination: (destinationId: string) =>
    ["replication", "destination", destinationId] as const,
  replicationAdoption: (destinationId: string) =>
    ["replication", "adoption", destinationId] as const,
  replicationCoverage: ["replication", "coverage"] as const,
  replicationRun: ["replication", "run"] as const,
  replicationRunEvents: (runId: number) => ["replication", "run-events", runId] as const,
};
