import { randomUUID } from "node:crypto";
import { createWriteStream, type WriteStream } from "node:fs";
import { mkdir, realpath, rename, rmdir, unlink, writeFile } from "node:fs/promises";
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

export interface DestinationWriter {
  mkdir(relativePath: string): Promise<void>;
  writeText(relativePath: string, text: string): Promise<void>;
  createTemp(relativePath: string): Promise<DestinationTempFile>;
  renameTemp(tempRelativePath: string, relativePath: string): Promise<void>;
  removeTemp(tempRelativePath: string): Promise<void>;
  removeEmptyDirectory(relativePath: string): Promise<void>;
}

export function createDestinationWriter(rootPath: string): DestinationWriter {
  const root = path.resolve(rootPath);

  const realRoot = async (): Promise<string> => {
    await mkdir(root, { recursive: true });
    return realpath(root);
  };

  const assertRealParentInside = async (absolutePath: string): Promise<void> => {
    const resolvedRoot = await realRoot();
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
  };

  const resolveFile = (relativePath: string): string => {
    try {
      return resolveRelativePath(root, relativePath);
    } catch (error) {
      throw new AppError(
        APP_ERROR_CODES.DESTINATION_WRITE_FAILED,
        error instanceof Error ? error.message : "Invalid destination path",
        { rootPath: root, relativePath },
      );
    }
  };

  const ensureParent = async (absolutePath: string): Promise<void> => {
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await assertRealParentInside(absolutePath);
  };

  const isTempName = (filePath: string): boolean => path.basename(filePath).startsWith(TEMP_PREFIX);

  return {
    async mkdir(relativePath) {
      if (relativePath.trim().length === 0) {
        return;
      }
      const absolutePath = resolveFile(relativePath);
      await mkdir(absolutePath, { recursive: true });
      await assertRealParentInside(absolutePath);
    },

    async writeText(relativePath, text) {
      const target = resolveFile(relativePath);
      await ensureParent(target);
      const tempName = `${TEMP_PREFIX}${randomUUID()}`;
      const tempAbsolutePath = path.join(path.dirname(target), tempName);
      await writeFile(tempAbsolutePath, text, { encoding: "utf8", flag: "wx" });
      try {
        await rename(tempAbsolutePath, target);
      } catch (error) {
        await unlink(tempAbsolutePath).catch(() => undefined);
        throw error;
      }
    },

    async createTemp(relativePath) {
      const target = resolveFile(relativePath);
      await ensureParent(target);
      const tempName = `${TEMP_PREFIX}${randomUUID()}`;
      const tempAbsolutePath = path.join(path.dirname(target), tempName);
      const stream = createWriteStream(tempAbsolutePath, { flags: "wx" });
      return {
        relativePath: path.relative(root, tempAbsolutePath),
        absolutePath: tempAbsolutePath,
        stream,
      };
    },

    async renameTemp(tempRelativePath, relativePath) {
      const temp = resolveFile(tempRelativePath);
      if (!isTempName(temp)) {
        throw new AppError(APP_ERROR_CODES.DESTINATION_WRITE_FAILED, "Invalid temporary file name");
      }
      const target = resolveFile(relativePath);
      await ensureParent(target);
      await rename(temp, target);
    },

    async removeTemp(tempRelativePath) {
      const temp = resolveFile(tempRelativePath);
      if (!isTempName(temp)) {
        throw new AppError(APP_ERROR_CODES.DESTINATION_WRITE_FAILED, "Invalid temporary file name");
      }
      await unlink(temp).catch(() => undefined);
    },

    async removeEmptyDirectory(relativePath) {
      const target = resolveFile(relativePath);
      await assertRealParentInside(target);
      await rmdir(target).catch(() => undefined);
    },
  };
}
