import path from "node:path";
import type { RunError } from "@shared/contracts/replication/types";
import type { ReplicationSourceFile } from "../../../db/repositories/replication-source-repository";
import { relativePathKey } from "../../../platform/destination-path-policy";
import { trustedSourceHashValue } from "../domain/source-hash-trust";
import { copyVerifiedFile, type FileCopyResult } from "../infrastructure/file-copier";
import type { DestinationWriter } from "../infrastructure/destination-writer";
import type { ExecutionDestination } from "./plan-service";
import type { RunControl } from "./run-control";
import type { RunOutcome, RunRunnerDependencies } from "./run-runner-types";

const MAX_FAILED_RETRIES = 3;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function addError(control: RunControl, error: RunError): void {
  control.errors.push(error);
  if (control.errors.length > 50) {
    control.errors.splice(0, control.errors.length - 50);
  }
}

function trustedHash(file: ReplicationSourceFile): string | null {
  return trustedSourceHashValue(file);
}

function updateSpeed(control: RunControl, now: Date): void {
  const seconds = Math.max(0.001, (now.getTime() - control.startedMs) / 1000);
  control.speedBytesPerSecond =
    control.processedFiles === 0 ? null : control.processedBytes / seconds;
}

function destinationPath(
  record: ExecutionDestination["destination"],
  file: ReplicationSourceFile,
): string {
  return record.copyRootRelative === null
    ? file.sourceRelativePath
    : path.join(record.copyRootRelative, file.sourceRelativePath);
}

async function saveVerifiedFile(input: {
  dependencies: RunRunnerDependencies;
  runId: number;
  assignment: ExecutionDestination;
  file: ReplicationSourceFile;
  root: string;
  relativePath: string;
  result: Extract<FileCopyResult, { status: "verified" }>;
}): Promise<void> {
  const { dependencies, assignment, file, result, relativePath } = input;
  const now = dependencies.now().toISOString();
  await dependencies.db.request("replication.saveRunFileResult", {
    runId: input.runId,
    destinationRowId: assignment.destination.id,
    fileId: file.id,
    relativePath,
    relativePathKey: relativePathKey(relativePath),
    sourceRelativePath: file.sourceRelativePath,
    sourceRelativePathKey: relativePathKey(file.sourceRelativePath),
    sizeBytes: result.sizeBytes,
    sha256: result.sha256,
    status: "verified",
    sourceSizeAtVerify: file.size,
    sourceModifiedAtFsAtVerify: file.modifiedAtFs,
    destinationSizeAtVerify: result.sizeBytes,
    destinationModifiedAtFsAtVerify: result.modifiedAtFs,
    lastCheckedAt: now,
    lastError: null,
  });
  try {
    await dependencies.db.request("replication.saveDestinationLibraryFile", {
      destinationId: assignment.destination.id,
      destinationRoot: input.root,
      runStartedAt: now,
      now,
      files: [
        {
          relativePath,
          name: file.name,
          sizeBytes: result.sizeBytes,
          modifiedAtFs: result.modifiedAtFs,
          mediaClass: file.mediaClass,
          sha256: result.sha256,
          resolvedDate: file.resolvedDate,
        },
      ],
    });
  } catch (error) {
    dependencies.logger.warn("Destination library update failed after copy", {
      message: errorText(error),
    });
  }
}

async function saveFailedFile(input: {
  dependencies: RunRunnerDependencies;
  runId: number;
  assignment: ExecutionDestination;
  file: ReplicationSourceFile;
  relativePath: string;
  status: "failed" | "stale" | "conflict";
  message: string;
}): Promise<void> {
  const { dependencies, assignment, file, relativePath, status, message } = input;
  const now = dependencies.now().toISOString();
  await dependencies.db.request("replication.saveRunFileResult", {
    runId: input.runId,
    destinationRowId: assignment.destination.id,
    fileId: file.id,
    relativePath,
    relativePathKey: relativePathKey(relativePath),
    sourceRelativePath: file.sourceRelativePath,
    sourceRelativePathKey: relativePathKey(file.sourceRelativePath),
    sizeBytes: file.size,
    sha256: trustedHash(file),
    status,
    sourceSizeAtVerify: file.size,
    sourceModifiedAtFsAtVerify: file.modifiedAtFs,
    destinationSizeAtVerify: null,
    destinationModifiedAtFsAtVerify: null,
    lastCheckedAt: now,
    lastError: message,
  });
}

interface CopyAttempt {
  result: FileCopyResult;
}

