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
  modifiedAtFs: string | null;
  hasSizePeer: boolean;
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
  frameRate?: number | null | undefined;
}

export interface ExtractedMetadata {
  entries: MetadataEntry[];
  date: ResolvedFileDate | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  frameRate?: number | null | undefined;
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

export interface QuickHashResult {
  algorithm: string;
  digest: string;
  sampleBytes: number;
}

export interface QuickFileHasher {
  hash(filePath: string, sizeBytes: number, sampleBytes: number): Promise<QuickHashResult>;
}

export interface ThumbnailSaveItem {
  fileId: number;
  path: string;
  bytes: number;
  status: "ready" | "failed";
}

export interface FullHashSaveItem {
  fileId: number;
  status: "complete";
  kind: "full";
  sha256: string;
  size: number;
  modifiedAtFs: string | null;
}

export interface QuickHashSaveItem {
  fileId: number;
  status: "complete";
  kind: "quick";
  algorithm: string;
  digest: string;
  sampleBytes: number;
  fileSize: number;
  modifiedAtFs: string | null;
}

export interface FailedHashSaveItem {
  fileId: number;
  status: "failed";
  sha256: "";
}

export type HashSaveItem = FullHashSaveItem | QuickHashSaveItem | FailedHashSaveItem;
