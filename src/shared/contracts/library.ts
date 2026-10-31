import { z } from "zod";

export const LibraryFilterSchema = z.enum(["all", "photos", "videos"]);
export type LibraryFilter = z.infer<typeof LibraryFilterSchema>;

export const TimelinePrecisionSchema = z.enum(["year", "month", "exact"]);
export type TimelinePrecision = z.infer<typeof TimelinePrecisionSchema>;

export const ThumbnailStatusSchema = z.enum(["pending", "ready", "failed"]);
export type ThumbnailStatus = z.infer<typeof ThumbnailStatusSchema>;

export const LibraryDateSchema = z.object({
  value: z.string().min(1).nullable(),
  precision: TimelinePrecisionSchema.nullable(),
  source: z.string().min(1).nullable(),
  isOverride: z.boolean().optional(),
});
export type LibraryDate = z.infer<typeof LibraryDateSchema>;

export const LibraryItemSchema = z.object({
  fileId: z.number().int().positive(),
  name: z.string().min(1),
  mediaClass: z.enum(["image", "video"]),
  format: z.string().min(1).nullable(),
  sizeBytes: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  durationSeconds: z.number().nonnegative().nullable(),
  date: LibraryDateSchema,
  thumbnailStatus: ThumbnailStatusSchema,
  thumbnailUrl: z.string().min(1).nullable(),
  isMissing: z.boolean(),
});
export type LibraryItem = z.infer<typeof LibraryItemSchema>;

export const LibrarySummarySchema = z.object({
  totalItems: z.number().int().nonnegative(),
  photoCount: z.number().int().nonnegative(),
  videoCount: z.number().int().nonnegative(),
  indexedBytes: z.number().int().nonnegative(),
  undatedCount: z.number().int().nonnegative(),
  lastScanAt: z.string().min(1).nullable(),
});
export type LibrarySummary = z.infer<typeof LibrarySummarySchema>;

export const LibraryMonthSchema = z.object({
  year: z.number().int().min(1900).max(2200),
  month: z.number().int().min(1).max(12),
  count: z.number().int().nonnegative(),
});
export type LibraryMonth = z.infer<typeof LibraryMonthSchema>;

export const LibraryTimelinePageSchema = z.object({
  items: z.array(LibraryItemSchema),
  nextCursor: z.string().min(1).nullable(),
  total: z.number().int().nonnegative(),
});
export type LibraryTimelinePage = z.infer<typeof LibraryTimelinePageSchema>;

export const LibraryTimelineIndexSchema = z.object({
  months: z.array(LibraryMonthSchema),
});
export type LibraryTimelineIndex = z.infer<typeof LibraryTimelineIndexSchema>;

export const LibraryMetadataEntrySchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  source: z.string().min(1),
});
export type LibraryMetadataEntry = z.infer<typeof LibraryMetadataEntrySchema>;

export const LibraryItemDetailsSchema = z.object({
  item: LibraryItemSchema,
  path: z.string().min(1),
  folder: z.string(),
  createdAtFs: z.string().min(1).nullable(),
  modifiedAtFs: z.string().min(1),
  metadata: z.array(LibraryMetadataEntrySchema),
  position: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  previousFileId: z.number().int().positive().nullable(),
  nextFileId: z.number().int().positive().nullable(),
  mediaUrl: z.string().min(1).nullable(),
});
export type LibraryItemDetails = z.infer<typeof LibraryItemDetailsSchema>;

export const LibraryTimelineParamsSchema = z
  .object({
    filter: LibraryFilterSchema,
    cursor: z.string().min(1).optional(),
    year: z.number().int().min(1900).max(2200).optional(),
    month: z.number().int().min(1).max(12).optional(),
    limit: z.number().int().min(1).max(500).optional(),
  })
  .superRefine((value, context) => {
    if (value.month !== undefined && value.year === undefined) {
      context.addIssue({
        code: "custom",
        path: ["month"],
        message: "A month anchor requires a year",
      });
    }
    if (value.cursor !== undefined && (value.year !== undefined || value.month !== undefined)) {
      context.addIssue({
        code: "custom",
        path: ["cursor"],
        message: "A cursor cannot be combined with a year or month anchor",
      });
    }
  });
export type LibraryTimelineParams = z.infer<typeof LibraryTimelineParamsSchema>;

export const LibraryTimelineIndexParamsSchema = z.object({
  filter: LibraryFilterSchema,
});
export type LibraryTimelineIndexParams = z.infer<typeof LibraryTimelineIndexParamsSchema>;

export const LibraryItemParamsSchema = z.object({
  fileId: z.number().int().positive(),
  filter: LibraryFilterSchema.optional(),
});
export type LibraryItemParams = z.infer<typeof LibraryItemParamsSchema>;

export const LibraryItemTargetParamsSchema = z.object({
  fileId: z.number().int().positive(),
});
export type LibraryItemTargetParams = z.infer<typeof LibraryItemTargetParamsSchema>;

export const LibraryUndatedItemSchema = LibraryItemSchema.extend({
  folder: z.string(),
});
export type LibraryUndatedItem = z.infer<typeof LibraryUndatedItemSchema>;

export const LibraryUndatedPageSchema = z.object({
  items: z.array(LibraryUndatedItemSchema),
  nextCursor: z.string().min(1).nullable(),
  total: z.number().int().nonnegative(),
});
export type LibraryUndatedPage = z.infer<typeof LibraryUndatedPageSchema>;

export const LibraryUndatedParamsSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(200).optional(),
});
export type LibraryUndatedParams = z.infer<typeof LibraryUndatedParamsSchema>;

export const LibrarySetDateParamsSchema = z.object({
  fileIds: z.array(z.number().int().positive()).min(1).max(500),
  year: z.number().int().min(1800).max(2200),
  month: z.number().int().min(1).max(12).nullable().optional(),
});
export type LibrarySetDateParams = z.infer<typeof LibrarySetDateParamsSchema>;

export const LibraryClearDateParamsSchema = z.object({
  fileIds: z.array(z.number().int().positive()).min(1).max(500),
});
export type LibraryClearDateParams = z.infer<typeof LibraryClearDateParamsSchema>;

export const LibraryDateMutationResultSchema = z.object({
  updated: z.number().int().nonnegative(),
});
export type LibraryDateMutationResult = z.infer<typeof LibraryDateMutationResultSchema>;
