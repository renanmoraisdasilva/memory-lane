import {
  buildAdoptionIndex,
  classifyReplicaOutcome,
  matchByHash,
  matchDestinationFile,
  type AdoptionIndex,
} from "../domain/adoption-matcher";
import type { DestinationFileEntry } from "../infrastructure/destination-reader";
import type {
  AdoptionOrphanWrite,
  AdoptionReplicaWrite,
  AdoptionReplicaRow,
} from "../../../db/repositories/replication-adoption-types";
import type { DestinationLibraryFileInput } from "../../../db/repositories/replication-destination-library-repository";
import type { ReplicationSourceFile } from "../../../db/repositories/replication-source-repository";
import { relativePathKey } from "../../../platform/destination-path-policy";

export interface ReplicationFileHasher {
  hash(filePath: string): Promise<string>;
}

export interface SourceHashSaveInput {
  fileId: number;
  sha256: string;
  size: number;
  modifiedAtFs: string | null;
  now: string;
}

export interface ProcessAdoptionFileInput {
  destinationFile: DestinationFileEntry;
  copyRootRelative: string | null;
  index: AdoptionIndex;
  sources: Map<number, ReplicationSourceFile>;
  existingByFileId: Map<number, AdoptionReplicaRow>;
  assignedSourceIds: Set<number>;
  sourceHashes: Map<number, string | null>;
  hasher: ReplicationFileHasher;
  saveSourceHash: (input: SourceHashSaveInput) => Promise<void>;
  now: string;
}

export interface ProcessedAdoptionFile {
  replica: AdoptionReplicaWrite | null;
  orphan: AdoptionOrphanWrite | null;
  touchedFileId: number | null;
  library: DestinationLibraryFileInput;
}

function trustedSourceHash(source: ReplicationSourceFile): boolean {
  return (
    source.sha256 !== null &&
    source.sourceSizeAtHash === source.size &&
    source.sourceModifiedAtFsAtHash === source.modifiedAtFs
  );
}

async function sourceHashFor(
  source: ReplicationSourceFile,
  input: ProcessAdoptionFileInput,
): Promise<string | null> {
  if (input.sourceHashes.has(source.id)) {
    return input.sourceHashes.get(source.id) ?? null;
  }
  if (trustedSourceHash(source) || source.state === "missing") {
    input.sourceHashes.set(source.id, source.sha256);
    return source.sha256;
  }
  try {
    const hash = await input.hasher.hash(source.absolutePath);
    await input.saveSourceHash({
      fileId: source.id,
      sha256: hash,
      size: source.size,
      modifiedAtFs: source.modifiedAtFs,
      now: input.now,
    });
    input.sourceHashes.set(source.id, hash);
    return hash;
  } catch {
    input.sourceHashes.set(source.id, null);
    return null;
  }
}

function libraryEntry(
  file: DestinationFileEntry,
  source: ReplicationSourceFile | null,
  sha256: string | null,
): DestinationLibraryFileInput {
  return {
    relativePath: file.relativePath,
    name: file.name,
    sizeBytes: file.size,
    modifiedAtFs: file.modifiedAtFs,
    mediaClass: source?.mediaClass ?? "other",
    sha256,
    resolvedDate: source?.resolvedDate ?? null,
  };
}

function replicaWrite(input: {
  file: DestinationFileEntry;
  source: ReplicationSourceFile;
  sha256: string | null;
  status: AdoptionReplicaWrite["status"];
  now: string;
  lastError: string | null;
}): AdoptionReplicaWrite {
  return {
    fileId: input.source.id,
    relativePath: input.file.relativePath,
    relativePathKey: relativePathKey(input.file.relativePath),
    sourceRelativePath: input.source.sourceRelativePath,
    sourceRelativePathKey: relativePathKey(input.source.sourceRelativePath),
    sizeBytes: input.file.size,
    sha256: input.sha256,
    status: input.status,
    sourceSizeAtVerify: input.source.size,
    sourceModifiedAtFsAtVerify: input.source.modifiedAtFs,
    destinationSizeAtVerify: input.file.size,
    destinationModifiedAtFsAtVerify: input.file.modifiedAtFs,
    lastCheckedAt: input.now,
    lastError: input.lastError,
  };
}

function orphanWrite(input: {
  file: DestinationFileEntry;
  sha256: string | null;
  classification: AdoptionOrphanWrite["classification"];
  matchedSourceCount: number;
  now: string;
  lastError: string | null;
}): AdoptionOrphanWrite {
  return {
    relativePath: input.file.relativePath,
    relativePathKey: relativePathKey(input.file.relativePath),
    sizeBytes: input.file.size,
    sha256: input.sha256,
    modifiedAtFs: input.file.modifiedAtFs,
    classification: input.classification,
    matchedSourceCount: input.matchedSourceCount,
    lastCheckedAt: input.now,
    lastError: input.lastError,
  };
}

async function hashDestination(
  file: DestinationFileEntry,
  input: ProcessAdoptionFileInput,
): Promise<string | null> {
  try {
    return await input.hasher.hash(file.absolutePath);
  } catch {
    return null;
  }
}

function unreadableResult(
  input: ProcessAdoptionFileInput,
  source: ReplicationSourceFile | null,
  matchedSourceCount: number,
): ProcessedAdoptionFile {
  return {
    replica: null,
    orphan: orphanWrite({
      file: input.destinationFile,
      sha256: null,
      classification: "unreadable",
      matchedSourceCount,
      now: input.now,
      lastError: "Destination file could not be read",
    }),
    touchedFileId: null,
    library: libraryEntry(input.destinationFile, source, null),
  };
}

