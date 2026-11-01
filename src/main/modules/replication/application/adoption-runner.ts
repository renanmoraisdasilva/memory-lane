import type { DbClient } from "../../../clients/db-client";
import type { Logger } from "../../../logging/types";
import type {
  AdoptionOrphanWrite,
  AdoptionReplicaRow,
  AdoptionReplicaWrite,
} from "../../../db/repositories/replication-adoption-types";
import type { DestinationLibraryFileInput } from "../../../db/repositories/replication-destination-library-repository";
import type { ReplicationSourceFile } from "../../../db/repositories/replication-source-repository";
import { relativePathKey } from "../../../platform/destination-path-policy";
import type {
  DestinationReader,
  DestinationScanResult,
} from "../infrastructure/destination-reader";
import {
  adoptionIndexFor,
  processAdoptionFile,
  type ReplicationFileHasher,
} from "./adoption-file-processor";
import type { AdoptionIndex } from "../domain/adoption-matcher";

const BATCH_SIZE = 20;

export interface AdoptionControl {
  paused: boolean;
  cancelled: boolean;
  currentFile: string | null;
  etaSeconds: number | null;
  totalFiles: number;
}

export type AdoptionRunStatus = "complete" | "paused" | "interrupted";

export interface AdoptionRunDependencies {
  db: DbClient;
  reader: DestinationReader;
  hasher: ReplicationFileHasher;
  logger: Logger;
  now: () => Date;
  control: AdoptionControl;
}

export interface AdoptionRunInput {
  destinationRowId: number;
  destinationRoot: string;
  copyRootRelative: string | null;
  runStartedAt: string;
}

interface RunContext {
  sources: Map<number, ReplicationSourceFile>;
  index: AdoptionIndex;
  existingByFileId: Map<number, AdoptionReplicaRow>;
  assignedSourceIds: Set<number>;
  sourceHashes: Map<number, string | null>;
  seenFileIds: Set<number>;
  seenOrphanPathKeys: Set<string>;
  scan: DestinationScanResult;
  startedMs: number;
}

interface BatchResult {
  replicas: AdoptionReplicaWrite[];
  orphans: AdoptionOrphanWrite[];
  touchedReplicaFileIds: number[];
  libraryFiles: DestinationLibraryFileInput[];
  stopped: AdoptionRunStatus | null;
}

function skippedOrphans(scan: DestinationScanResult, runStartedAt: string): AdoptionOrphanWrite[] {
  return scan.skipped.map((entry) => ({
    relativePath: entry.relativePath,
    relativePathKey: relativePathKey(entry.relativePath),
    sizeBytes: 0,
    sha256: null,
    modifiedAtFs: null,
    classification: "unreadable",
    matchedSourceCount: 0,
    lastCheckedAt: runStartedAt,
    lastError: entry.reason,
  }));
}

async function createContext(
  dependencies: AdoptionRunDependencies,
  input: AdoptionRunInput,
): Promise<RunContext> {
  const { db, reader } = dependencies;
  const [sources, existing, scan] = await Promise.all([
    db.request<ReplicationSourceFile[]>("replication.listSourceFiles", {}),
    db.request<AdoptionReplicaRow[]>("replication.listAdoptionReplicas", {
      destinationId: input.destinationRowId,
    }),
    reader.scan(input.destinationRoot),
  ]);
  return {
    sources: new Map(sources.map((file) => [file.id, file])),
    index: adoptionIndexFor(sources),
    existingByFileId: new Map(existing.map((replica) => [replica.fileId, replica])),
    assignedSourceIds: new Set(),
    sourceHashes: new Map(),
    seenFileIds: new Set(),
    seenOrphanPathKeys: new Set(),
    scan,
    startedMs: dependencies.now().getTime(),
  };
}

