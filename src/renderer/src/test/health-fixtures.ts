import type { LibraryClient } from "../features/library/library-client";
import { idleValidation } from "./phase-five-fixtures";

export function healthFixtureMethods(): Pick<
  LibraryClient,
  | "getHealthSummary"
  | "getDuplicates"
  | "getMissing"
  | "getMissingDuplicates"
  | "purgeMissingDuplicates"
  | "dismissMissing"
  | "restoreMissing"
  | "getMoved"
  | "confirmMoved"
  | "dismissMoved"
  | "getValidationState"
  | "startValidation"
  | "pauseValidation"
  | "resumeValidation"
> {
  return {
    getHealthSummary: () =>
      Promise.resolve({
        duplicateGroups: 0,
        duplicateFiles: 0,
        duplicateBytes: 0,
        missingFiles: 0,
        movedCandidates: 0,
        lastValidationAt: null,
      }),
    getDuplicates: () =>
      Promise.resolve({ groups: [], totalGroups: 0, totalFiles: 0, totalBytes: 0 }),
    getMissing: () => Promise.resolve({ items: [], total: 0, fileIds: [], dismissedTotal: 0 }),
    getMissingDuplicates: () =>
      Promise.resolve({
        items: [],
        total: 0,
        candidateFileIds: [],
        readyFileIds: [],
        withPendingMoves: 0,
        pendingMovedCandidates: 0,
        withVerifiedReplicas: 0,
        withDateOverride: 0,
      }),
    purgeMissingDuplicates: (params) =>
      Promise.resolve({
        removed: params.fileIds.length,
        skipped: 0,
        dismissedMovedCandidates: 0,
      }),
    dismissMissing: (params) => Promise.resolve({ updated: params.fileIds.length, skipped: 0 }),
    restoreMissing: (params) => Promise.resolve({ updated: params.fileIds.length, skipped: 0 }),
    getMoved: () => Promise.resolve({ items: [], total: 0 }),
    confirmMoved: (params) => Promise.resolve({ updated: params.candidateIds.length, skipped: 0 }),
    dismissMoved: (params) => Promise.resolve({ updated: params.candidateIds.length, skipped: 0 }),
    getValidationState: () => Promise.resolve(idleValidation),
    startValidation: () => Promise.resolve(idleValidation),
    pauseValidation: () => Promise.resolve(idleValidation),
    resumeValidation: () => Promise.resolve(idleValidation),
  };
}
