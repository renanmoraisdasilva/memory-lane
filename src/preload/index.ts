import { contextBridge, ipcRenderer } from "electron";
import type { MemoryLaneApi } from "@shared/contracts/api";
import { IPC_CHANNELS } from "@shared/contracts/channels";
import type { CatalogSummary, DriveInfo } from "@shared/contracts/drives";
import type {
  AppInfo,
  ConfirmDriveIdentityParams,
  InitializeCatalogParams,
  IpcResult,
  OpenCatalogParams,
} from "@shared/contracts/ipc";
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
} from "@shared/contracts/health";
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
} from "@shared/contracts/library";
import type { OtherFilesPage, OtherFilesParams } from "@shared/contracts/other-files";
import type { BackupResult, CacheClearResult, SettingsInfo } from "@shared/contracts/settings";
import { REPLICATION_CHANNELS } from "@shared/contracts/replication/channels";
import type {
  AdoptionState,
  CoverageSummary,
  DestinationCandidate,
  DestinationDetail,
  DestinationSummary,
  RegisterDestinationParams,
  ReplicationOverview,
  ReplicationPlan,
  UpdateDestinationParams,
} from "@shared/contracts/replication/types";
import type {
  ScanIntensityParams,
  ScanStartParams,
  ScanState,
  ScanVolumeParams,
} from "@shared/contracts/scan";

