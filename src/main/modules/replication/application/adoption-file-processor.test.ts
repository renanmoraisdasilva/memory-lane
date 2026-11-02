import { describe, expect, it, vi } from "vitest";
import type { AdoptionReplicaRow } from "../../../db/repositories/replication-adoption-types";
import type { ReplicationSourceFile } from "../../../db/repositories/replication-source-repository";
import type { DestinationFileEntry } from "../infrastructure/destination-reader";
import { adoptionIndexFor, processAdoptionFile } from "./adoption-file-processor";

function sourceFile(overrides: Partial<ReplicationSourceFile> = {}): ReplicationSourceFile {
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
    resolvedDate: "2011-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function destinationFile(overrides: Partial<DestinationFileEntry> = {}): DestinationFileEntry {
  return {
    relativePath: "photos\\a.jpg",
    absolutePath: "F:\\photos\\a.jpg",
    name: "a.jpg",
    size: 10,
    modifiedAtFs: "2026-02-01T00:00:00.000Z",
    ...overrides,
  };
}

function existingReplica(overrides: Partial<AdoptionReplicaRow> = {}): AdoptionReplicaRow {
  return {
    fileId: 1,
    relativePath: "photos\\a.jpg",
    relativePathKey: "photos\\a.jpg",
    sourceRelativePath: "photos\\a.jpg",
    sizeBytes: 10,
    sha256: "a".repeat(64),
    status: "verified",
    destinationSizeAtVerify: 10,
    destinationModifiedAtFsAtVerify: "2026-02-01T00:00:00.000Z",
    verifiedAt: "2026-02-01T00:00:00.000Z",
    lastCheckedAt: null,
    ...overrides,
  };
}

async function process(
  source: ReplicationSourceFile,
  destination: DestinationFileEntry,
  options: {
    existing?: AdoptionReplicaRow;
    hash?: string;
    failHash?: boolean;
    assigned?: boolean;
    extraSources?: ReplicationSourceFile[];
  } = {},
) {
  const sources = [source, ...(options.extraSources ?? [])];
  const saveSourceHash = vi.fn(async () => undefined);
  return {
    result: await processAdoptionFile({
      destinationFile: destination,
      copyRootRelative: null,
      index: adoptionIndexFor(sources),
      sources: new Map(sources.map((file) => [file.id, file])),
      existingByFileId: new Map(
        options.existing === undefined ? [] : [[options.existing.fileId, options.existing]],
      ),
      assignedSourceIds: new Set(options.assigned === true ? [source.id] : []),
      sourceHashes: new Map(),
      hasher: {
        hash: async () => {
          if (options.failHash === true) {
            throw new Error("unreadable");
          }
          return options.hash ?? source.sha256 ?? "f".repeat(64);
        },
      },
      saveSourceHash,
      now: "2026-03-01T00:00:00.000Z",
    }),
    saveSourceHash,
  };
}

