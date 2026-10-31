import type { CatalogSummary, VolumeId } from "@shared/contracts/drives";
import type { AppInfo } from "@shared/contracts/ipc";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { DriveSelectionItem } from "../features/drives/types";
import { toDriveSelectionItem } from "../features/drives/types";
import type { ScanApi } from "../features/scan/types";
import { createMockScanController } from "./mock-scan-controller";
import { api } from "./ipc-client";

/**
 * One typed surface for everything the Phase 1 renderer needs. Drive and
 * catalog calls use the frozen Phase 0 IPC bridge; scan calls are backed by the
 * mock controller until Platform/Core freezes the scan IPC contract.
 */
export interface PhaseOneClient extends ScanApi {
  getAppInfo(): Promise<AppInfo>;
  listDrives(): Promise<DriveSelectionItem[]>;
  initializeCatalog(volumeId: VolumeId): Promise<CatalogSummary>;
  openCatalog(volumeId: VolumeId): Promise<CatalogSummary>;
  confirmDriveLetter(volumeId: VolumeId): Promise<void>;
}

export function createDefaultPhaseOneClient(): PhaseOneClient {
  const scans = createMockScanController({ autoAdvance: true });

  return {
    getAppInfo: () => api.getAppInfo(),
    listDrives: async () => {
      const drives = await api.listDrives();
      return drives.map(toDriveSelectionItem);
    },
    initializeCatalog: (volumeId) => api.initializeCatalog(volumeId),
    openCatalog: (volumeId) => api.openCatalog(volumeId),
    confirmDriveLetter: () =>
      Promise.reject(
        new AppError(
          APP_ERROR_CODES.FORBIDDEN,
          "Changed drive letters are not available until the backend exposes volume relocation.",
        ),
      ),
    ...scans,
  };
}
