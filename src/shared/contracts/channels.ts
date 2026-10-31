export const IPC_CHANNELS = {
  getAppInfo: "app:get-info",
  listDrives: "drives:list",
  initializeCatalog: "catalog:initialize",
  openCatalog: "catalog:open",
  confirmDriveIdentity: "drives:confirm-identity",
  getScanState: "scan:get-state",
  startScan: "scan:start",
  pauseScan: "scan:pause",
  resumeScan: "scan:resume",
  setScanIntensity: "scan:set-intensity",
} as const;
