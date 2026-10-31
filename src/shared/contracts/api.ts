import type { CatalogSummary, DriveInfo } from "./drives";
import type { AppInfo, IpcResult, InitializeCatalogParams, OpenCatalogParams } from "./ipc";

export interface MemoryLaneApi {
  getAppInfo(): Promise<IpcResult<AppInfo>>;
  listDrives(): Promise<IpcResult<DriveInfo[]>>;
  initializeCatalog(params: InitializeCatalogParams): Promise<IpcResult<CatalogSummary>>;
  openCatalog(params: OpenCatalogParams): Promise<IpcResult<CatalogSummary>>;
}
