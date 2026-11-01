import type { VolumeId } from "@shared/contracts/drives";

export type ScanStatus = "idle" | "active" | "paused" | "interrupted" | "complete" | "error";
export type ScanStageId = "catalog" | "metadata" | "thumbnails" | "hashes";
export type ScanStageState = "queued" | "active" | "complete" | "paused" | "failed";
export type ScanIntensity = "eco" | "balanced" | "max";
export type ScanMode = "initial" | "incremental";

export interface ScanStage {
  id: ScanStageId;
  state: ScanStageState;
  processed: number;
  total: number | null;
}

export interface ScanReport {
  newFiles: number;
  changedFiles: number;
  missingFiles: number;
  movedCandidates: number;
}

export interface ScanState {
  driveLabel: string;
  volumeId: VolumeId;
  status: ScanStatus;
  mode: ScanMode;
  stages: ScanStage[];
  currentStage: ScanStageId | null;
  startedAt: string | null;
  finishedAt: string | null;
  lastSavedAt: string | null;
  etaSeconds: number | null;
  intensity: ScanIntensity;
  report: ScanReport | null;
  errorMessage?: string | null;
}

export interface ScanApi {
  getScanState(volumeId: VolumeId): Promise<ScanState | null>;
  startScan(volumeId: VolumeId, intensity?: ScanIntensity): Promise<ScanState>;
  pauseScan(volumeId: VolumeId): Promise<ScanState>;
  resumeScan(volumeId: VolumeId): Promise<ScanState>;
  setScanIntensity(volumeId: VolumeId, intensity: ScanIntensity): Promise<ScanState>;
}

export const SCAN_STAGE_ORDER: readonly ScanStageId[] = [
  "catalog",
  "metadata",
  "thumbnails",
  "hashes",
];

export const SCAN_STAGE_LABELS: Record<ScanStageId, string> = {
  catalog: "Catalog files",
  metadata: "Extract metadata",
  thumbnails: "Generate thumbnails",
  hashes: "Calculate hashes",
};

export const SCAN_STAGE_DESCRIPTIONS: Record<ScanStageId, string> = {
  catalog: "Enumerate directories and files, then record paths and filesystem metadata.",
  metadata: "Read photo and video metadata, then resolve dates and media types.",
  thumbnails: "Create grid thumbnails and video posters for the library.",
  hashes:
    "Calculate SHA-256 for duplicate detection; large unique files use a sampled fingerprint.",
};

export const SCAN_INTENSITY_OPTIONS: ReadonlyArray<{
  id: ScanIntensity;
  label: string;
  hint: string;
}> = [
  { id: "eco", label: "Eco", hint: "Lowest background load" },
  { id: "balanced", label: "Balanced", hint: "Recommended" },
  { id: "max", label: "Max", hint: "Finish sooner" },
];

export function scanIntensityLabel(value: ScanIntensity): string {
  return SCAN_INTENSITY_OPTIONS.find((option) => option.id === value)?.label ?? value;
}

export function isScanRunning(status: ScanStatus | undefined): boolean {
  return status === "active";
}

export function scanOverallProgress(stages: ScanStage[]): number | null {
  let processed = 0;
  let total = 0;
  for (const stage of stages) {
    if (stage.total !== null && stage.total > 0) {
      processed += Math.min(stage.processed, stage.total);
      total += stage.total;
    }
  }
  return total === 0 ? null : Math.min(100, Math.round((processed / total) * 100));
}

export function scanDurationSeconds(state: ScanState): number | null {
  if (state.startedAt === null || state.finishedAt === null) {
    return null;
  }
  const started = Date.parse(state.startedAt);
  const finished = Date.parse(state.finishedAt);
  if (Number.isNaN(started) || Number.isNaN(finished) || finished < started) {
    return null;
  }
  return (finished - started) / 1_000;
}

export function activeStage(stages: ScanStage[]): ScanStage | null {
  return stages.find((stage) => stage.state === "active" || stage.state === "paused") ?? null;
}
