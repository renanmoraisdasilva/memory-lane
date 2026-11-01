import { randomUUID } from "node:crypto";
import { createWriteStream, type WriteStream } from "node:fs";
import { lstat, mkdir, realpath, rename, rmdir, statfs, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { assertPathInside } from "../../../platform/path-guard";
import { resolveRelativePath } from "../../../platform/destination-path-policy";

const TEMP_PREFIX = ".memorylane-tmp-";

export interface DestinationTempFile {
  relativePath: string;
  absolutePath: string;
  stream: WriteStream;
}

export interface DestinationStat {
  sizeBytes: number;
  modifiedAtFs: string;
  isFile: boolean;
}

export interface DestinationWriter {
  mkdir(relativePath: string): Promise<void>;
  writeText(relativePath: string, text: string): Promise<void>;
  stat(relativePath: string): Promise<DestinationStat | null>;
  freeBytes(): Promise<number>;
  createTemp(relativePath: string): Promise<DestinationTempFile>;
  renameTemp(tempRelativePath: string, relativePath: string): Promise<void>;
  removeTemp(tempRelativePath: string): Promise<void>;
  removeEmptyDirectory(relativePath: string): Promise<void>;
}

async function realDestinationRoot(root: string): Promise<string> {
  await mkdir(root, { recursive: true });
  return realpath(root);
}

async function assertRealParentInside(root: string, absolutePath: string): Promise<void> {
  const resolvedRoot = await realDestinationRoot(root);
  const parent = await realpath(path.dirname(absolutePath));
  try {
    assertPathInside(resolvedRoot, parent);
  } catch {
    throw new AppError(
      APP_ERROR_CODES.DESTINATION_WRITE_FAILED,
      "The destination path escapes its registered root",
      { rootPath: root, path: absolutePath },
    );
  }
}

function resolveFile(root: string, relativePath: string): string {
  try {
    return resolveRelativePath(root, relativePath);
  } catch (error) {
    throw new AppError(
      APP_ERROR_CODES.DESTINATION_WRITE_FAILED,
      error instanceof Error ? error.message : "Invalid destination path",
      { rootPath: root, relativePath },
    );
  }
}

async function ensureParent(root: string, absolutePath: string): Promise<void> {
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await assertRealParentInside(root, absolutePath);
}

function isTempName(filePath: string): boolean {
  return path.basename(filePath).startsWith(TEMP_PREFIX);
}

function tempPath(target: string): string {
  return path.join(path.dirname(target), `${TEMP_PREFIX}${randomUUID()}`);
}

export function createDestinationWriter(rootPath: string): DestinationWriter {
  const root = path.resolve(rootPath);
  return {
    async mkdir(relativePath) {
      if (relativePath.trim().length === 0) {
        return;
      }
      const absolutePath = resolveFile(root, relativePath);
      await mkdir(absolutePath, { recursive: true });
      await assertRealParentInside(root, absolutePath);
    },

    async writeText(relativePath, text) {
      const target = resolveFile(root, relativePath);
      await ensureParent(root, target);
      const tempAbsolutePath = tempPath(target);
      await writeFile(tempAbsolutePath, text, { encoding: "utf8", flag: "wx" });
      try {
        await rename(tempAbsolutePath, target);
      } catch (error) {
        await unlink(tempAbsolutePath).catch(() => undefined);
        throw error;
      }
    },

    async stat(relativePath) {
      const target = resolveFile(root, relativePath);
      try {
        await assertRealParentInside(root, target);
        const info = await lstat(target);
        return {
          sizeBytes: info.size,
          modifiedAtFs: info.mtime.toISOString(),
          isFile: info.isFile(),
        };
      } catch {
        return null;
      }
    },

    async freeBytes() {
      await mkdir(root, { recursive: true });
      const info = await statfs(root);
      return Number(info.bsize) * Number(info.bavail);
    },

    async createTemp(relativePath) {
      const target = resolveFile(root, relativePath);
      await ensureParent(root, target);
      const tempAbsolutePath = tempPath(target);
      const stream = createWriteStream(tempAbsolutePath, { flags: "wx" });
      return {
        relativePath: path.relative(root, tempAbsolutePath),
        absolutePath: tempAbsolutePath,
        stream,
      };
    },

    async renameTemp(tempRelativePath, relativePath) {
      const temp = resolveFile(root, tempRelativePath);
      if (!isTempName(temp)) {
        throw new AppError(APP_ERROR_CODES.DESTINATION_WRITE_FAILED, "Invalid temporary file name");
      }
      const target = resolveFile(root, relativePath);
      await ensureParent(root, target);
      await rename(temp, target);
    },

    async removeTemp(tempRelativePath) {
      const temp = resolveFile(root, tempRelativePath);
      if (!isTempName(temp)) {
        throw new AppError(APP_ERROR_CODES.DESTINATION_WRITE_FAILED, "Invalid temporary file name");
      }
      await unlink(temp).catch(() => undefined);
    },

    async removeEmptyDirectory(relativePath) {
      const target = resolveFile(root, relativePath);
      await assertRealParentInside(root, target);
      await rmdir(target).catch(() => undefined);
    },
  };
}
