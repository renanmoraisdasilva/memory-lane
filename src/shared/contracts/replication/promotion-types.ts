import { z } from "zod";
import { CatalogSummarySchema, VolumeIdSchema } from "../drives";

export const PromotionStatusSchema = z.enum([
  "planned",
  "verifying",
  "verified",
  "completed",
  "failed",
  "rolled_back",
]);
export type PromotionStatus = z.infer<typeof PromotionStatusSchema>;

export const PromotionOldSourceFateSchema = z.enum(["full_copy", "extend_coverage", "retire"]);
export type PromotionOldSourceFate = z.infer<typeof PromotionOldSourceFateSchema>;

export const PromotionPartialFateSchema = z.object({
  destinationId: z.string().min(1),
  keep: z.boolean(),
});

export const ApplyPromotionParamsSchema = z.object({
  destinationId: z.string().min(1),
  deepVerify: z.boolean().default(false),
  oldSourceFate: PromotionOldSourceFateSchema.default("full_copy"),
  partialFates: z.array(PromotionPartialFateSchema).default([]),
  confirm: z.literal(true),
});
export type ApplyPromotionParams = z.infer<typeof ApplyPromotionParamsSchema>;

export const PromotionOldSourceSchema = z.object({
  label: z.string().min(1),
  volumeId: VolumeIdSchema,
  sourceRootRelative: z.string(),
  availableBytes: z.number().int().nonnegative(),
  requiredBytes: z.number().int().nonnegative(),
  fitsFullCopy: z.boolean(),
});

export const PromotionPartialDestinationSchema = z.object({
  destinationId: z.string().min(1),
  label: z.string().min(1),
  goal: z.enum(["extend_coverage", "full_copy"]),
  status: z.enum(["active", "retired", "lost"]),
  connection: z.enum(["connected", "offline", "retired", "lost"]),
  verifiedFiles: z.number().int().nonnegative(),
  verifiedBytes: z.number().int().nonnegative(),
});

export const PromotionCountsSchema = z.object({
  sourceFiles: z.number().int().nonnegative(),
  sourceBytes: z.number().int().nonnegative(),
  verifiedFiles: z.number().int().nonnegative(),
  verifiedBytes: z.number().int().nonnegative(),
  shortfallFiles: z.number().int().nonnegative(),
  shortfallBytes: z.number().int().nonnegative(),
  staleFiles: z.number().int().nonnegative(),
  missingFiles: z.number().int().nonnegative(),
  conflictFiles: z.number().int().nonnegative(),
  failedFiles: z.number().int().nonnegative(),
  destinationOnlyFiles: z.number().int().nonnegative(),
  destinationOnlyBytes: z.number().int().nonnegative(),
});

export const PromotionStateSchema = z.object({
  promotionId: z.number().int().positive().nullable(),
  destinationId: z.string().min(1),
  destinationLabel: z.string().min(1),
  destinationVolumeId: VolumeIdSchema,
  sourceLabel: z.string().min(1),
  sourceVolumeId: VolumeIdSchema,
  status: PromotionStatusSchema,
  connected: z.boolean(),
  identityConfirmed: z.boolean(),
  canPromote: z.boolean(),
  blockedReason: z.string().nullable(),
  verified: z.boolean(),
  counts: PromotionCountsSchema,
  oldSource: PromotionOldSourceSchema,
  partialDestinations: z.array(PromotionPartialDestinationSchema),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  rolledBackAt: z.string().nullable(),
  errorMessage: z.string().nullable(),
  canRollback: z.boolean(),
  rollbackBlockedReason: z.string().nullable(),
  newCatalog: CatalogSummarySchema.nullable(),
  previousSourceVolumeId: VolumeIdSchema.nullable(),
});
export type PromotionState = z.infer<typeof PromotionStateSchema>;

export const VerifyPromotionParamsSchema = z.object({
  destinationId: z.string().min(1),
  deep: z.boolean().default(false),
});
export type VerifyPromotionParams = z.infer<typeof VerifyPromotionParamsSchema>;

export const RollbackPromotionParamsSchema = z.object({
  promotionId: z.number().int().positive(),
  destinationId: z.string().min(1),
});
export type RollbackPromotionParams = z.infer<typeof RollbackPromotionParamsSchema>;
