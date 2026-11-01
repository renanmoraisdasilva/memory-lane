import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat } from "node:fs/promises";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { DestinationWriter } from "./destination-writer";

export interface CopySourceExpectation {
  absolutePath: string;
  sizeBytes: number;
  modifiedAtFs: string | null;
  sha256: string | null;
}

export interface CopyFileInput {
  source: CopySourceExpectation;
  writer: DestinationWriter;
  relativePath: string;
  freeBytes: number;
  reserveBytes: number;
  allowReplace: boolean;
}

export type FileCopyResult =
  | {
      status: "verified";
      sha256: string;
      sizeBytes: number;
      modifiedAtFs: string;
    }
  | { status: "source_changed"; message: string }
  | { status: "conflict"; message: string }
  | { status: "insufficient_space"; message: string }
  | { status: "failed"; message: string; retryable: boolean };

function errorCode(error: unknown): string | null {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : null;
}

function retryableCode(code: string | null): boolean {
  return code === "EACCES" || code === "EPERM" || code === "EBUSY" || code === "EMFILE";
}

async function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath, { highWaterMark: 1024 * 1024 });
    stream.on("data", (chunk: string | Buffer) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function hashingTransform(hash: ReturnType<typeof createHash>): Transform {
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      hash.update(chunk);
      callback(null, chunk);
    },
  });
}

async function sourceUnchanged(source: CopySourceExpectation): Promise<boolean> {
  try {
    const info = await lstat(source.absolutePath);
    return (
      info.isFile() &&
      info.size === source.sizeBytes &&
      (source.modifiedAtFs === null || info.mtime.toISOString() === source.modifiedAtFs)
    );
  } catch {
    return false;
  }
}

function failedResult(error: unknown): FileCopyResult {
  const code = errorCode(error);
  const message = error instanceof Error ? error.message : String(error);
  if (code === "ENOSPC") {
    return { status: "insufficient_space", message };
  }
  return { status: "failed", message, retryable: retryableCode(code) };
}

async function preflight(input: CopyFileInput): Promise<FileCopyResult | null> {
  const existing = await input.writer.stat(input.relativePath);
  if (existing !== null && !input.allowReplace) {
    return {
      status: "conflict",
      message: "A destination file already exists at the planned path",
    };
  }
  if (existing !== null && !existing.isFile) {
    return { status: "conflict", message: "The destination path is not a regular file" };
  }
  if (input.freeBytes < input.source.sizeBytes + input.reserveBytes) {
    return {
      status: "insufficient_space",
      message:
        existing === null
          ? "The destination does not have enough safe free space"
          : "The replacement needs temporary peak space beyond the safe reserve",
    };
  }
  return null;
}

async function writeVerifiedCopy(input: CopyFileInput): Promise<FileCopyResult> {
  let temp: Awaited<ReturnType<DestinationWriter["createTemp"]>> | null = null;
  try {
    temp = await input.writer.createTemp(input.relativePath);
    const hash = createHash("sha256");
    await pipeline(
      createReadStream(input.source.absolutePath),
      hashingTransform(hash),
      temp.stream,
    );
    const streamedHash = hash.digest("hex");

    if (!(await sourceUnchanged(input.source))) {
      await input.writer.removeTemp(temp.relativePath);
      return { status: "source_changed", message: "The source file changed during the copy" };
    }
    if (input.source.sha256 !== null && input.source.sha256 !== streamedHash) {
      await input.writer.removeTemp(temp.relativePath);
      return { status: "source_changed", message: "The source hash changed before the copy" };
    }
    const tempHash = await hashFile(temp.absolutePath);
    if (tempHash !== streamedHash) {
      await input.writer.removeTemp(temp.relativePath);
      return {
        status: "failed",
        message: "The destination temporary file did not match the copied bytes",
        retryable: true,
      };
    }

    await input.writer.renameTemp(temp.relativePath, input.relativePath);
    temp = null;
    const final = await input.writer.stat(input.relativePath);
    if (final === null || !final.isFile || final.sizeBytes !== input.source.sizeBytes) {
      return {
        status: "failed",
        message: "The destination file could not be verified after the copy",
        retryable: true,
      };
    }
    return {
      status: "verified",
      sha256: streamedHash,
      sizeBytes: final.sizeBytes,
      modifiedAtFs: final.modifiedAtFs,
    };
  } catch (error) {
    if (temp !== null) {
      await input.writer.removeTemp(temp.relativePath).catch(() => undefined);
    }
    throw error;
  }
}

export async function copyVerifiedFile(input: CopyFileInput): Promise<FileCopyResult> {
  const blocked = await preflight(input);
  if (blocked !== null) {
    return blocked;
  }
  try {
    return await writeVerifiedCopy(input);
  } catch (error) {
    return failedResult(error);
  }
}
