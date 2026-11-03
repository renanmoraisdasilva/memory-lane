import { describe, expect, it } from "vitest";
import {
  evaluatePromotion,
  evaluateRollback,
  type PromotionEligibilityInput,
} from "./promotion-policy";

function eligible(overrides: Partial<PromotionEligibilityInput> = {}): PromotionEligibilityInput {
  return {
    sourceRole: "source",
    goal: "full_copy",
    destinationStatus: "active",
    connection: "connected",
    identityConfirmed: true,
    sourceFiles: 10,
    remainingFiles: 0,
    shortfallFiles: 0,
    staleFiles: 0,
    missingFiles: 0,
    conflictFiles: 0,
    failedFiles: 0,
    activeRunStatus: null,
    workloadActive: false,
    ...overrides,
  };
}

describe("promotion policy", () => {
  it("[ML-REPL-082] allows an eligible complete full copy", () => {
    expect(evaluatePromotion(eligible())).toEqual({ canPromote: true, blockedReason: null });
  });

  it("[ML-REPL-065] [ML-REPL-082] blocks every unsafe promotion state with a reason", () => {
    const cases: Array<[Partial<PromotionEligibilityInput>, RegExp]> = [
      [{ sourceRole: "demoted_source" }, /not a source archive/],
      [{ goal: "extend_coverage" }, /full-copy goal/],
      [{ destinationStatus: "retired" }, /no longer active/],
      [{ connection: "offline" }, /Connect the full-copy destination/],
      [{ identityConfirmed: false }, /Confirm the destination drive identity/],
      [{ workloadActive: true }, /scan or validation/],
      [{ activeRunStatus: "paused" }, /running or paused/],
      [{ remainingFiles: 3 }, /3 source files are not verified/],
      [{ shortfallFiles: 2 }, /short of safe space/],
      [{ staleFiles: 1 }, /stale, missing, conflict, or failed/],
    ];
    for (const [overrides, message] of cases) {
      const result = evaluatePromotion(eligible(overrides));
      expect(result.canPromote).toBe(false);
      expect(result.blockedReason).toMatch(message);
    }
  });

  it("[ML-REPL-086] allows rollback only for a completed promotion with an open window", () => {
    expect(evaluateRollback({ status: "completed", windowOpen: true })).toEqual({
      canRollback: true,
      blockedReason: null,
    });
    expect(evaluateRollback({ status: "completed", windowOpen: false }).canRollback).toBe(false);
    expect(evaluateRollback({ status: "verified", windowOpen: true }).canRollback).toBe(false);
  });
});
