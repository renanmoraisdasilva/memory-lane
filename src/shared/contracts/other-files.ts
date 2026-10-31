import { z } from "zod";

export const OtherFileCategorySchema = z.enum([
  "all",
  "documents",
  "spreadsheets",
  "presentations",
  "pdfs",
  "audio",
  "archives",
  "other",
]);
export type OtherFileCategory = z.infer<typeof OtherFileCategorySchema>;

export const OtherFileSchema = z.object({
  fileId: z.number().int().positive(),
  name: z.string().min(1),
  path: z.string().min(1),
  folder: z.string(),
  extension: z.string().nullable(),
  format: z.string().nullable(),
  mime: z.string().nullable(),
  category: OtherFileCategorySchema,
  sizeBytes: z.number().int().nonnegative(),
  modifiedAtFs: z.string().nullable(),
  state: z.enum(["present", "missing"]),
});
export type OtherFile = z.infer<typeof OtherFileSchema>;

export const OtherFileCategoryCountsSchema = z.object({
  all: z.number().int().nonnegative(),
  documents: z.number().int().nonnegative(),
  spreadsheets: z.number().int().nonnegative(),
  presentations: z.number().int().nonnegative(),
  pdfs: z.number().int().nonnegative(),
  audio: z.number().int().nonnegative(),
  archives: z.number().int().nonnegative(),
  other: z.number().int().nonnegative(),
});
export type OtherFileCategoryCounts = z.infer<typeof OtherFileCategoryCountsSchema>;

export const OtherFilesPageSchema = z.object({
  items: z.array(OtherFileSchema),
  total: z.number().int().nonnegative(),
  counts: OtherFileCategoryCountsSchema,
});
export type OtherFilesPage = z.infer<typeof OtherFilesPageSchema>;

export const OtherFilesParamsSchema = z.object({
  category: OtherFileCategorySchema.optional(),
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().min(1).max(200).optional(),
});
export type OtherFilesParams = z.infer<typeof OtherFilesParamsSchema>;
