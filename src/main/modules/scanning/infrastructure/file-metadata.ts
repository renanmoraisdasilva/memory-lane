import path from "node:path";
import type {
  ExtractedMetadata,
  FileMetadataExtractor,
  MetadataEntry,
  MediaClass,
  PendingMetadataFile,
  ResolvedFileDate,
} from "../domain/scan-files";
import { readImageDimensions } from "./image-dimensions";

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

function parseUsableDate(value: string | null): Date | null {
  if (value === null) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const year = date.getUTCFullYear();
  if (year < 1900 || year > new Date().getUTCFullYear() + 1) {
    return null;
  }
  return date;
}

function resolveDate(file: PendingMetadataFile): ResolvedFileDate | null {
  const created = parseUsableDate(file.createdAtFs);
  const modified = parseUsableDate(file.modifiedAtFs);
  const selected = created ?? modified;
  if (selected === null) {
    return null;
  }

  return {
    resolvedDate: selected.toISOString(),
    precision: "exact",
    source: created === null ? "filesystem.modified" : "filesystem.created",
    confidence: created === null ? 0.4 : 0.6,
    originalValue: selected.toISOString(),
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

async function imageEntries(file: PendingMetadataFile): Promise<MetadataEntry[]> {
  if (file.mediaClass !== "image") {
    return [];
  }
  try {
    const dimensions = await readImageDimensions(file.path);
    if (dimensions === null) {
      return [];
    }
    return [
      { key: "media.width", value: String(dimensions.width), source: "image" },
      { key: "media.height", value: String(dimensions.height), source: "image" },
    ];
  } catch {
    return [];
  }
}

export function createFileMetadataExtractor(): FileMetadataExtractor {
  return {
    async extract(file: PendingMetadataFile): Promise<ExtractedMetadata> {
      const entries = [...baseEntries(file), ...(await imageEntries(file))];
      return { entries, date: resolveDate(file) };
    },
  };
}
