import { z } from "zod";
import { ScanIntensitySchema, ScanStageIdSchema } from "@shared/contracts/scan";
import { VolumeIdSchema } from "@shared/contracts/drives";

export const SCAN_DB_METHODS = [
  "scan.getState",
  "scan.start",
  "scan.pause",
  "scan.resume",
  "scan.interrupt",
  "scan.fail",
  "scan.beginStage",
  "scan.saveProgress",
  "scan.completeStage",
  "scan.prepareStage",
  "scan.setIntensity",
  "scan.applyCatalogBatch",
  "scan.finishCatalog",
  "scan.countPendingMetadata",
  "scan.listPendingMetadata",
  "scan.saveMetadata",
  "scan.countPendingThumbnails",
  "scan.listPendingThumbnails",
  "scan.saveThumbnail",
  "scan.countPendingHashes",
  "scan.listPendingHashes",
  "scan.saveHash",
  "scan.finalize",
] as const;

export type ScanDbMethod = (typeof SCAN_DB_METHODS)[number];

const MediaClassSchema = z.enum(["image", "video", "other"]);

export const ScannedFileSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
  extension: z.string().nullable(),
  size: z.number().int().nonnegative(),
  createdAtFs: z.string().nullable(),
  modifiedAtFs: z.string().min(1),
  mediaClass: MediaClassSchema,
  format: z.string().nullable(),
  mime: z.string().nullable(),
});

const MetadataEntrySchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  source: z.string().min(1),
});

const ResolvedDateSchema = z.object({
  resolvedDate: z.string().min(1),
  precision: z.enum(["year", "month", "exact"]),
  source: z.string().min(1),
  confidence: z.number().min(0).max(1),
  originalValue: z.string(),
});

const MetadataSaveItemSchema = z.object({
  fileId: z.number().int().positive(),
  status: z.enum(["ok", "failed"]),
  entries: z.array(MetadataEntrySchema),
  date: ResolvedDateSchema.nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  durationSeconds: z.number().nonnegative().nullable(),
  frameRate: z.number().positive().nullable().optional(),
});

const ThumbnailSaveItemSchema = z.object({
  fileId: z.number().int().positive(),
  path: z.string(),
  bytes: z.number().int().nonnegative(),
  status: z.enum(["ready", "failed"]),
});

const HashSaveItemSchema = z.object({
  fileId: z.number().int().positive(),
  sha256: z.string(),
  status: z.enum(["complete", "failed"]),
});

export const ScanVolumeDbParamsSchema = z.object({ volumeId: VolumeIdSchema });

export const ScanStartDbParamsSchema = z.object({
  volumeId: VolumeIdSchema,
  rootPath: z.string().min(1),
  cachePath: z.string().min(1),
  intensity: ScanIntensitySchema,
  now: z.string().min(1),
});

export const ScanNowDbParamsSchema = z.object({
  volumeId: VolumeIdSchema,
  now: z.string().min(1),
});

export const ScanFailDbParamsSchema = z.object({
  volumeId: VolumeIdSchema,
  message: z.string().min(1),
  now: z.string().min(1),
});

export const ScanIntensityDbParamsSchema = z.object({
  volumeId: VolumeIdSchema,
  intensity: ScanIntensitySchema,
  now: z.string().min(1),
});

export const ScanBeginStageDbParamsSchema = z.object({
  volumeId: VolumeIdSchema,
  stage: ScanStageIdSchema,
  total: z.number().int().nonnegative().nullable(),
  now: z.string().min(1),
});

export const ScanProgressDbParamsSchema = z.object({
  volumeId: VolumeIdSchema,
  stage: ScanStageIdSchema,
  processed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative().nullable(),
  etaSeconds: z.number().int().nonnegative().nullable(),
  now: z.string().min(1),
});

export const ScanCompleteStageDbParamsSchema = z.object({
  volumeId: VolumeIdSchema,
  stage: ScanStageIdSchema,
  processed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative().nullable(),
  now: z.string().min(1),
});

export const ScanPrepareStageDbParamsSchema = z.object({
  volumeId: VolumeIdSchema,
  stage: ScanStageIdSchema,
});

export const ScanApplyCatalogDbParamsSchema = z.object({
  volumeId: VolumeIdSchema,
  files: z.array(ScannedFileSchema),
  seenAt: z.string().min(1),
});

export const ScanFinishCatalogDbParamsSchema = z.object({
  volumeId: VolumeIdSchema,
  rootPath: z.string().min(1),
  seenAt: z.string().min(1),
  markMissing: z.boolean(),
});

export const ScanLimitDbParamsSchema = z.object({
  volumeId: VolumeIdSchema,
  limit: z.number().int().positive().max(5_000),
});

export const ScanSaveMetadataDbParamsSchema = z.object({
  volumeId: VolumeIdSchema,
  items: z.array(MetadataSaveItemSchema),
  now: z.string().min(1),
});

export const ScanSaveThumbnailDbParamsSchema = z.object({
  volumeId: VolumeIdSchema,
  items: z.array(ThumbnailSaveItemSchema),
  now: z.string().min(1),
});

export const ScanSaveHashDbParamsSchema = z.object({
  volumeId: VolumeIdSchema,
  items: z.array(HashSaveItemSchema),
  now: z.string().min(1),
});

export const ScanFinalizeDbParamsSchema = z.object({
  volumeId: VolumeIdSchema,
  now: z.string().min(1),
});
