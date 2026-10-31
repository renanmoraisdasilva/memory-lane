import type { CatalogSummary, DriveInfo } from "./drives";
import type {
  AppInfo,
  ConfirmDriveIdentityParams,
  InitializeCatalogParams,
  IpcResult,
  OpenCatalogParams,
} from "./ipc";
import type {
  LibraryClearDateParams,
  LibraryDateMutationResult,
  LibraryItemDetails,
  LibraryItemParams,
  LibraryItemTargetParams,
  LibrarySetDateParams,
  LibrarySummary,
  LibraryTimelineIndex,
  LibraryTimelineIndexParams,
  LibraryTimelinePage,
  LibraryTimelineParams,
  LibraryUndatedPage,
  LibraryUndatedParams,
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
  getLibraryUndated(params: LibraryUndatedParams): Promise<IpcResult<LibraryUndatedPage>>;
  setLibraryDate(params: LibrarySetDateParams): Promise<IpcResult<LibraryDateMutationResult>>;
  clearLibraryDate(params: LibraryClearDateParams): Promise<IpcResult<LibraryDateMutationResult>>;
  revealLibraryItem(params: LibraryItemTargetParams): Promise<IpcResult<void>>;
  openLibraryItem(params: LibraryItemTargetParams): Promise<IpcResult<void>>;
}
