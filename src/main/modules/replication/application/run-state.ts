import { z } from "zod";
import type {
  ReplicationRunState,
  ReplicationRunStatus,
  RunCapabilities,
  RunOrderEntry,
  RunSummary,
} from "@shared/contracts/replication/types";
import { RunOrderEntrySchema } from "@shared/contracts/replication/types";
import type { ReplicationRunRecord } from "../../../db/repositories/replication-run-types";
import type { ActiveRun, RunControl } from "./run-control";

const CAPABILITIES: Record<ReplicationRunStatus, RunCapabilities> = {
  planned: {
    canPause: false,
    canResume: false,
    canStop: false,
    canEditPlan: false,
    canAddDestination: true,
    canPromote: false,
    canSwitchSource: true,
    lockedReason: null,
  },
  running: {
    canPause: true,
    canResume: false,
    canStop: true,
    canEditPlan: false,
    canAddDestination: true,
    canPromote: false,
    canSwitchSource: false,
    lockedReason: "Backup is running.",
  },
  paused: {
    canPause: false,
    canResume: true,
    canStop: true,
    canEditPlan: true,
    canAddDestination: true,
    canPromote: false,
    canSwitchSource: false,
    lockedReason: "Backup is paused.",
  },
  stopping: {
    canPause: false,
    canResume: false,
    canStop: false,
    canEditPlan: false,
    canAddDestination: false,
    canPromote: false,
    canSwitchSource: false,
    lockedReason: "Stopping after the current file.",
  },
  completed: {
    canPause: false,
    canResume: false,
    canStop: false,
    canEditPlan: false,
    canAddDestination: true,
    canPromote: false,
    canSwitchSource: true,
    lockedReason: null,
  },
  stopped: {
    canPause: false,
    canResume: false,
    canStop: false,
    canEditPlan: false,
    canAddDestination: true,
    canPromote: false,
    canSwitchSource: true,
    lockedReason: null,
  },
  failed: {
    canPause: false,
    canResume: false,
    canStop: false,
    canEditPlan: false,
    canAddDestination: true,
    canPromote: false,
    canSwitchSource: true,
    lockedReason: null,
  },
  interrupted: {
    canPause: false,
    canResume: true,
    canStop: true,
    canEditPlan: true,
    canAddDestination: true,
    canPromote: false,
    canSwitchSource: true,
    lockedReason: "Backup was interrupted. Resume to continue.",
  },
};

function capabilitiesFor(status: ReplicationRunStatus): RunCapabilities {
  return CAPABILITIES[status];
}

function percentFor(run: ReplicationRunRecord): number {
  if (run.plannedBytes > 0) {
    return Math.min(100, Math.round((run.verifiedBytes / run.plannedBytes) * 10000) / 100);
  }
  if (run.plannedFiles > 0) {
    return Math.min(100, Math.round((run.verifiedFiles / run.plannedFiles) * 10000) / 100);
  }
  return 0;
}

function orderFor(run: ReplicationRunRecord, control: RunControl | null): RunOrderEntry[] {
  let snapshot: RunOrderEntry[] = [];
  if (run.destinationSnapshot !== null) {
    const parsed = z.array(RunOrderEntrySchema).safeParse(JSON.parse(run.destinationSnapshot));
    if (parsed.success) {
      snapshot = parsed.data;
    }
  }
  return snapshot.map((entry) => ({
    ...entry,
    state: control?.order.get(entry.destinationId) ?? entry.state,
  }));
}

function errorsFor(run: ReplicationRunRecord, control: RunControl | null) {
  if (control !== null && control.errors.length > 0) {
    return control.errors.slice(-20);
  }
  if (run.errorMessage !== null) {
    return [
      {
        code: "REPLICATION_STATE_INVALID",
        message: run.errorMessage,
        retryable: false,
      },
    ];
  }
  return [];
}

function etaFor(run: ReplicationRunRecord, control: RunControl | null): number | null {
  if (control === null || run.plannedBytes === 0 || control.speedBytesPerSecond === null) {
    return null;
  }
  if (control.speedBytesPerSecond <= 0) {
    return null;
  }
  return Math.max(
    0,
    Math.round((run.plannedBytes - run.verifiedBytes) / control.speedBytesPerSecond),
  );
}

export function buildRunState(
  run: ReplicationRunRecord,
  control: RunControl | null,
): ReplicationRunState {
  const active = control !== null;
  return {
    id: run.id,
    status: run.status,
    scope: run.scope,
    planRevision: run.planRevision,
    planHash: run.planHash,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    pausedAt: run.pausedAt,
    resumedAt: run.resumedAt,
    stopRequestedAt: run.stopRequestedAt,
    lastHeartbeatAt: run.lastHeartbeatAt,
    currentDestinationId: active ? control.currentDestinationId : null,
    currentDestinationLabel: active ? control.currentDestinationLabel : null,
    currentFile: active ? control.currentFile : null,
    plannedFiles: run.plannedFiles,
    plannedBytes: run.plannedBytes,
    copiedFiles: run.copiedFiles,
    copiedBytes: run.copiedBytes,
    verifiedFiles: run.verifiedFiles,
    verifiedBytes: run.verifiedBytes,
    failedFiles: run.failedFiles,
    failedBytes: run.failedBytes,
    staleFiles: run.staleFiles,
    staleBytes: run.staleBytes,
    remainderFiles: run.remainderFiles,
    remainderBytes: run.remainderBytes,
    percent: percentFor(run),
    speedBytesPerSecond: active ? control.speedBytesPerSecond : null,
    etaSeconds: etaFor(run, control),
    order: orderFor(run, control),
    errors: errorsFor(run, control),
    capabilities: capabilitiesFor(run.status),
    errorMessage: run.errorMessage,
  };
}

export function toRunSummary(state: ReplicationRunState): RunSummary {
  return {
    id: state.id,
    status: state.status,
    scope: state.scope,
    planRevision: state.planRevision,
    currentDestinationLabel: state.currentDestinationLabel,
    currentFile: state.currentFile,
    percent: state.percent,
    verifiedFiles: state.verifiedFiles,
    verifiedBytes: state.verifiedBytes,
    plannedFiles: state.plannedFiles,
    plannedBytes: state.plannedBytes,
    etaSeconds: state.etaSeconds,
    canPause: state.capabilities.canPause,
    canResume: state.capabilities.canResume,
    canStop: state.capabilities.canStop,
    canEditPlan: state.capabilities.canEditPlan,
    lockedReason: state.capabilities.lockedReason,
  };
}

export function activeRunFor(active: ActiveRun | null): RunControl | null {
  return active?.control ?? null;
}
