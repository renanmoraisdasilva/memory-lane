import { z } from "zod";
import { VolumeIdSchema } from "@shared/contracts/drives";

export const PromotionLatestDbParamsSchema = z.object({
  toVolumeId: z.string().min(1),
  destinationRootPath: z.string().min(1).nullable(),
});

export const PromotionListReplicaFilesDbParamsSchema = z.object({
  destinationId: z.string().min(1),
});

export const PromotionRecordDbParamsSchema = z.object({
  destinationId: z.string().min(1),
  verifiedFiles: z.number().int().nonnegative(),
  verifiedBytes: z.number().int().nonnegative(),
  shortfallFiles: z.number().int().nonnegative(),
  shortfallBytes: z.number().int().nonnegative(),
  now: z.string().min(1),
});

export const PromotionApplyDbParamsSchema = z.object({
  destinationId: z.string().min(1),
  destinationRootPath: z.string().min(1),
  destinationVolumeId: VolumeIdSchema,
  destinationVolumeSerial: z.string().nullable(),
  destinationLabel: z.string().min(1),
  destinationFileSystem: z.string().min(1),
  oldSourceFate: z.enum(["full_copy", "extend_coverage", "retire"]),
  partialFates: z.array(
    z.object({
      destinationId: z.string().min(1),
      keep: z.boolean(),
    }),
  ),
  oldSourceFits: z.boolean(),
  now: z.string().min(1),
});

export const PromotionRollbackDbParamsSchema = z.object({
  promotionId: z.number().int().positive(),
  promotionRootPath: z.string().min(1).nullable(),
  now: z.string().min(1),
});

export const PromotionCloseWindowDbParamsSchema = z.object({
  now: z.string().min(1),
});
