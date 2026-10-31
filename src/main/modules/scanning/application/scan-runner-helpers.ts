import type { ScanStage, ScanStageId, ScanState } from "@shared/contracts/scan";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";

export function stageOf(state: ScanState, stageId: ScanStageId): ScanStage {
  const stage = state.stages.find((candidate) => candidate.id === stageId);
  if (stage === undefined) {
    throw new AppError(APP_ERROR_CODES.SCAN_FAILED, `Scan stage is missing: ${stageId}`);
  }
  return stage;
}

export function estimateEta(
  processed: number,
  total: number | null,
  startedAtMs: number,
  nowMs: number,
): number | null {
  if (total === null) {
    return null;
  }
  if (processed >= total) {
    return 0;
  }
  if (processed <= 0) {
    return null;
  }
  const elapsedSeconds = (nowMs - startedAtMs) / 1000;
  if (elapsedSeconds <= 0) {
    return null;
  }
  return Math.ceil(((total - processed) * elapsedSeconds) / processed);
}
