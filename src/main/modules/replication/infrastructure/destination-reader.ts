import type { Dirent } from "node:fs";
import { lstat, opendir, realpath } from "node:fs/promises";
import path from "node:path";
import { isPathInside } from "../../../platform/path-guard";

export interface DestinationFileEntry {
  relativePath: string;
  absolutePath: string;
  name: string;
  size: number;
  modifiedAtFs: string;
}

export interface DestinationSkippedEntry {
  relativePath: string;
  reason: string;
}

export interface DestinationScanResult {
  files: DestinationFileEntry[];
  skipped: DestinationSkippedEntry[];
}

export interface DestinationReader {
  scan(rootPath: string): Promise<DestinationScanResult>;
}

const SKIPPED_DIRECTORIES = new Set([
  "$recycle.bin",
  "system volume information",
  "lost+found",
  ".trash-1000",
]);

function isSkippedMemoryLaneDirectory(relativePath: string): boolean {
  const normalized = relativePath.replaceAll("/", "\\").toLowerCase();
  return (
    normalized === ".memorylane\\replicas" ||
    normalized.startsWith(".memorylane\\replicas\\") ||
    normalized === ".memorylane\\cache" ||
    normalized.startsWith(".memorylane\\cache\\")
  );
}

function shouldSkipDirectory(entryName: string, relativePath: string): boolean {
  return (
    SKIPPED_DIRECTORIES.has(entryName.toLowerCase()) || isSkippedMemoryLaneDirectory(relativePath)
  );
}

function shouldSkipFile(relativePath: string): boolean {
  const normalized = relativePath.replaceAll("/", "\\").toLowerCase();
  const name = path.win32.basename(normalized);
  if (name.startsWith(".memorylane-tmp-")) {
    return true;
  }
  return (
    normalized === ".memorylane\\catalog.db" ||
    normalized === ".memorylane\\catalog.db-wal" ||
    normalized === ".memorylane\\catalog.db-shm" ||
    normalized === ".memorylane\\catalog.lock"
  );
}

function joinRelative(parent: string, name: string): string {
  return parent.length === 0 ? name : path.join(parent, name);
}

async function readFileEntry(
  absolutePath: string,
  relativePath: string,
  name: string,
): Promise<DestinationFileEntry | null> {
  const stats = await lstat(absolutePath);
  if (stats.isSymbolicLink() || !stats.isFile()) {
    return null;
  }
  return {
    relativePath,
    absolutePath,
    name,
    size: stats.size,
    modifiedAtFs: stats.mtime.toISOString(),
  };
}

interface ScanState {
  files: DestinationFileEntry[];
  skipped: DestinationSkippedEntry[];
}

async function scanFile(
  absolutePath: string,
  relativePath: string,
  name: string,
  state: ScanState,
): Promise<void> {
  try {
    const file = await readFileEntry(absolutePath, relativePath, name);
    if (file === null) {
      state.skipped.push({ relativePath, reason: "Not a regular file" });
      return;
    }
    state.files.push(file);
  } catch (error) {
    state.skipped.push({
      relativePath,
      reason: error instanceof Error ? error.message : "Unable to stat file",
    });
  }
}

interface WalkContext {
  realRoot: string;
  state: ScanState;
}

async function handleDirectory(
  entryName: string,
  absolutePath: string,
  relativePath: string,
  context: WalkContext,
): Promise<void> {
  if (shouldSkipDirectory(entryName, relativePath)) {
    return;
  }
  try {
    const resolved = await realpath(absolutePath);
    if (!isPathInside(context.realRoot, resolved)) {
      context.state.skipped.push({
        relativePath,
        reason: "Directory resolves outside the destination root",
      });
      return;
    }
    await walk(absolutePath, relativePath, context);
  } catch (error) {
    context.state.skipped.push({
      relativePath,
      reason: error instanceof Error ? error.message : "Unable to resolve directory",
    });
  }
}

async function handleEntry(
  entry: Dirent,
  absoluteDirectory: string,
  relativeDirectory: string,
  context: WalkContext,
): Promise<void> {
  const relativePath = joinRelative(relativeDirectory, entry.name);
  const absolutePath = path.join(absoluteDirectory, entry.name);
  if (entry.isSymbolicLink()) {
    context.state.skipped.push({
      relativePath,
      reason: "Symlink or junction was not followed",
    });
    return;
  }
  if (entry.isDirectory()) {
    await handleDirectory(entry.name, absolutePath, relativePath, context);
    return;
  }
  if (entry.isFile() && !shouldSkipFile(relativePath)) {
    await scanFile(absolutePath, relativePath, entry.name, context.state);
  }
}

async function walk(
  absoluteDirectory: string,
  relativeDirectory: string,
  context: WalkContext,
): Promise<void> {
  let directory;
  try {
    directory = await opendir(absoluteDirectory);
  } catch (error) {
    context.state.skipped.push({
      relativePath: relativeDirectory,
      reason: error instanceof Error ? error.message : "Unable to read directory",
    });
    return;
  }
  for await (const entry of directory) {
    await handleEntry(entry, absoluteDirectory, relativeDirectory, context);
  }
}

export function createDestinationReader(): DestinationReader {
  return {
    async scan(rootPath: string): Promise<DestinationScanResult> {
      const root = path.resolve(rootPath);
      const realRoot = await realpath(root);
      const state: ScanState = { files: [], skipped: [] };
      await walk(root, "", { realRoot, state });
      state.files.sort((left, right) =>
        left.relativePath.toLowerCase().localeCompare(right.relativePath.toLowerCase()),
      );
      return state;
    },
  };
}