async function copyWithRetries(input: {
  dependencies: RunRunnerDependencies;
  file: ReplicationSourceFile;
  writer: DestinationWriter;
  relativePath: string;
  allowReplace: boolean;
  reserveBytes: number;
}): Promise<CopyAttempt> {
  const { dependencies, file, writer, relativePath } = input;
  let last: FileCopyResult = {
    status: "failed",
    message: "The copy did not start",
    retryable: false,
    code: "COPY_FAILED",
  };
  for (let attempt = 1; attempt <= MAX_FAILED_RETRIES; attempt += 1) {
    const freeBytes = await writer.freeBytes();
    last = await copyVerifiedFile({
      source: {
        absolutePath: file.absolutePath,
        sizeBytes: file.size,
        modifiedAtFs: file.modifiedAtFs,
        sha256: trustedHash(file),
      },
      writer,
      relativePath,
      freeBytes,
      reserveBytes: input.reserveBytes,
      allowReplace: input.allowReplace,
    });
    if (last.status === "source_changed" && attempt < 2) {
      continue;
    }
    if (last.status === "failed" && last.retryable && attempt < MAX_FAILED_RETRIES) {
      await dependencies.sleep(100 * attempt);
      continue;
    }
    return { result: last };
  }
  return { result: last };
}

interface FileProcessInput {
  dependencies: RunRunnerDependencies;
  runId: number;
  assignment: ExecutionDestination;
  file: ReplicationSourceFile;
  root: string;
  writer: DestinationWriter;
  replaceStale: boolean;
}

async function applyCopyResult(
  input: FileProcessInput,
  result: FileCopyResult,
): Promise<"continue" | "destination_full" | RunOutcome> {
  const { dependencies, assignment, file, root } = input;
  const relativePath = destinationPath(assignment.destination, file);
  if (result.status === "verified") {
    await saveVerifiedFile({
      dependencies,
      runId: input.runId,
      assignment,
      file,
      root,
      relativePath,
      result,
    });
    if (result.sha256 !== trustedHash(file)) {
      await dependencies.db.request("replication.saveSourceHash", {
        fileId: file.id,
        sha256: result.sha256,
        size: file.size,
        modifiedAtFs: file.modifiedAtFs,
        now: dependencies.now().toISOString(),
      });
    }
    dependencies.control.processedFiles += 1;
    dependencies.control.processedBytes += result.sizeBytes;
    updateSpeed(dependencies.control, dependencies.now());
    return "continue";
  }
  if (result.status === "insufficient_space") {
    addError(dependencies.control, {
      code: "DESTINATION_FULL",
      message: result.message,
      retryable: true,
    });
    return "destination_full";
  }
  if (result.status === "conflict") {
    addError(dependencies.control, {
      code: "CONFLICT_REVIEW_REQUIRED",
      message: result.message,
      retryable: false,
    });
    await saveFailedFile({
      dependencies,
      runId: input.runId,
      assignment,
      file,
      relativePath,
      status: "conflict",
      message: result.message,
    });
    return "continue";
  }
  if (result.status === "source_changed") {
    addError(dependencies.control, {
      code: "SOURCE_CHANGED",
      message: result.message,
      retryable: true,
    });
    await saveFailedFile({
      dependencies,
      runId: input.runId,
      assignment,
      file,
      relativePath,
      status: "stale",
      message: result.message,
    });
    return "continue";
  }
  addError(dependencies.control, {
    code: result.code,
    message: result.message,
    retryable: result.retryable,
  });
  await saveFailedFile({
    dependencies,
    runId: input.runId,
    assignment,
    file,
    relativePath,
    status: "failed",
    message: result.message,
  });
  return "continue";
}

export async function processFile(
  input: FileProcessInput,
): Promise<"continue" | "destination_full" | RunOutcome> {
  const { dependencies, assignment, file, writer } = input;
  const relativePath = destinationPath(assignment.destination, file);
  const existing = await dependencies.db.request<{
    status: string;
  } | null>("replication.getExistingReplica", {
    destinationRowId: assignment.destination.id,
    fileId: file.id,
  });
  const allowReplace =
    input.replaceStale &&
    existing !== null &&
    (existing.status === "stale" || existing.status === "missing");
  const attempt = await copyWithRetries({
    dependencies,
    file,
    writer,
    relativePath,
    allowReplace,
    reserveBytes: assignment.destination.reserveBytes,
  });
  return applyCopyResult(input, attempt.result);
}
