import path from "node:path";
import type { Logger } from "../../../logging/types";
import type {
  ExtractedMetadata,
  FileMetadataExtractor,
  MetadataEntry,
  MediaClass,
  PendingMetadataFile,
} from "../domain/scan-files";
import { resolveDateForFile } from "../domain/date-resolution";
import {
  createExifMetadataReader,
  type ExifMetadata,
  type ExifMetadataReader,
} from "./exif-metadata";
import { readImageDimensions } from "./image-dimensions";
import { readVideoDurationSeconds } from "./video-duration";

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "bmp",
  "tif",
  "tiff",
  "webp",
  "heic",
  "heif",
  "avif",
  "cr2",
  "cr3",
  "nef",
  "arw",
  "dng",
  "orf",
  "rw2",
  "raf",
  "srw",
  "pef",
]);

const VIDEO_EXTENSIONS = new Set([
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
]);

const MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  avif: "image/avif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  webm: "video/webm",
  m4v: "video/x-m4v",
  wmv: "video/x-ms-wmv",
  mpg: "video/mpeg",
  mpeg: "video/mpeg",
  "3gp": "video/3gpp",
  mts: "video/mp2t",
  m2ts: "video/mp2t",
};

export interface FileClassification {
  extension: string | null;
  mediaClass: MediaClass;
  format: string | null;
  mime: string | null;
}

function classifyExtension(extension: string): MediaClass {
  if (IMAGE_EXTENSIONS.has(extension)) {
    return "image";
  }
  if (VIDEO_EXTENSIONS.has(extension)) {
    return "video";
  }
  return "other";
}

export function classifyFile(filePath: string): FileClassification {
  const extension = path.extname(filePath).slice(1).toLowerCase();
  if (extension.length === 0) {
    return { extension: null, mediaClass: "other", format: null, mime: null };
  }

  return {
    extension,
    mediaClass: classifyExtension(extension),
    format: extension.toUpperCase(),
    mime: MIME_TYPES[extension] ?? null,
  };
}

function baseEntries(file: PendingMetadataFile): MetadataEntry[] {
  const entries: MetadataEntry[] = [
    { key: "filesystem.size", value: String(file.size), source: "filesystem" },
    { key: "filesystem.modifiedAt", value: file.modifiedAtFs, source: "filesystem" },
  ];
  if (file.createdAtFs !== null) {
    entries.push({ key: "filesystem.createdAt", value: file.createdAtFs, source: "filesystem" });
  }
  if (file.format !== null) {
    entries.push({ key: "file.format", value: file.format, source: "filesystem" });
  }
  return entries;
}

interface MediaFacts {
  entries: MetadataEntry[];
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}

function emptyFacts(): MediaFacts {
  return { entries: [], width: null, height: null, durationSeconds: null };
}

async function imageFacts(file: PendingMetadataFile): Promise<MediaFacts> {
  if (file.mediaClass !== "image") {
    return emptyFacts();
  }
  try {
    const dimensions = await readImageDimensions(file.path);
    if (dimensions === null) {
      return emptyFacts();
    }
    return {
      entries: [
        { key: "media.width", value: String(dimensions.width), source: "image" },
        { key: "media.height", value: String(dimensions.height), source: "image" },
      ],
      width: dimensions.width,
      height: dimensions.height,
      durationSeconds: null,
    };
  } catch {
    return emptyFacts();
  }
}

async function videoFacts(file: PendingMetadataFile): Promise<MediaFacts> {
  if (file.mediaClass !== "video") {
    return emptyFacts();
  }
  try {
    const duration = await readVideoDurationSeconds(file.path);
    return {
      entries:
        duration === null
          ? []
          : [{ key: "media.durationSeconds", value: String(duration), source: "container" }],
      width: null,
      height: null,
      durationSeconds: duration,
    };
  } catch {
    return emptyFacts();
  }
}

function needsFallback(file: PendingMetadataFile, exif: ExifMetadata | null): boolean {
  if (exif === null) {
    return true;
  }
  if (file.mediaClass === "image") {
    return exif.width === null || exif.height === null;
  }
  if (file.mediaClass === "video") {
    return exif.durationSeconds === null;
  }
  return false;
}

async function fallbackFacts(
  file: PendingMetadataFile,
  exif: ExifMetadata | null,
): Promise<MediaFacts> {
  if (!needsFallback(file, exif)) {
    return emptyFacts();
  }
  return file.mediaClass === "video" ? videoFacts(file) : imageFacts(file);
}

function mergeEntries(groups: MetadataEntry[][]): MetadataEntry[] {
  const merged = new Map<string, MetadataEntry>();
  for (const entries of groups) {
    for (const entry of entries) {
      if (!merged.has(entry.key)) {
        merged.set(entry.key, entry);
      }
    }
  }
  return [...merged.values()];
}

function suspiciousEntries(
  suspicious: Array<{ source: string; originalValue: string; reason: string }>,
): MetadataEntry[] {
  if (suspicious.length === 0) {
    return [];
  }
  const value = suspicious
    .map((item) => `${item.source}: ${item.originalValue} (${item.reason})`)
    .join("; ");
  return [{ key: "date.suspicious", value, source: "date" }];
}

export interface FileMetadataExtractorOptions {
  exif?: ExifMetadataReader | null;
  logger?: Logger;
}

interface ExifReadResult {
  exif: ExifMetadata | null;
  failed: boolean;
}

async function readExifMetadata(
  reader: ExifMetadataReader | null,
  file: PendingMetadataFile,
  logger: Logger | undefined,
): Promise<ExifReadResult> {
  if (reader === null) {
    return { exif: null, failed: false };
  }
  try {
    return { exif: await reader.read(file.path), failed: false };
  } catch (error) {
    logger?.warn("ExifTool metadata extraction failed", {
      path: file.path,
      message: error instanceof Error ? error.message : String(error),
    });
    return { exif: null, failed: true };
  }
}

function exifEntries(result: ExifReadResult): MetadataEntry[] {
  if (result.exif !== null) {
    return result.exif.entries;
  }
  return result.failed ? [{ key: "metadata.exiftool", value: "failed", source: "exiftool" }] : [];
}

function mergedFact(primary: number | null | undefined, fallback: number | null): number | null {
  return primary ?? fallback;
}

export function createFileMetadataExtractor(
  options: FileMetadataExtractorOptions = {},
): FileMetadataExtractor {
  const reader = options.exif === undefined ? createExifMetadataReader() : options.exif;
  const logger = options.logger;

  return {
    async extract(file: PendingMetadataFile): Promise<ExtractedMetadata> {
      const exifResult = await readExifMetadata(reader, file, logger);
      const facts = await fallbackFacts(file, exifResult.exif);
      const resolution = resolveDateForFile(file, exifResult.exif?.dateCandidates ?? []);

      return {
        entries: mergeEntries([
          baseEntries(file),
          exifEntries(exifResult),
          suspiciousEntries(resolution.suspicious),
          facts.entries,
        ]),
        date: resolution.date,
        width: mergedFact(exifResult.exif?.width, facts.width),
        height: mergedFact(exifResult.exif?.height, facts.height),
        durationSeconds: mergedFact(exifResult.exif?.durationSeconds, facts.durationSeconds),
        frameRate: exifResult.exif?.frameRate ?? null,
      };
    },
    async shutdown(): Promise<void> {
      if (reader !== null) {
        await reader.shutdown();
      }
    },
  };
}
