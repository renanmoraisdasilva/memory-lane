import type { VolumeId } from "@shared/contracts/drives";
import type { ScanApi, ScanStage, ScanStageId, ScanState } from "../features/scan/types";
import {
  cloneScanState,
  createActiveScanState,
  createScanFixture,
  mockCompletionReport,
} from "./mock-scan-fixtures";

export { createScanFixture } from "./mock-scan-fixtures";

function nowIso(now: () => Date): string {
  return now().toISOString();
}

interface AdvanceResult {
  stages: ScanStage[];
  currentStage: ScanStageId | null;
  finished: boolean;
}

function advanceStages(stages: ScanStage[]): AdvanceResult {
  const next = stages.map((stage) => ({ ...stage }));
  const index = next.findIndex((stage) => stage.state === "active");
  const stage = next[index];
  if (stage === undefined) {
    return { stages: next, currentStage: null, finished: false };
  }

  const total = stage.total ?? 1;
  const step = Math.max(1, Math.ceil(total * 0.08));
  const processed = Math.min(total, stage.processed + step);

  if (processed < total) {
    next[index] = { ...stage, processed };
    return { stages: next, currentStage: stage.id, finished: false };
  }

  next[index] = { ...stage, processed: total, state: "complete" };
  const following = next[index + 1];
  if (following === undefined) {
    return { stages: next, currentStage: null, finished: true };
  }

  next[index + 1] = { ...following, state: "active" };
  return { stages: next, currentStage: following.id, finished: false };
}

function advanceState(state: ScanState, now: () => Date): ScanState {
  if (state.status !== "active") {
    return state;
  }

  const result = advanceStages(state.stages);
  return {
    ...state,
    stages: result.stages,
    status: result.finished ? "complete" : "active",
    currentStage: result.currentStage,
    lastSavedAt: nowIso(now),
    finishedAt: result.finished ? nowIso(now) : null,
    etaSeconds: result.finished ? null : Math.max(30, (state.etaSeconds ?? 2_880) - 90),
    report: result.finished ? { ...mockCompletionReport } : null,
  };
}

function pauseState(state: ScanState, now: () => Date): ScanState {
  if (state.status !== "active") {
    return state;
  }
  return {
    ...state,
    status: "paused",
    stages: state.stages.map((stage) =>
      stage.state === "active" ? { ...stage, state: "paused" } : stage,
    ),
    etaSeconds: null,
    lastSavedAt: nowIso(now),
  };
}

function resumeState(state: ScanState, now: () => Date): ScanState {
  if (state.status !== "paused" && state.status !== "interrupted") {
    return state;
  }
  return {
    ...state,
    status: "active",
    stages: state.stages.map((stage) =>
      stage.state === "paused" ? { ...stage, state: "active" } : stage,
    ),
    lastSavedAt: nowIso(now),
    etaSeconds: 2_880,
  };
}

export interface MockScanControllerOptions {
  states?: Record<string, ScanState>;
  autoAdvance?: boolean;
  driveLabel?: string;
  now?: () => Date;
}

export function createMockScanController(options: MockScanControllerOptions = {}): ScanApi {
  const now = options.now ?? (() => new Date());
  const label = options.driveLabel ?? "Selected drive";
  const states = new Map<string, ScanState>(
    Object.entries(options.states ?? {}).map(([volumeId, state]) => [
      volumeId,
      cloneScanState(state),
    ]),
  );

  function ensureState(volumeId: VolumeId): ScanState {
    const key = String(volumeId);
    const existing = states.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const idle = createScanFixture("idle", label, volumeId);
    states.set(key, idle);
    return idle;
  }

  return {
    getScanState: (volumeId) =>
      Promise.resolve().then(() => {
        const key = String(volumeId);
        const existing = states.get(key);
        if (existing === undefined) {
          return null;
        }
        const next = options.autoAdvance === true ? advanceState(existing, now) : existing;
        states.set(key, next);
        return cloneScanState(next);
      }),
    startScan: (volumeId, intensity) =>
      Promise.resolve().then(() => {
        const current = states.get(String(volumeId));
        const next = createActiveScanState(
          volumeId,
          current?.driveLabel ?? label,
          intensity ?? current?.intensity ?? "balanced",
          nowIso(now),
        );
        states.set(String(volumeId), next);
        return cloneScanState(next);
      }),
    pauseScan: (volumeId) =>
      Promise.resolve().then(() => {
        const next = pauseState(ensureState(volumeId), now);
        states.set(String(volumeId), next);
        return cloneScanState(next);
      }),
    resumeScan: (volumeId) =>
      Promise.resolve().then(() => {
        const next = resumeState(ensureState(volumeId), now);
        states.set(String(volumeId), next);
        return cloneScanState(next);
      }),
    setScanIntensity: (volumeId, intensity) =>
      Promise.resolve().then(() => {
        const next = { ...ensureState(volumeId), intensity };
        states.set(String(volumeId), next);
        return cloneScanState(next);
      }),
  };
}
