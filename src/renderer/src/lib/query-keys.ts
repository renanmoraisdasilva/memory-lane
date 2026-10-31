export const queryKeys = {
  appInfo: ["app-info"] as const,
  drives: ["drives"] as const,
  scan: (volumeId: string) => ["scan", volumeId] as const,
};
