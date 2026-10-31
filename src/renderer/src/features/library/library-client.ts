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
} from "./types";
import { api } from "../../lib/ipc-client";

export interface LibraryClient {
  getSummary(): Promise<LibrarySummary>;
  getTimeline(params: LibraryTimelineParams): Promise<LibraryTimelinePage>;
  getTimelineIndex(params: { filter: LibraryFilter }): Promise<LibraryTimelineIndex>;
  getItem(params: { fileId: number; filter?: LibraryFilter }): Promise<LibraryItemDetails>;
  getUndated(params: LibraryUndatedParams): Promise<LibraryUndatedPage>;
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
  revealItem(params: { fileId: number }): Promise<void>;
  openItem(params: { fileId: number }): Promise<void>;
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
    revealItem: (params) => api.revealLibraryItem(params.fileId),
    openItem: (params) => api.openLibraryItem(params.fileId),
  };
}
