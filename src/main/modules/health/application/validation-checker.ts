import { access, stat } from "node:fs/promises";
import path from "node:path";
import type { ValidationLevel } from "@shared/contracts/health";
import type { DbClient } from "../../../clients/db-client";
import type { MetadataSaveItem, PendingMetadataFile } from "../../scanning/domain/scan-files";
import type { FileHasher, FileMetadataExtractor } from "../../scanning/domain/scan-files";
import type { ValidationResultInput } from "../../../db/repositories/validation-repository";

export interface ValidationFile {
  fileId: number;
  path: string;
  sizeBytes: number;
  createdAtFs: string | null;
  modifiedAtFs: string | null;
  state: "present" | "missing";
  sha256: string | null;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class ValidationChecker {
  constructor(
    private readonly db: DbClient,
    private readonly hasher: FileHasher,
    private readonly metadata: FileMetadataExtractor,
    private readonly now: () => string,
  ) {}

  async check(level: ValidationLevel, file: ValidationFile): Promise<ValidationResultInput> {
    try {
      return await this.checkUnsafe(level, file);
    } catch (error) {
      return {
        fileId: file.fileId,
        level,
        result: "unreadable",
        detail: errorText(error),
      };
    }
  }

  private async checkUnsafe(
    level: ValidationLevel,
    file: ValidationFile,
  ): Promise<ValidationResultInput> {
    if (level === "existence") {
      return (await this.exists(file.path))
        ? { fileId: file.fileId, level, result: "verified", detail: null }
        : { fileId: file.fileId, level, result: "missing", detail: "File not found" };
    }
    if (level === "metadata") {
      return this.checkMetadata(file);
    }
    if (level === "hash") {
      return this.checkHash(file);
    }
    return this.refreshMetadata(file);
  }

  private async exists(filePath: string): Promise<boolean> {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async checkMetadata(file: ValidationFile): Promise<ValidationResultInput> {
    if (!(await this.exists(file.path))) {
      return {
        fileId: file.fileId,
        level: "metadata",
        result: "missing",
        detail: "File not found",
      };
    }
    const info = await stat(file.path);
    const sizeChanged = info.size !== file.sizeBytes;
    const modified = info.mtime.toISOString();
    const timeChanged = file.modifiedAtFs !== modified;
    if (sizeChanged || timeChanged) {
      return {
        fileId: file.fileId,
        level: "metadata",
        result: "metadataChanged",
        detail: `Size ${String(file.sizeBytes)} -> ${String(info.size)}; modified ${file.modifiedAtFs ?? "unknown"} -> ${modified}`,
      };
    }
    return { fileId: file.fileId, level: "metadata", result: "verified", detail: null };
  }

  private async checkHash(file: ValidationFile): Promise<ValidationResultInput> {
    if (!(await this.exists(file.path))) {
      return { fileId: file.fileId, level: "hash", result: "missing", detail: "File not found" };
    }
    const actual = await this.hasher.hash(file.path);
    if (file.sha256 !== null && file.sha256 !== actual) {
      return {
        fileId: file.fileId,
        level: "hash",
        result: "hashMismatch",
        detail: `Catalog hash ${file.sha256} does not match ${actual}`,
        actualHash: actual,
      };
    }
    return {
      fileId: file.fileId,
      level: "hash",
      result: "hashVerified",
      detail: null,
      actualHash: actual,
    };
  }

  private async refreshMetadata(file: ValidationFile): Promise<ValidationResultInput> {
    if (!(await this.exists(file.path))) {
      return {
        fileId: file.fileId,
        level: "metadataRefresh",
        result: "missing",
        detail: "File not found",
      };
    }
    const pending: PendingMetadataFile = {
      id: file.fileId,
      path: file.path,
      mediaClass: this.mediaClass(file.path),
      format: path.extname(file.path).slice(1).toUpperCase() || null,
      size: file.sizeBytes,
      createdAtFs: file.createdAtFs,
      modifiedAtFs: file.modifiedAtFs ?? new Date(0).toISOString(),
    };
    const extracted = await this.metadata.extract(pending);
    const item: MetadataSaveItem = {
      fileId: file.fileId,
      status: "ok",
      entries: extracted.entries,
      date: extracted.date,
      width: extracted.width,
      height: extracted.height,
      durationSeconds: extracted.durationSeconds,
    };
    const context = await this.db.request<{ volumeId: string }>("library.getContext", {});
    await this.db.request("scan.saveMetadata", {
      volumeId: context.volumeId,
      items: [item],
      now: this.now(),
    });
    return {
      fileId: file.fileId,
      level: "metadataRefresh",
      result: "metadataUpdated",
      detail: null,
    };
  }

  private mediaClass(filePath: string): PendingMetadataFile["mediaClass"] {
    const extension = path.extname(filePath).slice(1).toLowerCase();
    if (
      ["jpg", "jpeg", "png", "gif", "bmp", "tif", "tiff", "webp", "heic", "heif", "avif"].includes(
        extension,
      )
    ) {
      return "image";
    }
    if (
      [
        "mp4",
        "mov",
        "avi",
        "mkv",
        "wmv",
        "webm",
        "m4v",
        "mpg",
        "mpeg",
        "3gp",
        "mts",
        "m2ts",
      ].includes(extension)
    ) {
      return "video";
    }
    return "other";
  }
}