describe("adoption file processor", () => {
  it("verifies a path match and stores the destination hash", async () => {
    const { result } = await process(sourceFile(), destinationFile());
    expect(result.replica).toMatchObject({
      fileId: 1,
      status: "verified",
      sha256: "a".repeat(64),
      sourceRelativePath: "photos\\a.jpg",
    });
    expect(result.library).toMatchObject({
      relativePath: "photos\\a.jpg",
      sha256: "a".repeat(64),
      resolvedDate: "2011-01-01T00:00:00.000Z",
    });
  });

  it("uses the fast path for an unchanged verified replica", async () => {
    const { result, saveSourceHash } = await process(sourceFile(), destinationFile(), {
      existing: existingReplica(),
    });
    expect(result.touchedFileId).toBe(1);
    expect(result.replica).toBeNull();
    expect(saveSourceHash).not.toHaveBeenCalled();
  });

  it("uses the fast path for a legacy hash when the file predates the hash", async () => {
    const { result, saveSourceHash } = await process(
      sourceFile({ sourceSizeAtHash: null, sourceModifiedAtFsAtHash: null }),
      destinationFile(),
      { existing: existingReplica() },
    );
    expect(result.touchedFileId).toBe(1);
    expect(result.replica).toBeNull();
    expect(saveSourceHash).not.toHaveBeenCalled();
  });

  it("rehashes a legacy hash when the file changed after hashing", async () => {
    const { result, saveSourceHash } = await process(
      sourceFile({
        sourceSizeAtHash: null,
        sourceModifiedAtFsAtHash: null,
        modifiedAtFs: "2026-01-03T00:00:00.000Z",
        hashedAt: "2026-01-02T00:00:00.000Z",
      }),
      destinationFile(),
      { existing: existingReplica() },
    );
    expect(saveSourceHash).toHaveBeenCalledWith(expect.objectContaining({ fileId: 1, size: 10 }));
    expect(result.touchedFileId).toBe(1);
    expect(result.replica).toBeNull();
  });

  it("marks a different hash at an expected path as a conflict", async () => {
    const { result } = await process(sourceFile(), destinationFile(), {
      hash: "b".repeat(64),
    });
    expect(result.replica).toMatchObject({
      status: "conflict",
      sha256: "b".repeat(64),
    });
  });

  it("marks a source change with an unchanged destination as stale", async () => {
    const { result } = await process(
      sourceFile({
        sha256: "c".repeat(64),
        sourceModifiedAtFsAtHash: "2026-05-01T00:00:00.000Z",
        modifiedAtFs: "2026-05-01T00:00:00.000Z",
      }),
      destinationFile(),
      { existing: existingReplica(), hash: "a".repeat(64) },
    );
    expect(result.replica).toMatchObject({ status: "stale" });
  });

  it("records a duplicate source match as an extra instead of a second replica", async () => {
    const { result } = await process(sourceFile(), destinationFile(), { assigned: true });
    expect(result.replica).toBeNull();
    expect(result.orphan).toMatchObject({
      classification: "extra",
      lastError: "Duplicate destination copy of a source file",
    });
  });

  it("reports ambiguous name/size matches", async () => {
    const { result } = await process(
      sourceFile(),
      destinationFile({ relativePath: "manual\\a.jpg" }),
      {
        extraSources: [
          sourceFile({
            id: 2,
            sourceRelativePath: "other\\a.jpg",
            sha256: "e".repeat(64),
          }),
        ],
      },
    );
    expect(result.orphan).toMatchObject({
      classification: "ambiguous",
      matchedSourceCount: 2,
    });
  });

  it("adopts a reorganized file by hash", async () => {
    const { result } = await process(
      sourceFile(),
      destinationFile({ relativePath: "manual\\renamed.jpg", name: "renamed.jpg" }),
      { hash: "a".repeat(64) },
    );
    expect(result.replica).toMatchObject({
      status: "verified",
      sourceRelativePath: "photos\\a.jpg",
    });
  });

  it("records an unrelated destination file as an extra", async () => {
    const { result } = await process(
      sourceFile(),
      destinationFile({ relativePath: "other.bin", name: "other.bin", size: 3 }),
      { hash: "f".repeat(64) },
    );
    expect(result.orphan).toMatchObject({ classification: "extra" });
  });

  it("keeps an unreadable destination file as an unreadable orphan", async () => {
    const { result } = await process(
      sourceFile(),
      destinationFile({ relativePath: "other.bin", name: "other.bin", size: 3 }),
      { failHash: true },
    );
    expect(result.orphan).toMatchObject({ classification: "unreadable" });
  });

  it("keeps a matched replica discovered when the source cannot be hashed", async () => {
    const { result } = await process(
      sourceFile({ sha256: null, sourceSizeAtHash: null, sourceModifiedAtFsAtHash: null }),
      destinationFile(),
      { failHash: true },
    );
    expect(result.replica).toMatchObject({
      status: "discovered",
      sha256: null,
      lastError: "Source hash is unavailable",
    });
  });
});
