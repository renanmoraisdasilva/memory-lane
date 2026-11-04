import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import type {
  DestinationConnection,
  DestinationGoal,
  DestinationSummary,
} from "@shared/contracts/replication/types";
import { computeCoverage } from "./coverage";
import { buildReplicationPlan } from "./plan-builder";
import type { PlanDestinationInput, PlanInput } from "./plan-types";
import type { SourceFileFacts } from "./replication-types";

function source(id: number, size: number, date: string | null): SourceFileFacts {
  return {
    id,
    sourceRelativePath: `photos/${String(id)}.jpg`,
    name: `${String(id)}.jpg`,
    size,
    resolvedDate: date,
    mediaClass: "image",
  };
}

function summary(
  id: number,
  goal: DestinationGoal,
  availableBytes: number,
  overrides: {
    priority?: number;
    connection?: DestinationConnection;
    verifiedFiles?: number;
    verifiedBytes?: number;
    fullCopyStatus?: DestinationSummary["fullCopyStatus"];
  } = {},
): DestinationSummary {
  return {
    id,
    destinationId: `dest-${String(id)}`,
    volumeId: toVolumeId(`volume-${String(id)}`),
    label: `Backup ${String(id)}`,
    letter: null,
    mount: `F:\\backup-${String(id)}`,
    fileSystem: "NTFS",
    goal,
    connection: overrides.connection ?? "connected",
    identityConfidence: "confirmed",
    totalBytes: 1_000,
    freeBytes: availableBytes,
    reserveBytes: 0,
    verifiedBytes: overrides.verifiedBytes ?? 0,
    verifiedFiles: overrides.verifiedFiles ?? 0,
    unverifiedFiles: 0,
    availableBytes,
    lastSeenAt: null,
    lastVerifiedAt: null,
    priority: overrides.priority ?? id,
    fullCopyStatus: overrides.fullCopyStatus ?? "not_applicable",
    fullCopyShortfallBytes: 0,
    fullCopyShortfallFiles: 0,
    attention: {
      onlyOnDriveFiles: 0,
      onlyOnDriveBytes: 0,
      sourceMissingFiles: 0,
      sourceMissingBytes: 0,
    },
    isFirstInFillOrder: false,
  };
}

function destination(
  id: number,
  goal: DestinationGoal,
  availableBytes: number,
  options: { verifiedFileIds?: number[] } & Parameters<typeof summary>[3] = {},
): PlanDestinationInput {
  return {
    summary: summary(id, goal, availableBytes, options),
    verifiedFileIds: new Set(options.verifiedFileIds ?? []),
    conflictFiles: 0,
    staleFiles: 0,
    missingFiles: 0,
  };
}

function planFor(files: SourceFileFacts[], destinations: PlanDestinationInput[]): PlanInput {
  const coverageDestinations = destinations.map((destination) => ({
    id: destination.summary.id,
    destinationId: destination.summary.destinationId,
    goal: destination.summary.goal,
    status: "active" as const,
    connection: destination.summary.connection,
    verifiedFileIds: destination.verifiedFileIds,
    lastVerifiedAt: null,
  }));
  return {
    sourceFiles: files,
    destinations,
    coverage: computeCoverage(files, coverageDestinations),
    hash: (value) => `hash-${value}`,
  };
}

const files: SourceFileFacts[] = [
  source(1, 20, "2001-01-01T00:00:00.000Z"),
  source(2, 40, "2002-01-01T00:00:00.000Z"),
  source(3, 30, "2003-01-01T00:00:00.000Z"),
  source(4, 10, "2004-01-01T00:00:00.000Z"),
  source(5, 100, null),
];

