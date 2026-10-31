import type { VolumeId } from "@shared/contracts/drives";
import type {
  ScanIntensity,
  ScanReport,
  ScanStage,
  ScanStageId,
  ScanStageState,
  ScanState,
  ScanStatus,
} from "../features/scan/types";

const STARTED_AT = "2026-10-31T13:48:00.000Z";
const FINISHED_AT = "2026-10-31T14:32:12.000Z";
const LAST_SAVED_AT = "2026-10-31T14:20:02.000Z";

export const mockCompletionReport: ScanReport = {
  newFiles: 3_240,
  changedFiles: 12,
  missingFiles: 15,
  movedCandidates: 9,
};

interface StageSeed {
  id: ScanStageId;
  state: ScanStageState;
  processed: number;
  total: number | null;
}

export function seedStages(seeds: StageSeed[]): ScanStage[] {
  return seeds.map((seed) => ({ ...seed }));
}

function baseStages(status: ScanStatus): ScanStage[] {
  switch (status) {
    case "idle":
      return seedStages([
        { id: "catalog", state: "queued", processed: 0, total: null },
        { id: "metadata", state: "queued", processed: 0, total: null },
        { id: "thumbnails", state: "queued", processed: 0, total: null },
        { id: "hashes", state: "queued", processed: 0, total: null },
      ]);
    case "active":
      return seedStages([
        { id: "catalog", state: "complete", processed: 97_902, total: 97_902 },
        { id: "metadata", state: "active", processed: 83_000, total: 97_902 },
        { id: "thumbnails", state: "queued", processed: 0, total: 60_000 },
        { id: "hashes", state: "queued", processed: 0, total: 97_902 },
      ]);
    case "paused":
    case "interrupted":
      return seedStages([
        { id: "catalog", state: "complete", processed: 97_902, total: 97_902 },
        { id: "metadata", state: "paused", processed: 83_000, total: 97_902 },
        { id: "thumbnails", state: "queued", processed: 0, total: 60_000 },
        { id: "hashes", state: "queued", processed: 0, total: 97_902 },
      ]);
    case "complete":
      return seedStages([
        { id: "catalog", state: "complete", processed: 97_902, total: 97_902 },
        { id: "metadata", state: "complete", processed: 97_902, total: 97_902 },
        { id: "thumbnails", state: "complete", processed: 60_000, total: 60_000 },
        { id: "hashes", state: "complete", processed: 97_902, total: 97_902 },
      ]);
    case "error":
      return seedStages([
        { id: "catalog", state: "failed", processed: 1_240, total: 97_902 },
        { id: "metadata", state: "queued", processed: 0, total: 97_902 },
        { id: "thumbnails", state: "queued", processed: 0, total: 60_000 },
        { id: "hashes", state: "queued", processed: 0, total: 97_902 },
      ]);
  }
}

function currentStageFor(status: ScanStatus): ScanStageId | null {
  if (status === "active" || status === "paused" || status === "interrupted") {
    return "metadata";
  }
  if (status === "error") {
    return "catalog";
  }
  return null;
}

export function createScanFixture(
  status: ScanStatus,
  driveLabel: string,
  volumeId: VolumeId,
): ScanState {
  const state: ScanState = {
    driveLabel,
    volumeId,
    status,
    mode: "incremental",
    stages: baseStages(status),
    currentStage: currentStageFor(status),
    startedAt: status === "idle" ? null : STARTED_AT,
    finishedAt: status === "complete" ? FINISHED_AT : null,
    lastSavedAt: status === "idle" ? null : LAST_SAVED_AT,
    etaSeconds: status === "active" ? 2_880 : null,
    intensity: "balanced",
    report: status === "complete" ? { ...mockCompletionReport } : null,
  };

  if (status === "error") {
    return {
      ...state,
      errorMessage: "The drive was disconnected before the catalog stage completed.",
    };
  }
  return state;
}

export function cloneScanState(state: ScanState): ScanState {
  return {
    ...state,
    stages: state.stages.map((stage) => ({ ...stage })),
    report: state.report === null ? null : { ...state.report },
  };
}

export function createActiveScanState(
  volumeId: VolumeId,
  label: string,
  intensity: ScanIntensity,
  nowIsoValue: string,
): ScanState {
  return {
    driveLabel: label,
    volumeId,
    status: "active",
    mode: "incremental",
    stages: seedStages([
      { id: "catalog", state: "active", processed: 0, total: 97_902 },
      { id: "metadata", state: "queued", processed: 0, total: 97_902 },
      { id: "thumbnails", state: "queued", processed: 0, total: 60_000 },
      { id: "hashes", state: "queued", processed: 0, total: 97_902 },
    ]),
    currentStage: "catalog",
    startedAt: nowIsoValue,
    finishedAt: null,
    lastSavedAt: nowIsoValue,
    etaSeconds: 2_880,
    intensity,
    report: null,
  };
}