async function processBatch(
  dependencies: AdoptionRunDependencies,
  input: AdoptionRunInput,
  context: RunContext,
  batch: DestinationScanResult["files"],
): Promise<BatchResult> {
  const result: BatchResult = {
    replicas: [],
    orphans: [],
    touchedReplicaFileIds: [],
    libraryFiles: [],
    stopped: null,
  };
  for (const file of batch) {
    const stop = stopStatus(dependencies.control);
    if (stop !== null) {
      result.stopped = stop;
      break;
    }
    dependencies.control.currentFile = file.relativePath;
    const processed = await processAdoptionFile({
      destinationFile: file,
      copyRootRelative: input.copyRootRelative,
      index: context.index,
      sources: context.sources,
      existingByFileId: context.existingByFileId,
      assignedSourceIds: context.assignedSourceIds,
      sourceHashes: context.sourceHashes,
      hasher: dependencies.hasher,
      now: input.runStartedAt,
      saveSourceHash: (hash) =>
        dependencies.db.request("replication.saveSourceHash", hash).then(() => undefined),
    });
    if (processed.replica !== null) {
      result.replicas.push(processed.replica);
      context.seenFileIds.add(processed.replica.fileId);
    }
    if (processed.touchedFileId !== null) {
      result.touchedReplicaFileIds.push(processed.touchedFileId);
      context.seenFileIds.add(processed.touchedFileId);
    }
    if (processed.orphan !== null) {
      result.orphans.push(processed.orphan);
      context.seenOrphanPathKeys.add(processed.orphan.relativePathKey);
    }
    result.libraryFiles.push(processed.library);
  }
  return result;
}

async function persistBatch(
  dependencies: AdoptionRunDependencies,
  input: AdoptionRunInput,
  result: BatchResult,
): Promise<void> {
  await dependencies.db.request("replication.saveAdoptionBatch", {
    destinationId: input.destinationRowId,
    replicas: result.replicas,
    orphans: result.orphans,
    touchedReplicaFileIds: result.touchedReplicaFileIds,
    now: input.runStartedAt,
  });
  try {
    await dependencies.db.request("replication.upsertDestinationLibrary", {
      destinationId: input.destinationRowId,
      destinationRoot: input.destinationRoot,
      runStartedAt: input.runStartedAt,
      now: input.runStartedAt,
      files: result.libraryFiles,
    });
  } catch (error) {
    dependencies.logger.warn("Destination library update failed during adoption", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function stopStatus(control: AdoptionControl): AdoptionRunStatus | null {
  if (control.cancelled) {
    return "interrupted";
  }
  if (control.paused) {
    return "paused";
  }
  return null;
}

interface EtaInput {
  control: AdoptionControl;
  processedCount: number;
  total: number;
  startedMs: number;
  now: Date;
}

function updateEta(input: EtaInput): void {
  if (input.processedCount === 0) {
    input.control.etaSeconds = null;
    return;
  }
  const elapsedMs = Math.max(1, input.now.getTime() - input.startedMs);
  input.control.etaSeconds = Math.max(
    0,
    Math.round(((elapsedMs / input.processedCount) * (input.total - input.processedCount)) / 1000),
  );
}

export async function runAdoption(
  dependencies: AdoptionRunDependencies,
  input: AdoptionRunInput,
): Promise<AdoptionRunStatus> {
  const { control } = dependencies;
  const context = await createContext(dependencies, input);
  const { files } = context.scan;
  control.totalFiles = files.length;
  const skipped = skippedOrphans(context.scan, input.runStartedAt);
  for (const orphan of skipped) {
    context.seenOrphanPathKeys.add(orphan.relativePathKey);
  }

  for (let start = 0; start < files.length; start += BATCH_SIZE) {
    const stop = stopStatus(control);
    if (stop !== null) {
      return stop;
    }
    const batch = files.slice(start, start + BATCH_SIZE);
    const result = await processBatch(dependencies, input, context, batch);
    if (start === 0) {
      result.orphans.push(...skipped);
    }
    await persistBatch(dependencies, input, result);
    if (result.stopped !== null) {
      return result.stopped;
    }
    updateEta({
      control,
      processedCount: start + batch.length,
      total: files.length,
      startedMs: context.startedMs,
      now: dependencies.now(),
    });
  }

  await dependencies.db.request("replication.markUnseenReplicasMissing", {
    destinationId: input.destinationRowId,
    seenFileIds: [...context.seenFileIds],
    seenOrphanPathKeys: [...context.seenOrphanPathKeys],
    now: input.runStartedAt,
  });
  control.currentFile = null;
  control.etaSeconds = 0;
  return "complete";
}
