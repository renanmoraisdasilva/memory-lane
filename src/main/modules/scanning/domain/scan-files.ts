export type MediaClass = "image" | "video" | "other";

export interface ScannedFile {
  path: string;
  name: string;
  extension: string | null;
  size: number;
  createdAtFs: string | null;
  modifiedAtFs: string;
  mediaClass: MediaClass;
  format: string | null;
  mime: string | null;
}

export interface PendingMetadataFile {
  id: number;
  path: string;
  mediaClass: MediaClass;
  format: string | null;
  size: number;
  createdAtFs: string | null;
  modifiedAtFs: string;
}

export interface PendingThumbnailFile {
  id: number;
  path: string;
  mediaClass: MediaClass;
}

export interface PendingHashFile {
  id: number;
  path: string;
  size: number;
}

export interface MetadataEntry {
  key: string;
  value: string;
  source: string;
}

export interface ResolvedFileDate {
  resolvedDate: string;
  precision: "year" | "month" | "exact";
  source: string;
  confidence: number;
  originalValue: string;
}

export interface MetadataSaveItem {
  fileId: number;
  status: "ok" | "failed";
  entries: MetadataEntry[];
  date: ResolvedFileDate | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}

export interface ExtractedMetadata {
  entries: MetadataEntry[];
  date: ResolvedFileDate | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}

export interface FileMetadataExtractor {
  extract(file: PendingMetadataFile): Promise<ExtractedMetadata>;
  shutdown?(): Promise<void>;
}

export interface ThumbnailGenerator {
  generate(filePath: string, outputPath: string): Promise<{ bytes: number } | null>;
}

export type ThumbnailPriority = "interactive" | "bulk";

export interface ThumbnailWorkScheduler {
  generate(
    filePath: string,
    outputPath: string,
    priority: ThumbnailPriority,
  ): Promise<{ bytes: number } | null>;
}

export interface FileHasher {
  hash(filePath: string): Promise<string>;
}

export interface ThumbnailSaveItem {
  fileId: number;
  path: string;
  bytes: number;
  status: "ready" | "failed";
}

export interface HashSaveItem {
  fileId: number;
  sha256: string;
  status: "complete" | "failed";
}