function ambiguousResult(
  input: ProcessAdoptionFileInput,
  matches: number,
  sha256: string | null,
  source: ReplicationSourceFile | null = null,
): ProcessedAdoptionFile {
  return {
    replica: null,
    orphan: orphanWrite({
      file: input.destinationFile,
      sha256,
      classification: "ambiguous",
      matchedSourceCount: matches,
      now: input.now,
      lastError:
        source === null
          ? "Matched source file is no longer available"
          : "Destination file matches more than one source file",
    }),
    touchedFileId: null,
    library: libraryEntry(input.destinationFile, source, sha256),
  };
}

async function tryFastPath(
  source: ReplicationSourceFile,
  input: ProcessAdoptionFileInput,
): Promise<ProcessedAdoptionFile | null> {
  const file = input.destinationFile;
  const existing = input.existingByFileId.get(source.id) ?? null;
  if (
    existing === null ||
    existing.status !== "verified" ||
    existing.sha256 === null ||
    existing.relativePathKey !== relativePathKey(file.relativePath) ||
    existing.destinationSizeAtVerify !== file.size ||
    existing.destinationModifiedAtFsAtVerify !== file.modifiedAtFs
  ) {
    return null;
  }
  const hash = await sourceHashFor(source, input);
  if (hash === null || hash !== existing.sha256) {
    return null;
  }
  input.assignedSourceIds.add(source.id);
  return {
    replica: null,
    orphan: null,
    touchedFileId: source.id,
    library: libraryEntry(file, source, hash),
  };
}

function duplicateResult(
  source: ReplicationSourceFile,
  input: ProcessAdoptionFileInput,
): ProcessedAdoptionFile {
  return {
    replica: null,
    orphan: orphanWrite({
      file: input.destinationFile,
      sha256: null,
      classification: "extra",
      matchedSourceCount: 1,
      now: input.now,
      lastError: "Duplicate destination copy of a source file",
    }),
    touchedFileId: null,
    library: libraryEntry(input.destinationFile, source, null),
  };
}

async function verifyMatchedSource(
  source: ReplicationSourceFile,
  input: ProcessAdoptionFileInput,
): Promise<ProcessedAdoptionFile> {
  const fastPath = await tryFastPath(source, input);
  if (fastPath !== null) {
    return fastPath;
  }
  if (input.assignedSourceIds.has(source.id)) {
    return duplicateResult(source, input);
  }

  const expectedHash = await sourceHashFor(source, input);
  if (expectedHash === null) {
    input.assignedSourceIds.add(source.id);
    return {
      replica: replicaWrite({
        file: input.destinationFile,
        source,
        sha256: null,
        status: "discovered",
        now: input.now,
        lastError: "Source hash is unavailable",
      }),
      orphan: null,
      touchedFileId: null,
      library: libraryEntry(input.destinationFile, source, null),
    };
  }

  const destinationHash = await hashDestination(input.destinationFile, input);
  if (destinationHash === null) {
    return unreadableResult(input, source, 1);
  }

  input.assignedSourceIds.add(source.id);
  const existing = input.existingByFileId.get(source.id) ?? null;
  const outcome = classifyReplicaOutcome({
    sourceHash: expectedHash,
    destinationHash,
    previous: existing === null ? null : { status: existing.status, sha256: existing.sha256 },
  });
  const lastError =
    outcome === "conflict"
      ? "Destination content differs from the source"
      : outcome === "stale"
        ? "Previous verified copy is out of date"
        : null;
  return {
    replica: replicaWrite({
      file: input.destinationFile,
      source,
      sha256: destinationHash,
      status: outcome,
      now: input.now,
      lastError,
    }),
    orphan: null,
    touchedFileId: null,
    library: libraryEntry(input.destinationFile, source, destinationHash),
  };
}

async function processUnmatchedFile(
  input: ProcessAdoptionFileInput,
): Promise<ProcessedAdoptionFile> {
  const file = input.destinationFile;
  const destinationHash = await hashDestination(file, input);
  if (destinationHash === null) {
    return unreadableResult(input, null, 0);
  }
  const byHash = matchByHash(input.index, destinationHash);
  if (byHash.kind === "matched") {
    const source = input.sources.get(byHash.source.id);
    if (source === undefined) {
      return ambiguousResult(input, 1, destinationHash);
    }
    input.sourceHashes.set(source.id, destinationHash);
    return verifyMatchedSource(source, input);
  }
  if (byHash.kind === "ambiguous") {
    return ambiguousResult(input, byHash.matches, destinationHash);
  }
  return {
    replica: null,
    orphan: orphanWrite({
      file,
      sha256: destinationHash,
      classification: "extra",
      matchedSourceCount: 0,
      now: input.now,
      lastError: null,
    }),
    touchedFileId: null,
    library: libraryEntry(file, null, destinationHash),
  };
}

export async function processAdoptionFile(
  input: ProcessAdoptionFileInput,
): Promise<ProcessedAdoptionFile> {
  const file = input.destinationFile;
  const match = matchDestinationFile(input.index, file, input.copyRootRelative);
  if (match.kind === "matched") {
    const source = input.sources.get(match.source.id);
    return source === undefined
      ? ambiguousResult(input, 1, null)
      : verifyMatchedSource(source, input);
  }
  if (match.kind === "ambiguous") {
    return ambiguousResult(input, match.matches, null);
  }
  return processUnmatchedFile(input);
}

export function adoptionIndexFor(files: ReplicationSourceFile[]): AdoptionIndex {
  return buildAdoptionIndex(
    files.map((file) => ({
      id: file.id,
      sourceRelativePath: file.sourceRelativePath,
      name: file.name,
      size: file.size,
      state: file.state,
      sha256: file.sha256,
    })),
  );
}
