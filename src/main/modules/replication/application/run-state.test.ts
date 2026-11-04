import { describe, expect, it } from "vitest";
import type { ReplicationRunRecord } from "../../../db/repositories/replication-run-types";
import { buildRunState, workTotals } from "./run-state";

const completedRun: ReplicationRunRecord = {
  id: 2,
  status: "completed",
  scope: "partial_only",
  goal: "extend_coverage",
  planRevision: 6,
  planHash: "plan",
  planUpdatedAt: "2026-11-04T14:07:27.779Z",
  startedAt: "2026-11-03T17:03:32.173Z",
  finishedAt: "2026-11-04T15:43:22.651Z",
  pausedAt: null,
  resumedAt: null,
  stopRequestedAt: null,
  lastHeartbeatAt: "2026-11-04T15:43:22.651Z",
  destinationSnapshot: null,
  plannedFiles: 20_853,
  plannedBytes: 289_737_289_372,
  copiedFiles: 57_804,
  copiedBytes: 403_845_536_955,
  verifiedFiles: 57_804,
  verifiedBytes: 403_845_536_955,
  failedFiles: 151,
  failedBytes: 29_006_432_085,
  staleFiles: 0,
  staleBytes: 0,
  remainderFiles: 0,
  remainderBytes: 0,
  errorMessage: "SOURCE_PERMISSION_DENIED: access denied",
};

describe("run state", () => {
  it("[ML-REPL-096] derives progress from verified, failed, and remainder work", () => {
    expect(workTotals(completedRun)).toEqual({
      plannedFiles: 57_955,
      plannedBytes: 432_851_969_040,
    });

    const state = buildRunState(completedRun, null);
    expect(state.plannedFiles).toBe(57_955);
    expect(state.plannedBytes).toBe(432_851_969_040);
    expect(state.percent).toBe(93.3);
    expect(state.etaSeconds).toBeNull();
  });

  it("[ML-REPL-096] keeps the original plan when it is larger than the processed work", () => {
    const run = {
      ...completedRun,
      plannedFiles: 100,
      plannedBytes: 1_000,
      verifiedFiles: 40,
      verifiedBytes: 400,
      failedFiles: 0,
      failedBytes: 0,
    };
    expect(workTotals(run)).toEqual({ plannedFiles: 100, plannedBytes: 1_000 });
  });
});
