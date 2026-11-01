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
} from "./types";
import type { OtherFilesPage, OtherFilesParams } from "@shared/contracts/other-files";
import type { BackupResult, CacheClearResult, SettingsInfo } from "@shared/contracts/settings";
import { api } from "../../lib/ipc-client";

export interface LibraryClient {
  getSummary(): Promise<LibrarySummary>;
  getTimeline(params: LibraryTimelineParams): Promise<LibraryTimelinePage>;
  getTimelineIndex(params: { filter: LibraryFilter }): Promise<LibraryTimelineIndex>;
  getItem(params: { fileId: number; filter?: LibraryFilter }): Promise<LibraryItemDetails>;
  getUndated(params: LibraryUndatedParams): Promise<LibraryUndatedPage>;
  getOtherFiles(params: OtherFilesParams): Promise<OtherFilesPage>;
  setDate(params: LibrarySetDateParams): Promise<LibraryDateMutationResult>;
  clearDate(params: LibraryClearDateParams): Promise<LibraryDateMutationResult>;
  getHealthSummary(): Promise<HealthSummary>;
  getDuplicates(params: DuplicateGroupsParams): Promise<DuplicateGroupsPage>;
  getMissing(params: MissingFilesParams): Promise<MissingFilesPage>;
  getMoved(): Promise<MovedCandidatesPage>;
  confirmMoved(params: MovedCandidateTargets): Promise<MovedActionResult>;
  dismissMoved(params: MovedCandidateTargets): Promise<MovedActionResult>;
  getValidationState(): Promise<ValidationState>;
  startValidation(params: ValidationStartParams): Promise<ValidationState>;
  pauseValidation(): Promise<ValidationState>;
  resumeValidation(): Promise<ValidationState>;
  getSettingsInfo(): Promise<SettingsInfo>;
  clearCache(): Promise<CacheClearResult>;
  runBackup(): Promise<BackupResult>;
  revealItem(params: { fileId: number }): Promise<void>;
  openItem(params: { fileId: number }): Promise<void>;
  getVideoProxyState(params: { fileId: number }): Promise<VideoProxyState>;
  prepareVideoProxy(params: VideoProxyPrepareParams): Promise<VideoProxyState>;
}

/**
 * Real renderer default backed by the frozen Phase 2 preload API.
 */
export function createLibraryClient(): LibraryClient {
  return {
    getSummary: () => api.getLibrarySummary(),
    getTimeline: (params) => api.getLibraryTimeline(params),
    getTimelineIndex: (params) => api.getLibraryTimelineIndex(params.filter),
    getItem: (params) => api.getLibraryItem(params.fileId, params.filter),
    getUndated: (params) => api.getLibraryUndated(params),
    getOtherFiles: (params) => api.getOtherFiles(params),
    setDate: (params) => api.setLibraryDate(params),
    clearDate: (params) => api.clearLibraryDate(params),
    getHealthSummary: () => api.getHealthSummary(),
    getDuplicates: (params) => api.getHealthDuplicates(params),
    getMissing: (params) => api.getHealthMissing(params),
    getMoved: () => api.getHealthMoved(),
    confirmMoved: (params) => api.confirmHealthMoved(params),
    dismissMoved: (params) => api.dismissHealthMoved(params),
    getValidationState: () => api.getValidationState(),
    startValidation: (params) => api.startValidation(params),
    pauseValidation: () => api.pauseValidation(),
    resumeValidation: () => api.resumeValidation(),
    getSettingsInfo: () => api.getSettingsInfo(),
    clearCache: () => api.clearCache(),
    runBackup: () => api.runBackup(),
    revealItem: (params) => api.revealLibraryItem(params.fileId),
    openItem: (params) => api.openLibraryItem(params.fileId),
    getVideoProxyState: (params) => api.getVideoProxyState(params.fileId),
    prepareVideoProxy: (params) => api.prepareVideoProxy(params),
  };
}
