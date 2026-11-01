import type {
  DestinationConnection,
  DestinationGoal,
  DestinationRecordStatus,
} from "@shared/contracts/replication/types";

export interface PromotionEligibilityInput {
  sourceRole: "source" | "destination_library" | "demoted_source";
  goal: DestinationGoal;
  destinationStatus: DestinationRecordStatus;
  connection: DestinationConnection;
  identityConfirmed: boolean;
  sourceFiles: number;
  remainingFiles: number;
  shortfallFiles: number;
  staleFiles: number;
  missingFiles: number;
  conflictFiles: number;
  failedFiles: number;
  activeRunStatus: string | null;
  workloadActive: boolean;
}

export interface PromotionEligibility {
  canPromote: boolean;
  blockedReason: string | null;
}

const BLOCKING_RUN_STATUSES = new Set(["running", "paused", "stopping", "interrupted"]);

function destinationBlock(input: PromotionEligibilityInput): string | null {
  if (input.sourceRole !== "source") {
    return "The active catalog is not a source archive.";
  }
  if (input.goal !== "full_copy") {
    return "Promotion requires a destination with the full-copy goal.";
  }
  if (input.destinationStatus !== "active") {
    return "This destination is no longer active.";
  }
  if (input.connection !== "connected") {
    return "Connect the full-copy destination before promoting it.";
  }
  if (!input.identityConfirmed) {
    return "Confirm the destination drive identity before promoting it.";
  }
  return null;
}

function activityBlock(input: PromotionEligibilityInput): string | null {
  if (input.workloadActive) {
    return "A scan or validation is running. Wait for it to finish.";
  }
  if (input.activeRunStatus !== null && BLOCKING_RUN_STATUSES.has(input.activeRunStatus)) {
    return "Promotion is unavailable while a backup is running or paused.";
  }
  return null;
}

function coverageBlock(input: PromotionEligibilityInput): string | null {
  if (input.sourceFiles === 0) {
    return "The source archive has no present files to promote.";
  }
  if (input.shortfallFiles > 0) {
    return `The full copy is short of safe space for ${String(input.shortfallFiles)} files.`;
  }
  if (input.remainingFiles > 0) {
    return `${String(input.remainingFiles)} source files are not verified on this destination.`;
  }
  if (input.staleFiles + input.missingFiles + input.conflictFiles + input.failedFiles > 0) {
    return "This destination has stale, missing, conflict, or failed replicas. Verify it first.";
  }
  return null;
}

export function evaluatePromotion(input: PromotionEligibilityInput): PromotionEligibility {
  const blockedReason = destinationBlock(input) ?? activityBlock(input) ?? coverageBlock(input);
  return { canPromote: blockedReason === null, blockedReason };
}

export interface RollbackEligibilityInput {
  status: string;
  windowOpen: boolean;
}

export interface RollbackEligibility {
  canRollback: boolean;
  blockedReason: string | null;
}

export function evaluateRollback(input: RollbackEligibilityInput): RollbackEligibility {
  if (input.status !== "completed") {
    return {
      canRollback: false,
      blockedReason: "Only a completed promotion can be rolled back.",
    };
  }
  if (!input.windowOpen) {
    return {
      canRollback: false,
      blockedReason:
        "Rollback is available only before the first change to the new source archive.",
    };
  }
  return { canRollback: true, blockedReason: null };
}
