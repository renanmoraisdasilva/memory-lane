import type { CatalogSummary, DriveInfo } from "./drives";
import type {
  AppInfo,
  ConfirmDriveIdentityParams,
  InitializeCatalogParams,
  IpcResult,
  OpenCatalogParams,
} from "./ipc";
import type {
  LibraryItemDetails,
  LibraryItemParams,
  LibraryItemTargetParams,
  LibrarySummary,
  LibraryTimelineIndex,
  LibraryTimelineIndexParams,
  LibraryTimelinePage,
  LibraryTimelineParams,
} from "./library";
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
  getLibrarySummary(): Promise<IpcResult<LibrarySummary>>;
  getLibraryTimeline(params: LibraryTimelineParams): Promise<IpcResult<LibraryTimelinePage>>;
  getLibraryTimelineIndex(
    params: LibraryTimelineIndexParams,
  ): Promise<IpcResult<LibraryTimelineIndex>>;
  getLibraryItem(params: LibraryItemParams): Promise<IpcResult<LibraryItemDetails>>;
  revealLibraryItem(params: LibraryItemTargetParams): Promise<IpcResult<void>>;
  openLibraryItem(params: LibraryItemTargetParams): Promise<IpcResult<void>>;
}
