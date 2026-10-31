import type { CatalogSummary, DriveInfo } from "@shared/contracts/drives";
import type { IpcResult } from "@shared/contracts/ipc";
import type { MemoryLaneApi } from "@shared/contracts/api";
import type { ScanIntensity, ScanState } from "@shared/contracts/scan";
import { AppError, APP_ERROR_CODES } from "@shared/domain/errors";

function getApi(): MemoryLaneApi {
  if (window.memoryLane === undefined) {
    throw new AppError(
      APP_ERROR_CODES.INTERNAL,
      "The Memory Lane bridge is unavailable. Restart the application.",
    );
  }
  return window.memoryLane;
}

async function unwrap<T>(resultPromise: Promise<IpcResult<T>>): Promise<T> {
  const result = await resultPromise;
  if (!result.ok) {
    throw new AppError(result.error.code, result.error.message, result.error.details);
  }
  return result.data;
}

export const api = {
  getAppInfo: () => unwrap(getApi().getAppInfo()),
  listDrives: () => unwrap(getApi().listDrives()),
  initializeCatalog: (volumeId: DriveInfo["volumeId"]): Promise<CatalogSummary> =>
    unwrap(getApi().initializeCatalog({ volumeId })),
  openCatalog: (volumeId: DriveInfo["volumeId"]): Promise<CatalogSummary> =>
    unwrap(getApi().openCatalog({ volumeId })),
  confirmDriveIdentity: (volumeId: DriveInfo["volumeId"]): Promise<void> =>
    unwrap(getApi().confirmDriveIdentity({ volumeId })),
  getScanState: (volumeId: DriveInfo["volumeId"]): Promise<ScanState> =>
    unwrap(getApi().getScanState({ volumeId })),
  startScan: (volumeId: DriveInfo["volumeId"], intensity?: ScanIntensity): Promise<ScanState> =>
    unwrap(getApi().startScan(intensity === undefined ? { volumeId } : { volumeId, intensity })),
  pauseScan: (volumeId: DriveInfo["volumeId"]): Promise<ScanState> =>
    unwrap(getApi().pauseScan({ volumeId })),
  resumeScan: (volumeId: DriveInfo["volumeId"]): Promise<ScanState> =>
    unwrap(getApi().resumeScan({ volumeId })),
  setScanIntensity: (
    volumeId: DriveInfo["volumeId"],
    intensity: ScanIntensity,
  ): Promise<ScanState> => unwrap(getApi().setScanIntensity({ volumeId, intensity })),
};
