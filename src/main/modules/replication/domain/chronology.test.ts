import { describe, expect, it } from "vitest";
import { sortSourceChronology } from "./chronology";
import type { SourceFileFacts } from "./replication-types";

function file(path: string, date: string | null): SourceFileFacts {
  return {
    id: Math.random(),
    sourceRelativePath: path,
    name: path,
    size: 1,
    resolvedDate: date,
    mediaClass: "image",
  };
}

describe("source chronology", () => {
  it("sorts dated files oldest first and undated files last by path", () => {
    const sorted = sortSourceChronology([
      file("undated/z.jpg", null),
      file("b.jpg", "2020-01-01T00:00:00.000Z"),
      file("a.jpg", "2019-01-01T00:00:00.000Z"),
      file("undated/a.jpg", null),
      file("both-same.jpg", "2020-01-01T00:00:00.000Z"),
    ]);
    expect(sorted.map((entry) => entry.sourceRelativePath)).toEqual([
      "a.jpg",
      "b.jpg",
      "both-same.jpg",
      "undated/a.jpg",
      "undated/z.jpg",
    ]);
  });
});
