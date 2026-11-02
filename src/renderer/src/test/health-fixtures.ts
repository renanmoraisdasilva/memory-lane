import type { DuplicateCleanupState } from "@shared/contracts/health";
import type { LibraryClient } from "../features/library/library-client";
import { idleValidation } from "./phase-five-fixtures";

const idleCleanupState: DuplicateCleanupState = {
  runId: null,
  status: "idle",
  groupsTotal: 0,
  groupsProcessed: 0,
  groupsSkipped: 0,
  groupsWithoutCoverage: 0,
  filesTotal: 0,
  filesMoved: 0,
  filesSkipped: 0,
  bytesTotal: 0,
  bytesMoved: 0,
  currentPath: null,
  quarantinePath: null,
  cancelRequested: false,
  errorMessage: null,
  startedAt: null,
  finishedAt: null,
};

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
  | "getCleanupSummary"
  | "getCleanupState"
  | "startCleanup"
  | "cancelCleanup"
  | "revealCleanupQuarantine"
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
      Promise.resolve({
        groups: [],
        totalGroups: 0,
        totalFiles: 0,
        totalBytes: 0,
        totalExcessBytes: 0,
      }),
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
    getCleanupSummary: () =>
      Promise.resolve({
        totalGroups: 0,
        totalFiles: 0,
        totalDuplicateBytes: 0,
        eligibleGroups: 0,
        skippedGroups: 0,
        groupsWithoutCoverage: 0,
        filesToMove: 0,
        bytesToMove: 0,
        keepers: 0,
        skipCounts: {
          notAGroup: 0,
          empty: 0,
          belowMinimumSize: 0,
          candidateDateOverride: 0,
          multipleDateOverrides: 0,
          hardLink: 0,
        },
        minimumFileSizeBytes: 1024,
        rootPath: "E:\\",
        quarantineRoot: "E:\\.memorylane_quarantine",
      }),
    getCleanupState: () => Promise.resolve(idleCleanupState),
    startCleanup: () => Promise.resolve(idleCleanupState),
    cancelCleanup: () => Promise.resolve(idleCleanupState),
    revealCleanupQuarantine: () => Promise.resolve(),
    getValidationState: () => Promise.resolve(idleValidation),
    startValidation: () => Promise.resolve(idleValidation),
    pauseValidation: () => Promise.resolve(idleValidation),
    resumeValidation: () => Promise.resolve(idleValidation),
  };
}