const api: MemoryLaneApi = {
  getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.getAppInfo) as Promise<IpcResult<AppInfo>>,
  listDrives: () => ipcRenderer.invoke(IPC_CHANNELS.listDrives) as Promise<IpcResult<DriveInfo[]>>,
  initializeCatalog: (params: InitializeCatalogParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.initializeCatalog, params) as Promise<
      IpcResult<CatalogSummary>
    >,
  openCatalog: (params: OpenCatalogParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.openCatalog, params) as Promise<IpcResult<CatalogSummary>>,
  confirmDriveIdentity: (params: ConfirmDriveIdentityParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.confirmDriveIdentity, params) as Promise<IpcResult<void>>,
  getScanState: (params: ScanVolumeParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.getScanState, params) as Promise<IpcResult<ScanState>>,
  startScan: (params: ScanStartParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.startScan, params) as Promise<IpcResult<ScanState>>,
  pauseScan: (params: ScanVolumeParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.pauseScan, params) as Promise<IpcResult<ScanState>>,
  resumeScan: (params: ScanVolumeParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.resumeScan, params) as Promise<IpcResult<ScanState>>,
  setScanIntensity: (params: ScanIntensityParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.setScanIntensity, params) as Promise<IpcResult<ScanState>>,
  getLibrarySummary: () =>
    ipcRenderer.invoke(IPC_CHANNELS.getLibrarySummary) as Promise<IpcResult<LibrarySummary>>,
  getLibraryTimeline: (params: LibraryTimelineParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.getLibraryTimeline, params) as Promise<
      IpcResult<LibraryTimelinePage>
    >,
  getLibraryTimelineIndex: (params: LibraryTimelineIndexParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.getLibraryTimelineIndex, params) as Promise<
      IpcResult<LibraryTimelineIndex>
    >,
  getLibraryItem: (params: LibraryItemParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.getLibraryItem, params) as Promise<
      IpcResult<LibraryItemDetails>
    >,
  getLibraryUndated: (params: LibraryUndatedParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.getLibraryUndated, params) as Promise<
      IpcResult<LibraryUndatedPage>
    >,
  getOtherFiles: (params: OtherFilesParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.getOtherFiles, params) as Promise<IpcResult<OtherFilesPage>>,
  setLibraryDate: (params: LibrarySetDateParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.setLibraryDate, params) as Promise<
      IpcResult<LibraryDateMutationResult>
    >,
  clearLibraryDate: (params: LibraryClearDateParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.clearLibraryDate, params) as Promise<
      IpcResult<LibraryDateMutationResult>
    >,
  getHealthSummary: () =>
    ipcRenderer.invoke(IPC_CHANNELS.getHealthSummary) as Promise<IpcResult<HealthSummary>>,
  getHealthDuplicates: (params: DuplicateGroupsParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.getHealthDuplicates, params) as Promise<
      IpcResult<DuplicateGroupsPage>
    >,
  getHealthMissing: (params: MissingFilesParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.getHealthMissing, params) as Promise<
      IpcResult<MissingFilesPage>
    >,
  getHealthMoved: () =>
    ipcRenderer.invoke(IPC_CHANNELS.getHealthMoved) as Promise<IpcResult<MovedCandidatesPage>>,
  confirmHealthMoved: (params: MovedCandidateTargets) =>
    ipcRenderer.invoke(IPC_CHANNELS.confirmHealthMoved, params) as Promise<
      IpcResult<MovedActionResult>
    >,
  dismissHealthMoved: (params: MovedCandidateTargets) =>
    ipcRenderer.invoke(IPC_CHANNELS.dismissHealthMoved, params) as Promise<
      IpcResult<MovedActionResult>
    >,
  getValidationState: () =>
    ipcRenderer.invoke(IPC_CHANNELS.getValidationState) as Promise<IpcResult<ValidationState>>,
  startValidation: (params: ValidationStartParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.startValidation, params) as Promise<IpcResult<ValidationState>>,
  pauseValidation: () =>
    ipcRenderer.invoke(IPC_CHANNELS.pauseValidation) as Promise<IpcResult<ValidationState>>,
  resumeValidation: () =>
    ipcRenderer.invoke(IPC_CHANNELS.resumeValidation) as Promise<IpcResult<ValidationState>>,
  getSettingsInfo: () =>
    ipcRenderer.invoke(IPC_CHANNELS.getSettingsInfo) as Promise<IpcResult<SettingsInfo>>,
  clearCache: () =>
    ipcRenderer.invoke(IPC_CHANNELS.clearCache) as Promise<IpcResult<CacheClearResult>>,
  runBackup: () => ipcRenderer.invoke(IPC_CHANNELS.runBackup) as Promise<IpcResult<BackupResult>>,
  revealLibraryItem: (params: LibraryItemTargetParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.revealLibraryItem, params) as Promise<IpcResult<void>>,
  openLibraryItem: (params: LibraryItemTargetParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.openLibraryItem, params) as Promise<IpcResult<void>>,
  replication: {
    getOverview: () =>
      ipcRenderer.invoke(REPLICATION_CHANNELS.getOverview) as Promise<
        IpcResult<ReplicationOverview>
      >,
    listDestinationCandidates: () =>
      ipcRenderer.invoke(REPLICATION_CHANNELS.listDestinationCandidates) as Promise<
        IpcResult<DestinationCandidate[]>
      >,
    listDestinations: () =>
      ipcRenderer.invoke(REPLICATION_CHANNELS.listDestinations) as Promise<
        IpcResult<DestinationSummary[]>
      >,
    getDestination: (destinationId: string) =>
      ipcRenderer.invoke(REPLICATION_CHANNELS.getDestination, { destinationId }) as Promise<
        IpcResult<DestinationDetail>
      >,
    registerDestination: (params: RegisterDestinationParams) =>
      ipcRenderer.invoke(REPLICATION_CHANNELS.registerDestination, params) as Promise<
        IpcResult<DestinationDetail>
      >,
    updateDestination: (params: UpdateDestinationParams) =>
      ipcRenderer.invoke(REPLICATION_CHANNELS.updateDestination, params) as Promise<
        IpcResult<DestinationDetail>
      >,
    getAdoptionState: (destinationId: string) =>
      ipcRenderer.invoke(REPLICATION_CHANNELS.getAdoptionState, { destinationId }) as Promise<
        IpcResult<AdoptionState>
      >,
    startAdoption: (destinationId: string) =>
      ipcRenderer.invoke(REPLICATION_CHANNELS.startAdoption, { destinationId }) as Promise<
        IpcResult<AdoptionState>
      >,
    pauseAdoption: (destinationId: string) =>
      ipcRenderer.invoke(REPLICATION_CHANNELS.pauseAdoption, { destinationId }) as Promise<
        IpcResult<AdoptionState>
      >,
    resumeAdoption: (destinationId: string) =>
      ipcRenderer.invoke(REPLICATION_CHANNELS.resumeAdoption, { destinationId }) as Promise<
        IpcResult<AdoptionState>
      >,
    getPlan: () =>
      ipcRenderer.invoke(REPLICATION_CHANNELS.getPlan) as Promise<IpcResult<ReplicationPlan>>,
    getCoverage: () =>
      ipcRenderer.invoke(REPLICATION_CHANNELS.getCoverage) as Promise<IpcResult<CoverageSummary>>,
  },
};

contextBridge.exposeInMainWorld("memoryLane", api);
