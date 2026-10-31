import { z } from "zod";
import { VolumeIdSchema } from "./drives";

export const SCAN_STAGE_ORDER = ["catalog", "metadata", "thumbnails", "hashes"] as const;

export const ScanStatusSchema = z.enum([
  "idle",
  "active",
  "paused",
  "interrupted",
  "complete",
  "error",
]);
export type ScanStatus = z.infer<typeof ScanStatusSchema>;

export const ScanModeSchema = z.enum(["initial", "incremental"]);
export type ScanMode = z.infer<typeof ScanModeSchema>;

export const ScanStageIdSchema = z.enum(SCAN_STAGE_ORDER);
export type ScanStageId = z.infer<typeof ScanStageIdSchema>;

export const ScanStageStateSchema = z.enum(["queued", "active", "complete", "paused", "failed"]);
export type ScanStageState = z.infer<typeof ScanStageStateSchema>;

export const ScanIntensitySchema = z.enum(["eco", "balanced", "max"]);
export type ScanIntensity = z.infer<typeof ScanIntensitySchema>;

export const ScanStageSchema = z.object({
  id: ScanStageIdSchema,
  state: ScanStageStateSchema,
  processed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative().nullable(),
});
export type ScanStage = z.infer<typeof ScanStageSchema>;

export const ScanReportSchema = z.object({
  newFiles: z.number().int().nonnegative(),
  changedFiles: z.number().int().nonnegative(),
  missingFiles: z.number().int().nonnegative(),
  movedCandidates: z.number().int().nonnegative(),
});
export type ScanReport = z.infer<typeof ScanReportSchema>;

export const ScanStateSchema = z.object({
  driveLabel: z.string(),
  volumeId: VolumeIdSchema,
  status: ScanStatusSchema,
  mode: ScanModeSchema,
  stages: z.array(ScanStageSchema).length(SCAN_STAGE_ORDER.length),
  currentStage: ScanStageIdSchema.nullable(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  lastSavedAt: z.string().nullable(),
  etaSeconds: z.number().int().nonnegative().nullable(),
  intensity: ScanIntensitySchema,
  report: ScanReportSchema.nullable(),
  errorMessage: z.string().nullable(),
});
export type ScanState = z.infer<typeof ScanStateSchema>;

export const ScanVolumeParamsSchema = z.object({
  volumeId: VolumeIdSchema,
});
export type ScanVolumeParams = z.infer<typeof ScanVolumeParamsSchema>;

export const ScanStartParamsSchema = z.object({
  volumeId: VolumeIdSchema,
  intensity: ScanIntensitySchema.optional(),
});
export type ScanStartParams = z.infer<typeof ScanStartParamsSchema>;

export const ScanIntensityParamsSchema = z.object({
  volumeId: VolumeIdSchema,
  intensity: ScanIntensitySchema,
});
export type ScanIntensityParams = z.infer<typeof ScanIntensityParamsSchema>;
