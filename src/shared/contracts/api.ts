import type { CatalogSummary, DriveInfo } from "./drives";
import type {
  AppInfo,
  ConfirmDriveIdentityParams,
  InitializeCatalogParams,
  IpcResult,
  OpenCatalogParams,
} from "./ipc";
import type {
  DuplicateGroupsPage,
  DuplicateGroupsParams,
  HealthSummary,
  MissingFilesPage,
  MissingFilesParams,
  MovedActionResult,
  MovedCandidateTargets,
  MovedCandidatesPage,
  ValidationStartParams,
  ValidationState,
} from "./health";
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
import type { OtherFilesPage, OtherFilesParams } from "./other-files";
import type { BackupResult, CacheClearResult, SettingsInfo } from "./settings";
import type { ScanIntensityParams, ScanStartParams, ScanState, ScanVolumeParams } from "./scan";
import type { ReplicationApi } from "./replication/api";

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
  getOtherFiles(params: OtherFilesParams): Promise<IpcResult<OtherFilesPage>>;
  setLibraryDate(params: LibrarySetDateParams): Promise<IpcResult<LibraryDateMutationResult>>;
  clearLibraryDate(params: LibraryClearDateParams): Promise<IpcResult<LibraryDateMutationResult>>;
  getHealthSummary(): Promise<IpcResult<HealthSummary>>;
  getHealthDuplicates(params: DuplicateGroupsParams): Promise<IpcResult<DuplicateGroupsPage>>;
  getHealthMissing(params: MissingFilesParams): Promise<IpcResult<MissingFilesPage>>;
  getHealthMoved(): Promise<IpcResult<MovedCandidatesPage>>;
  confirmHealthMoved(params: MovedCandidateTargets): Promise<IpcResult<MovedActionResult>>;
  dismissHealthMoved(params: MovedCandidateTargets): Promise<IpcResult<MovedActionResult>>;
  getValidationState(): Promise<IpcResult<ValidationState>>;
  startValidation(params: ValidationStartParams): Promise<IpcResult<ValidationState>>;
  pauseValidation(): Promise<IpcResult<ValidationState>>;
  resumeValidation(): Promise<IpcResult<ValidationState>>;
  getSettingsInfo(): Promise<IpcResult<SettingsInfo>>;
  clearCache(): Promise<IpcResult<CacheClearResult>>;
  runBackup(): Promise<IpcResult<BackupResult>>;
  revealLibraryItem(params: LibraryItemTargetParams): Promise<IpcResult<void>>;
  openLibraryItem(params: LibraryItemTargetParams): Promise<IpcResult<void>>;
  replication: ReplicationApi;
}
