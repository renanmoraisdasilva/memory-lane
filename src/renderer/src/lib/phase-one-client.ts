import type { CatalogSummary, VolumeId } from "@shared/contracts/drives";
import type { AppInfo } from "@shared/contracts/ipc";
import type { DriveSelectionItem } from "../features/drives/types";
import { toDriveSelectionItem } from "../features/drives/types";
import type { ScanApi } from "../features/scan/types";
import { api } from "./ipc-client";

/**
 * One typed surface for everything the Phase 1 renderer needs. Drive, catalog,
 * identity-confirmation, and scan calls all go through the real preload bridge.
 */
export interface PhaseOneClient extends ScanApi {
  getAppInfo(): Promise<AppInfo>;
  listDrives(): Promise<DriveSelectionItem[]>;
  initializeCatalog(volumeId: VolumeId): Promise<CatalogSummary>;
  openCatalog(volumeId: VolumeId): Promise<CatalogSummary>;
  confirmDriveLetter(volumeId: VolumeId): Promise<void>;
}

export function createDefaultPhaseOneClient(): PhaseOneClient {
  return {
    getAppInfo: () => api.getAppInfo(),
    listDrives: async () => {
      const drives = await api.listDrives();
      return drives.map(toDriveSelectionItem);
    },
    initializeCatalog: (volumeId) => api.initializeCatalog(volumeId),
    openCatalog: (volumeId) => api.openCatalog(volumeId),
    confirmDriveLetter: (volumeId) => api.confirmDriveIdentity(volumeId),
    getScanState: (volumeId) => api.getScanState(volumeId),
    startScan: (volumeId, intensity) => api.startScan(volumeId, intensity),
    pauseScan: (volumeId) => api.pauseScan(volumeId),
    resumeScan: (volumeId) => api.resumeScan(volumeId),
    setScanIntensity: (volumeId, intensity) => api.setScanIntensity(volumeId, intensity),
  };
}
