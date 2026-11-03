import { describe, expect, it } from "vitest";
import { computeCoverage } from "./coverage";
import type { CoverageDestinationFacts, SourceFileFacts } from "./replication-types";

function source(id: number, size: number, date: string | null = null): SourceFileFacts {
  return {
    id,
    sourceRelativePath: `photos/${String(id)}.jpg`,
    name: `${String(id)}.jpg`,
    size,
    resolvedDate: date,
    mediaClass: "image",
  };
}

function destination(
  id: number,
  goal: "extend_coverage" | "full_copy",
  verifiedFileIds: number[],
  overrides: Partial<CoverageDestinationFacts> = {},
): CoverageDestinationFacts {
  return {
    id,
    destinationId: `dest-${String(id)}`,
    goal,
    status: "active",
    connection: "connected",
    verifiedFileIds: new Set(verifiedFileIds),
    lastVerifiedAt: `2026-11-0${String(id)}T10:00:00.000Z`,
    ...overrides,
  };
}

describe("coverage math", () => {
  it("[ML-REPL-029] [ML-REPL-030] counts distinct union coverage, partial coverage, full copy, and overlap", () => {
    const result = computeCoverage(
      [source(1, 10), source(2, 20), source(3, 30)],
      [
        destination(1, "extend_coverage", [1, 2]),
        destination(2, "full_copy", [2, 3]),
        destination(3, "extend_coverage", [1], { status: "retired" }),
      ],
    );

    expect(result.summary).toMatchObject({
      sourceFiles: 3,
      sourceBytes: 60,
      partialFiles: 2,
      partialBytes: 30,
      partialRemainderFiles: 1,
      partialRemainderBytes: 30,
      fullCopyFiles: 2,
      fullCopyBytes: 50,
      allDestinationFiles: 3,
      allDestinationBytes: 60,
      allDestinationPercent: 100,
      overlapBytes: 20,
    });
    expect(result.summary.partialPercent).toBeCloseTo(66.67, 1);
    expect(result.summary.coverageAsOf).toBe("2026-11-02T10:00:00.000Z");
    expect([...result.overlapIds]).toEqual([2]);
  });

  it("[ML-REPL-031] [ML-REPL-032] [ML-REPL-033] ignores retired and lost destinations and files missing from the source", () => {
    const result = computeCoverage(
      [source(1, 10)],
      [
        destination(1, "extend_coverage", [1, 99], { status: "lost" }),
        destination(2, "extend_coverage", [99]),
      ],
    );
    expect(result.summary.partialFiles).toBe(0);
    expect(result.summary.allDestinationFiles).toBe(0);
    expect(result.summary.coverageAsOf).toBe("2026-11-02T10:00:00.000Z");
  });

  it("treats an empty archive as fully covered without dividing by zero", () => {
    const result = computeCoverage([], []);
    expect(result.summary.sourceFiles).toBe(0);
    expect(result.summary.partialPercent).toBe(100);
    expect(result.summary.allDestinationPercent).toBe(100);
    expect(result.summary.coverageAsOf).toBeNull();
  });
});
