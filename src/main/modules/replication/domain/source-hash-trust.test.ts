import { describe, expect, it } from "vitest";
import type { ReplicationSourceFile } from "../../../db/repositories/replication-source-repository";
import { trustedSourceHashValue } from "./source-hash-trust";

function source(overrides: Partial<ReplicationSourceFile> = {}): ReplicationSourceFile {
  return {
    id: 1,
    absolutePath: "E:\\photos\\a.jpg",
    sourceRelativePath: "photos\\a.jpg",
    name: "a.jpg",
    size: 10,
    modifiedAtFs: "2026-01-01T00:00:00.000Z",
    state: "present",
    mediaClass: "image",
    sha256: "a".repeat(64),
    sourceSizeAtHash: 10,
    sourceModifiedAtFsAtHash: "2026-01-01T00:00:00.000Z",
    hashedAt: "2026-01-02T00:00:00.000Z",
    resolvedDate: null,
    ...overrides,
  };
}

describe("source hash trust", () => {
  it("[ML-REPL-007] trusts a hash whose recorded size and mtime match the file", () => {
    expect(trustedSourceHashValue(source())).toBe("a".repeat(64));
  });

  it("trusts a legacy hash when the file was not modified after hashing", () => {
    expect(
      trustedSourceHashValue(
        source({
          sourceSizeAtHash: null,
          sourceModifiedAtFsAtHash: null,
        }),
      ),
    ).toBe("a".repeat(64));
  });

  it("trusts a legacy hash when the timestamps are equal", () => {
    expect(
      trustedSourceHashValue(
        source({
          sourceSizeAtHash: null,
          sourceModifiedAtFsAtHash: null,
          modifiedAtFs: "2026-01-02T00:00:00.000Z",
          hashedAt: "2026-01-02T00:00:00.000Z",
        }),
      ),
    ).toBe("a".repeat(64));
  });

  it("[ML-REPL-007] does not trust a legacy hash when the file changed after hashing", () => {
    expect(
      trustedSourceHashValue(
        source({
          sourceSizeAtHash: null,
          sourceModifiedAtFsAtHash: null,
          modifiedAtFs: "2026-01-03T00:00:00.000Z",
        }),
      ),
    ).toBeNull();
  });

  it("does not trust partial, unknown, or malformed metadata", () => {
    expect(
      trustedSourceHashValue(source({ sourceSizeAtHash: null, modifiedAtFs: null })),
    ).toBeNull();
    expect(
      trustedSourceHashValue(
        source({
          sourceSizeAtHash: null,
          sourceModifiedAtFsAtHash: null,
          hashedAt: null,
        }),
      ),
    ).toBeNull();
    expect(
      trustedSourceHashValue(
        source({ sourceSizeAtHash: null, sourceModifiedAtFsAtHash: null, hashedAt: "not-a-date" }),
      ),
    ).toBeNull();
  });

  it("does not trust a missing hash", () => {
    expect(trustedSourceHashValue(source({ sha256: null }))).toBeNull();
  });
});
