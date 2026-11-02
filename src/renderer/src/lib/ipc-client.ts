import type { CatalogSummary, DriveInfo } from "@shared/contracts/drives";
import type { IpcResult } from "@shared/contracts/ipc";
import type { MemoryLaneApi } from "@shared/contracts/api";
import type {
  DuplicateGroupsPage,
  DuplicateGroupsParams,
  HealthSummary,
  MissingDuplicatesPage,
  MissingDuplicatesParams,
  MissingFilesPage,
  MissingFilesParams,
  MovedActionResult,
  MovedCandidateTargets,
  MovedCandidatesPage,
  MovedCandidatesParams,
  PurgeMissingDuplicatesParams,
  PurgeMissingDuplicatesResult,
  ValidationStartParams,
  ValidationState,
} from "@shared/contracts/health";
import type {
  LibraryClearDateParams,
  LibraryDateMutationResult,
  LibraryFilter,
  LibraryItemDetails,
  LibrarySetDateParams,
  LibrarySummary,
  LibraryTimelineIndex,
  LibraryTimelinePage,
  LibraryTimelineParams,
  LibraryUndatedPage,
  LibraryUndatedParams,
  VideoProxyPrepareParams,
  VideoProxyState,
} from "@shared/contracts/library";
import type { OtherFilesPage, OtherFilesParams } from "@shared/contracts/other-files";
import type {
  AdoptionState,
  CoverageSummary,
  DestinationCandidate,
  DestinationDetail,
  DestinationSummary,
  RegisterDestinationParams,
  ReplicationOverview,
  ReplicationPlan,
  ReplicationRunState,
  RunEventsPage,
  RunEventsParams,
  StartRunParams,
  UpdateDestinationParams,
} from "@shared/contracts/replication/types";
import type {
  ApplyPromotionParams,
  PromotionState,
  RollbackPromotionParams,
  VerifyPromotionParams,
} from "@shared/contracts/replication/promotion-types";
import type { BackupResult, CacheClearResult, SettingsInfo } from "@shared/contracts/settings";
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
  getLibrarySummary: (): Promise<LibrarySummary> => unwrap(getApi().getLibrarySummary()),
  getLibraryTimeline: (params: LibraryTimelineParams): Promise<LibraryTimelinePage> =>
    unwrap(getApi().getLibraryTimeline(params)),
  getLibraryTimelineIndex: (filter: LibraryFilter): Promise<LibraryTimelineIndex> =>
    unwrap(getApi().getLibraryTimelineIndex({ filter })),
  getLibraryItem: (fileId: number, filter?: LibraryFilter): Promise<LibraryItemDetails> =>
    unwrap(getApi().getLibraryItem(filter === undefined ? { fileId } : { fileId, filter })),
  getLibraryUndated: (params: LibraryUndatedParams): Promise<LibraryUndatedPage> =>
    unwrap(getApi().getLibraryUndated(params)),
  getOtherFiles: (params: OtherFilesParams): Promise<OtherFilesPage> =>
    unwrap(getApi().getOtherFiles(params)),
  setLibraryDate: (params: LibrarySetDateParams): Promise<LibraryDateMutationResult> =>
    unwrap(getApi().setLibraryDate(params)),
  clearLibraryDate: (params: LibraryClearDateParams): Promise<LibraryDateMutationResult> =>
    unwrap(getApi().clearLibraryDate(params)),
  getHealthSummary: (): Promise<HealthSummary> => unwrap(getApi().getHealthSummary()),
  getHealthDuplicates: (params: DuplicateGroupsParams): Promise<DuplicateGroupsPage> =>
    unwrap(getApi().getHealthDuplicates(params)),
  getHealthMissing: (params: MissingFilesParams): Promise<MissingFilesPage> =>
    unwrap(getApi().getHealthMissing(params)),
  getHealthMissingDuplicates: (params: MissingDuplicatesParams): Promise<MissingDuplicatesPage> =>
    unwrap(getApi().getHealthMissingDuplicates(params)),
  purgeHealthMissingDuplicates: (
    params: PurgeMissingDuplicatesParams,
  ): Promise<PurgeMissingDuplicatesResult> => unwrap(getApi().purgeHealthMissingDuplicates(params)),
  getHealthMoved: (params: MovedCandidatesParams): Promise<MovedCandidatesPage> =>
    unwrap(getApi().getHealthMoved(params)),
  confirmHealthMoved: (params: MovedCandidateTargets): Promise<MovedActionResult> =>
    unwrap(getApi().confirmHealthMoved(params)),
  dismissHealthMoved: (params: MovedCandidateTargets): Promise<MovedActionResult> =>
    unwrap(getApi().dismissHealthMoved(params)),
  getValidationState: (): Promise<ValidationState> => unwrap(getApi().getValidationState()),
  startValidation: (params: ValidationStartParams): Promise<ValidationState> =>
    unwrap(getApi().startValidation(params)),
  pauseValidation: (): Promise<ValidationState> => unwrap(getApi().pauseValidation()),
  resumeValidation: (): Promise<ValidationState> => unwrap(getApi().resumeValidation()),
  getSettingsInfo: (): Promise<SettingsInfo> => unwrap(getApi().getSettingsInfo()),
  clearCache: (): Promise<CacheClearResult> => unwrap(getApi().clearCache()),
  runBackup: (): Promise<BackupResult> => unwrap(getApi().runBackup()),
  revealLibraryItem: (fileId: number): Promise<void> =>
    unwrap(getApi().revealLibraryItem({ fileId })),
  openLibraryItem: (fileId: number): Promise<void> => unwrap(getApi().openLibraryItem({ fileId })),
  getVideoProxyState: (fileId: number): Promise<VideoProxyState> =>
    unwrap(getApi().getVideoProxyState({ fileId })),
  prepareVideoProxy: (params: VideoProxyPrepareParams): Promise<VideoProxyState> =>
    unwrap(getApi().prepareVideoProxy(params)),
  replication: {
    getOverview: (): Promise<ReplicationOverview> => unwrap(getApi().replication.getOverview()),
    listDestinationCandidates: (): Promise<DestinationCandidate[]> =>
      unwrap(getApi().replication.listDestinationCandidates()),
    listDestinations: (): Promise<DestinationSummary[]> =>
      unwrap(getApi().replication.listDestinations()),
    getDestination: (destinationId: string): Promise<DestinationDetail> =>
      unwrap(getApi().replication.getDestination(destinationId)),
    registerDestination: (params: RegisterDestinationParams): Promise<DestinationDetail> =>
      unwrap(getApi().replication.registerDestination(params)),
    updateDestination: (params: UpdateDestinationParams): Promise<DestinationDetail> =>
      unwrap(getApi().replication.updateDestination(params)),
    getAdoptionState: (destinationId: string): Promise<AdoptionState> =>
      unwrap(getApi().replication.getAdoptionState(destinationId)),
    getActiveAdoptions: (): Promise<AdoptionState[]> =>
      unwrap(getApi().replication.getActiveAdoptions()),
    startAdoption: (destinationId: string): Promise<AdoptionState> =>
      unwrap(getApi().replication.startAdoption(destinationId)),
    pauseAdoption: (destinationId: string): Promise<AdoptionState> =>
      unwrap(getApi().replication.pauseAdoption(destinationId)),
    resumeAdoption: (destinationId: string): Promise<AdoptionState> =>
      unwrap(getApi().replication.resumeAdoption(destinationId)),
    getPlan: (): Promise<ReplicationPlan> => unwrap(getApi().replication.getPlan()),
    getCoverage: (): Promise<CoverageSummary> => unwrap(getApi().replication.getCoverage()),
    getRunState: (): Promise<ReplicationRunState | null> =>
      unwrap(getApi().replication.getRunState()),
    startRun: (params: StartRunParams): Promise<ReplicationRunState> =>
      unwrap(getApi().replication.startRun(params)),
    pauseRun: (): Promise<ReplicationRunState> => unwrap(getApi().replication.pauseRun()),
    resumeRun: (): Promise<ReplicationRunState> => unwrap(getApi().replication.resumeRun()),
    requestStop: (): Promise<ReplicationRunState> => unwrap(getApi().replication.requestStop()),
    replan: (): Promise<ReplicationRunState | null> => unwrap(getApi().replication.replan()),
    getRunEvents: (params: RunEventsParams): Promise<RunEventsPage> =>
      unwrap(getApi().replication.getRunEvents(params)),
    getPromotion: (destinationId: string): Promise<PromotionState> =>
      unwrap(getApi().replication.getPromotion(destinationId)),
    verifyPromotion: (params: VerifyPromotionParams): Promise<PromotionState> =>
      unwrap(getApi().replication.verifyPromotion(params)),
    applyPromotion: (params: ApplyPromotionParams): Promise<PromotionState> =>
      unwrap(getApi().replication.applyPromotion(params)),
    rollbackPromotion: (params: RollbackPromotionParams): Promise<PromotionState> =>
      unwrap(getApi().replication.rollbackPromotion(params)),
  },
};
