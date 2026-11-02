import { describe, expect, it } from "vitest";
import {
  chooseDuplicateKeeper,
  duplicateKeeperReason,
  evaluateDuplicateGroup,
  type DuplicateCleanupFile,
} from "./duplicate-cleanup";

function file(overrides: Partial<DuplicateCleanupFile> = {}): DuplicateCleanupFile {
  return {
    fileId: 1,
    name: "sample.jpg",
    path: "X:\\Demo\\Archive\\sample.jpg",
    sizeBytes: 1024,
    createdAtFs: "2024-01-01T00:00:00.000Z",
    modifiedAtFs: "2024-01-01T00:00:00.000Z",
    linkCount: 1,
    hasVerifiedReplica: true,
    hasDateOverride: false,
    ...overrides,
  };
}

describe("duplicate cleanup keeper", () => {
  it("prefers the oldest created file, then modification time", () => {
    const oldest = file({ fileId: 2, createdAtFs: "2020-01-01T00:00:00.000Z" });
    const newer = file({ fileId: 1, createdAtFs: "2024-01-01T00:00:00.000Z" });
    expect(chooseDuplicateKeeper([newer, oldest])?.fileId).toBe(2);

    const olderModified = file({
      fileId: 3,
      createdAtFs: "2020-01-01T00:00:00.000Z",
      modifiedAtFs: "2020-01-01T00:00:00.000Z",
    });
    const newerModified = file({
      fileId: 4,
      createdAtFs: "2020-01-01T00:00:00.000Z",
      modifiedAtFs: "2023-01-01T00:00:00.000Z",
    });
    expect(chooseDuplicateKeeper([newerModified, olderModified])?.fileId).toBe(3);
  });

  it("treats missing creation time as later, then uses path and name length", () => {
    const noDate = file({ fileId: 1, createdAtFs: null });
    const dated = file({ fileId: 2, createdAtFs: "2024-01-01T00:00:00.000Z" });
    expect(chooseDuplicateKeeper([noDate, dated])?.fileId).toBe(2);

    const deep = file({ fileId: 3, path: "X:\\Demo\\Archive\\Nested\\sample.jpg" });
    const shallow = file({ fileId: 4, path: "X:\\Demo\\sample.jpg" });
    expect(chooseDuplicateKeeper([deep, shallow])?.fileId).toBe(4);

    const longPath = file({ fileId: 5, path: "X:\\Demo\\Longer\\sample.jpg" });
    const shortPath = file({ fileId: 6, path: "X:\\Demo\\A\\sample.jpg" });
    expect(chooseDuplicateKeeper([longPath, shortPath])?.fileId).toBe(6);

    const longName = file({ fileId: 7, name: "long-sample-name.jpg" });
    const shortName = file({ fileId: 8, name: "s.jpg" });
    expect(chooseDuplicateKeeper([longName, shortName])?.fileId).toBe(8);
  });

  it("uses file id as the stable tiebreaker", () => {
    const first = file({ fileId: 10 });
    const second = file({ fileId: 11 });
    expect(chooseDuplicateKeeper([second, first])?.fileId).toBe(10);
    expect(duplicateKeeperReason([second, first], first)).toBe("stable tiebreaker");
  });
});

describe("duplicate cleanup eligibility", () => {
  it("accepts a covered keeper with no conflicting curation", () => {
    const keeper = file({ fileId: 1, createdAtFs: "2020-01-01T00:00:00.000Z" });
    const candidate = file({ fileId: 2, createdAtFs: "2024-01-01T00:00:00.000Z" });
    expect(evaluateDuplicateGroup([candidate, keeper])).toMatchObject({
      eligible: true,
      skipReason: null,
      keeper: { fileId: 1 },
      excessBytes: 1024,
    });
  });

  it("rejects a single file, empty files, tiny files, and uncovered keepers", () => {
    expect(evaluateDuplicateGroup([file()])?.skipReason).toBe("not-a-group");
    expect(
      evaluateDuplicateGroup([file({ sizeBytes: 0 }), file({ fileId: 2, sizeBytes: 0 })])
        ?.skipReason,
    ).toBe("empty");
    expect(
      evaluateDuplicateGroup([file({ sizeBytes: 512 }), file({ fileId: 2, sizeBytes: 512 })])
        ?.skipReason,
    ).toBe("below-minimum-size");
    expect(
      evaluateDuplicateGroup([
        file({ hasVerifiedReplica: false }),
        file({ fileId: 2, hasVerifiedReplica: false }),
      ])?.skipReason,
    ).toBe("keeper-not-covered");
  });

  it("skips candidate-only or multiple date overrides", () => {
    const keeper = file({ fileId: 1 });
    const overrideCandidate = file({ fileId: 2, hasDateOverride: true });
    expect(evaluateDuplicateGroup([keeper, overrideCandidate])?.skipReason).toBe(
      "candidate-date-override",
    );

    const firstOverride = file({ fileId: 1, hasDateOverride: true });
    const secondOverride = file({ fileId: 2, hasDateOverride: true });
    expect(evaluateDuplicateGroup([firstOverride, secondOverride])?.skipReason).toBe(
      "multiple-date-overrides",
    );
  });

  it("keeps an active override on the keeper eligible", () => {
    const keeper = file({ fileId: 1, hasDateOverride: true });
    const candidate = file({ fileId: 2 });
    expect(evaluateDuplicateGroup([keeper, candidate])).toMatchObject({
      eligible: true,
      skipReason: null,
    });
  });

  it("skips groups with hard links", () => {
    const keeper = file({ fileId: 1, linkCount: 2 });
    const candidate = file({ fileId: 2 });
    expect(evaluateDuplicateGroup([keeper, candidate])?.skipReason).toBe("hard-link");
  });
});