describe("replication plan builder", () => {
  it("[ML-REPL-036] [ML-REPL-038] [ML-REPL-039] [ML-REPL-045] fills partial destinations oldest-first and reports the remainder", () => {
    const plan = buildReplicationPlan(
      planFor(files, [
        destination(1, "extend_coverage", 50, { verifiedFileIds: [1] }),
        destination(2, "extend_coverage", 50, { priority: 2 }),
      ]),
    );

    expect(plan.partial?.rows).toHaveLength(2);
    expect(plan.partial?.rows[0]).toMatchObject({
      adoptedFiles: 1,
      adoptedBytes: 20,
      newFiles: 1,
      newBytes: 40,
      newRangeStart: "2002-01-01T00:00:00.000Z",
    });
    expect(plan.partial?.rows[1]).toMatchObject({
      newFiles: 2,
      newBytes: 40,
      newRangeStart: "2003-01-01T00:00:00.000Z",
    });
    expect(plan.remainder).toMatchObject({ files: 1, bytes: 100, startDate: null });
    expect(plan.warnings.map((warning) => warning.code)).toContain("partial_remainder");
    expect(plan.executionScopes).toEqual(["all_connected", "partial_only"]);
    expect(plan.canStart).toBe(true);
    expect(plan.coverage.partialPercent).toBe(80);
    expect(plan.coverage.hasFullCopy).toBe(false);
  });

  it("[ML-REPL-040] [ML-REPL-046] plans an independent full copy and reports its shortfall", () => {
    const plan = buildReplicationPlan(planFor(files, [destination(1, "full_copy", 50)]));
    expect(plan.fullCopy).toMatchObject({
      newFiles: 5,
      newBytes: 200,
      shortfallFiles: 3,
      shortfallBytes: 150,
      completeAfterRun: false,
      promotionReady: false,
    });
    expect(plan.warnings.map((warning) => warning.code)).toContain("full_copy_shortfall");
    expect(plan.executionScopes).toEqual(["all_connected", "full_copy_only"]);
    expect(plan.coverage.fullCopyPercent).toBe(40);
  });

  it("[ML-REPL-041] keeps full copy and partial jobs independent in a mixed plan", () => {
    const plan = buildReplicationPlan(
      planFor(files, [
        destination(1, "extend_coverage", 40),
        destination(2, "full_copy", 1_000, { priority: 2 }),
      ]),
    );
    expect(plan.fullCopy?.completeAfterRun).toBe(true);
    expect(plan.partial?.rows).toHaveLength(1);
    expect(plan.executionScopes).toEqual(["all_connected", "full_copy_only", "partial_only"]);
    expect(plan.remainder.files).toBeGreaterThan(0);
  });

  it("[ML-REPL-042] marks a completed full copy as promotion-ready", () => {
    const plan = buildReplicationPlan(
      planFor(files, [
        destination(1, "full_copy", 1_000, {
          verifiedFileIds: [1, 2, 3, 4, 5],
          fullCopyStatus: "complete",
          verifiedFiles: 5,
          verifiedBytes: 200,
        }),
      ]),
    );
    expect(plan.fullCopy).toMatchObject({
      newFiles: 0,
      shortfallBytes: 0,
      completeAfterRun: true,
      promotionReady: true,
    });
    expect(plan.coverage.fullCopyPercent).toBe(100);
  });

  it("[ML-REPL-043] [ML-REPL-049] blocks start when every destination is offline", () => {
    const plan = buildReplicationPlan(
      planFor(files, [
        destination(1, "extend_coverage", 100, {
          connection: "offline",
        }),
      ]),
    );
    expect(plan.canStart).toBe(false);
    expect(plan.blockedReason).toBe("Connect a backup destination before starting a backup.");
    expect(plan.warnings.map((warning) => warning.code)).toContain("offline_destination");
  });

  it("[ML-REPL-048] blocks start when no destination is registered", () => {
    const plan = buildReplicationPlan(planFor(files, []));
    expect(plan.canStart).toBe(false);
    expect(plan.fullCopy).toBeNull();
    expect(plan.partial).toBeNull();
    expect(plan.warnings.map((warning) => warning.code)).toContain("no_destination");
  });

  it("[ML-REPL-052] is deterministic for the same inputs and changes when destination state changes", () => {
    const first = buildReplicationPlan(planFor(files, [destination(1, "extend_coverage", 50)]));
    const second = buildReplicationPlan(planFor(files, [destination(1, "extend_coverage", 50)]));
    const changed = buildReplicationPlan(planFor(files, [destination(1, "extend_coverage", 60)]));
    expect(first.planHash).toBe(second.planHash);
    expect(changed.planHash).not.toBe(first.planHash);
  });

  it("[ML-REPL-052] ignores free-space drift when the assigned files do not change", () => {
    const exact = buildReplicationPlan(planFor(files, [destination(1, "extend_coverage", 200)]));
    const roomy = buildReplicationPlan(planFor(files, [destination(1, "extend_coverage", 900)]));
    expect(exact.partial?.rows[0]?.newFiles).toBe(5);
    expect(roomy.partial?.rows[0]?.newFiles).toBe(5);
    expect(roomy.planHash).toBe(exact.planHash);
  });
});
