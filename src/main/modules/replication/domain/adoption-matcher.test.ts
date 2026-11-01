import { describe, expect, it } from "vitest";
import {
  buildAdoptionIndex,
  classifyReplicaOutcome,
  matchByHash,
  matchDestinationFile,
  stripCopyRoot,
  type AdoptionSourceFile,
} from "./adoption-matcher";

const sources: AdoptionSourceFile[] = [
  {
    id: 1,
    sourceRelativePath: "photos/2011/a.jpg",
    name: "a.jpg",
    size: 10,
    state: "present",
    sha256: "a".repeat(64),
  },
  {
    id: 2,
    sourceRelativePath: "photos/2012/b.jpg",
    name: "b.jpg",
    size: 20,
    state: "present",
    sha256: "b".repeat(64),
  },
  {
    id: 3,
    sourceRelativePath: "other/c.jpg",
    name: "c.jpg",
    size: 20,
    state: "present",
    sha256: "c".repeat(64),
  },
];

describe("adoption matcher", () => {
  const index = buildAdoptionIndex(sources);

  it("strips the destination copy root before matching a path", () => {
    expect(stripCopyRoot("Memory Lane\\Archive\\photos\\a.jpg", "Memory Lane\\Archive")).toBe(
      "photos\\a.jpg",
    );
    const match = matchDestinationFile(
      index,
      {
        relativePath: "Memory Lane\\Archive\\photos\\2011\\a.jpg",
        name: "a.jpg",
        size: 10,
      },
      "Memory Lane\\Archive",
    );
    expect(match).toMatchObject({
      kind: "matched",
      matchedBy: "path",
      sourceRelativePath: "photos/2011/a.jpg",
    });
  });

  it("matches a unique name and size when the path was reorganized", () => {
    const match = matchDestinationFile(
      index,
      { relativePath: "manual/a.jpg", name: "a.jpg", size: 10 },
      null,
    );
    expect(match).toMatchObject({ kind: "matched", matchedBy: "name" });
  });

  it("reports ambiguity when a name and size match several source files", () => {
    const ambiguousIndex = buildAdoptionIndex([
      ...sources,
      {
        id: 4,
        sourceRelativePath: "photos/2013/a.jpg",
        name: "a.jpg",
        size: 10,
        state: "present",
        sha256: "d".repeat(64),
      },
    ]);
    expect(
      matchDestinationFile(
        ambiguousIndex,
        { relativePath: "manual/a.jpg", name: "a.jpg", size: 10 },
        null,
      ),
    ).toEqual({ kind: "ambiguous", matches: 2 });
  });

  it("falls back to a unique content hash", () => {
    const miss = matchDestinationFile(
      index,
      { relativePath: "manual/RENAMED.jpg", name: "RENAMED.jpg", size: 10 },
      null,
    );
    expect(miss).toEqual({ kind: "none" });
    expect(matchByHash(index, "B".repeat(64))).toMatchObject({
      kind: "matched",
      matchedBy: "hash",
      sourceRelativePath: "photos/2012/b.jpg",
    });
  });

  it("classifies verified, stale, and conflict outcomes from history", () => {
    const previous = { status: "verified", sha256: "old".padEnd(64, "0") };
    expect(
      classifyReplicaOutcome({
        sourceHash: "new".padEnd(64, "0"),
        destinationHash: "new".padEnd(64, "0"),
        previous,
      }),
    ).toBe("verified");
    expect(
      classifyReplicaOutcome({
        sourceHash: "new".padEnd(64, "0"),
        destinationHash: previous.sha256,
        previous,
      }),
    ).toBe("stale");
    expect(
      classifyReplicaOutcome({
        sourceHash: previous.sha256,
        destinationHash: "new".padEnd(64, "0"),
        previous,
      }),
    ).toBe("stale");
    expect(
      classifyReplicaOutcome({
        sourceHash: "new".padEnd(64, "0"),
        destinationHash: "other".padEnd(64, "0"),
        previous,
      }),
    ).toBe("conflict");
    expect(
      classifyReplicaOutcome({
        sourceHash: "new".padEnd(64, "0"),
        destinationHash: "other".padEnd(64, "0"),
        previous: null,
      }),
    ).toBe("conflict");
  });
});
