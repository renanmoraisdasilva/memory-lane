import type { CatalogSummary, DriveInfo } from "@shared/contracts/drives";
import type { IpcResult } from "@shared/contracts/ipc";
import type { MemoryLaneApi } from "@shared/contracts/api";
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
};
