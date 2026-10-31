import type { CatalogSummary, DriveInfo } from "./drives";
import type {
  AppInfo,
  ConfirmDriveIdentityParams,
  InitializeCatalogParams,
  IpcResult,
  OpenCatalogParams,
} from "./ipc";
import type { ScanIntensityParams, ScanStartParams, ScanState, ScanVolumeParams } from "./scan";

export interface MemoryLaneApi {
  getAppInfo(): Promise<IpcResult<AppInfo>>;
  listDrives(): Promise<IpcResult<DriveInfo[]>>;
  initializeCatalog(params: InitializeCatalogParams): Promise<IpcResult<CatalogSummary>>;
  openCatalog(params: OpenCatalogParams): Promise<IpcResult<CatalogSummary>>;
  confirmDriveIdentity(params: ConfirmDriveIdentityParams): Promise<IpcResult<void>>;
  getScanState(params: ScanVolumeParams): Promise<IpcResult<ScanState>>;
  startScan(params: ScanStartParams): Promise<IpcResult<ScanState>>;
  pauseScan(params: ScanVolumeParams): Promise<IpcResult<ScanState>>;
  resumeScan(params: ScanVolumeParams): Promise<IpcResult<ScanState>>;
  setScanIntensity(params: ScanIntensityParams): Promise<IpcResult<ScanState>>;
}
