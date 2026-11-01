import { describe, expect, it } from "vitest";
import { evaluateFullCopy } from "./full-copy-status";
import type { SourceFileFacts } from "./replication-types";

function file(id: number, size: number): SourceFileFacts {
  return {
    id,
    sourceRelativePath: `photos/${String(id)}.jpg`,
    name: `${String(id)}.jpg`,
    size,
    resolvedDate: null,
    mediaClass: "image",
  };
}

describe("full copy status", () => {
  it("is complete only when every present file is verified without issues", () => {
    expect(
      evaluateFullCopy({
        sourceFiles: [file(1, 10), file(2, 20)],
        verifiedFileIds: new Set([1, 2]),
        availableBytes: 0,
        staleFiles: 0,
        missingFiles: 0,
        conflictFiles: 0,
      }),
    ).toMatchObject({
      status: "complete",
      remainingFiles: 0,
      shortfallFiles: 0,
      shortfallBytes: 0,
    });
  });

  it("reports remaining work, shortfall, and replica issues", () => {
    const result = evaluateFullCopy({
      sourceFiles: [file(1, 10), file(2, 20)],
      verifiedFileIds: new Set([1]),
      availableBytes: 5,
      staleFiles: 0,
      missingFiles: 0,
      conflictFiles: 1,
    });
    expect(result).toMatchObject({
      status: "incomplete",
      remainingFiles: 1,
      remainingBytes: 20,
      shortfallFiles: 1,
      shortfallBytes: 20,
    });
    expect(
      evaluateFullCopy({
        sourceFiles: [file(1, 10)],
        verifiedFileIds: new Set([1]),
        availableBytes: 0,
        staleFiles: 1,
        missingFiles: 0,
        conflictFiles: 0,
      }).status,
    ).toBe("incomplete");
  });
});
