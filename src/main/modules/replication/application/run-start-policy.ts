import type { StartRunParams } from "@shared/contracts/replication/types";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { ReplicationExecution } from "./plan-service";
import type { SelectedRunWork } from "./run-selection";

function noWorkMessage(scope: StartRunParams["scope"], execution: ReplicationExecution): string {
  if (scope === "partial_only") {
    return "There are no uncovered files assigned to partial destinations.";
  }
  if (scope === "full_copy_only") {
    return execution.plan.fullCopy === null
      ? "There is no full-copy destination in the plan."
      : "The full copy is already complete. There are no full-copy files to verify.";
  }
  return "There is no backup work for the selected destinations.";
}

function assertFullCopyFits(work: SelectedRunWork, execution: ReplicationExecution): void {
  if (work.fullCopy === null || execution.plan.fullCopy === null) {
    return;
  }
  if (execution.plan.fullCopy.shortfallFiles > 0) {
    throw new AppError(
      APP_ERROR_CODES.REPLICATION_STATE_INVALID,
      "The full-copy destination does not have enough safe space for the whole archive. Choose partial coverage or a larger destination.",
    );
  }
}

export function assertStartable(
  params: StartRunParams,
  execution: ReplicationExecution,
  work: SelectedRunWork,
): void {
  if (params.planHash !== undefined && params.planHash !== execution.plan.planHash) {
    throw new AppError(
      APP_ERROR_CODES.REPLICATION_STATE_INVALID,
      "The backup plan changed after review. Refresh the plan and start again.",
    );
  }
  if (work.files === 0) {
    throw new AppError(
      APP_ERROR_CODES.REPLICATION_STATE_INVALID,
      noWorkMessage(params.scope, execution),
    );
  }
  assertFullCopyFits(work, execution);
  const blocking = execution.plan.warnings.some((warning) => warning.severity === "blocking");
  if (blocking) {
    throw new AppError(
      APP_ERROR_CODES.REPLICATION_STATE_INVALID,
      execution.plan.blockedReason ?? "The backup plan is blocked.",
    );
  }
}
