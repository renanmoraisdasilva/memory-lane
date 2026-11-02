import type { Dirent, Stats } from "node:fs";
import { lstat, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { ScannedFile } from "../domain/scan-files";
import { classifyFile } from "./file-metadata";

const DEFAULT_BATCH_SIZE = 500;
const SYSTEM_DIRECTORIES = new Set([
  "System Volume Information",
  "$RECYCLE.BIN",
  ".memorylane_quarantine",
]);

export interface EnumerateOptions {
  batchSize?: number;
  onError?: (filePath: string, error: Error) => void;
}

export interface EnumerateResult {
  fileCount: number;
  hadErrors: boolean;
}

interface WalkContext {
  appDirectory: string;
  batchSize: number;
  onBatch: (files: ScannedFile[]) => Promise<void>;
  options: EnumerateOptions;
  pending: ScannedFile[];
  stack: string[];
  fileCount: number;
  hadErrors: boolean;
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function isSamePath(left: string, right: string): boolean {
  return process.platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right;
}

function toScannedFile(fullPath: string, stats: Stats): ScannedFile {
  const classification = classifyFile(fullPath);
  return {
    path: fullPath,
    name: path.basename(fullPath),
    extension: classification.extension,
    size: stats.size,
    createdAtFs: stats.birthtimeMs > 0 ? stats.birthtime.toISOString() : null,
    modifiedAtFs: stats.mtime.toISOString(),
    linkCount: stats.nlink,
    mediaClass: classification.mediaClass,
    format: classification.format,
    mime: classification.mime,
  };
}

function reportError(context: WalkContext, filePath: string, error: unknown): void {
  context.hadErrors = true;
  context.options.onError?.(filePath, normalizeError(error));
}

async function flushPending(context: WalkContext): Promise<void> {
  if (context.pending.length === 0) {
    return;
  }
  const files = context.pending.splice(0, context.pending.length);
  await context.onBatch(files);
}

async function readDirectory(directory: string, context: WalkContext): Promise<Dirent[] | null> {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error) {
    reportError(context, directory, error);
    return null;
  }
}

async function queueDirectory(fullPath: string, name: string, context: WalkContext): Promise<void> {
  if (isSamePath(fullPath, context.appDirectory) || SYSTEM_DIRECTORIES.has(name)) {
    return;
  }
  try {
    const stats = await lstat(fullPath);
    if (!stats.isSymbolicLink()) {
      context.stack.push(fullPath);
    }
  } catch (error) {
    reportError(context, fullPath, error);
  }
}

async function addFile(fullPath: string, context: WalkContext): Promise<void> {
  try {
    const stats = await stat(fullPath);
    if (!stats.isFile()) {
      return;
    }
    context.pending.push(toScannedFile(fullPath, stats));
    context.fileCount += 1;
    if (context.pending.length >= context.batchSize) {
      await flushPending(context);
    }
  } catch (error) {
    reportError(context, fullPath, error);
  }
}

async function processEntry(entry: Dirent, directory: string, context: WalkContext): Promise<void> {
  const fullPath = path.join(directory, entry.name);
  if (entry.isSymbolicLink()) {
    return;
  }
  if (entry.isDirectory()) {
    await queueDirectory(fullPath, entry.name, context);
    return;
  }
  if (entry.isFile()) {
    await addFile(fullPath, context);
  }
}

async function collectDirectory(directory: string, context: WalkContext): Promise<void> {
  const entries = await readDirectory(directory, context);
  if (entries === null) {
    return;
  }
  for (const entry of entries) {
    await processEntry(entry, directory, context);
  }
}

export async function enumerateFiles(
  rootPath: string,
  onBatch: (files: ScannedFile[]) => Promise<void>,
  options: EnumerateOptions = {},
): Promise<EnumerateResult> {
  const root = path.resolve(rootPath);
  let rootStats: Stats;
  try {
    rootStats = await stat(root);
  } catch {
    throw new AppError(APP_ERROR_CODES.DRIVE_NOT_FOUND, "The drive folder is not available", {
      rootPath: root,
    });
  }
  if (!rootStats.isDirectory()) {
    throw new AppError(APP_ERROR_CODES.DRIVE_NOT_FOUND, "The scan root is not a directory", {
      rootPath: root,
    });
  }

  const context: WalkContext = {
    appDirectory: path.join(root, ".memorylane"),
    batchSize: options.batchSize ?? DEFAULT_BATCH_SIZE,
    onBatch,
    options,
    pending: [],
    stack: [root],
    fileCount: 0,
    hadErrors: false,
  };

  while (context.stack.length > 0) {
    const directory = context.stack.pop();
    if (directory === undefined) {
      break;
    }
    await collectDirectory(directory, context);
  }

  await flushPending(context);
  return { fileCount: context.fileCount, hadErrors: context.hadErrors };
}
