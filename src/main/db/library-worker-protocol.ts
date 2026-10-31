import { z } from "zod";
import {
  LibraryClearDateParamsSchema,
  LibraryItemParamsSchema,
  LibrarySetDateParamsSchema,
  LibraryTimelineIndexParamsSchema,
  LibraryTimelineParamsSchema,
  LibraryUndatedParamsSchema,
} from "@shared/contracts/library";

export const LIBRARY_DB_METHODS = [
  "library.getSummary",
  "library.getTimeline",
  "library.getTimelineIndex",
  "library.getItem",
  "library.getUndated",
  "library.setDate",
  "library.clearDate",
  "library.getContext",
  "library.resolveMedia",
  "library.resolveThumbnail",
  "library.saveThumbnail",
] as const;

export type LibraryDbMethod = (typeof LIBRARY_DB_METHODS)[number];

export const LibraryFileParamsSchema = z.object({
  fileId: z.number().int().positive(),
});

export const LibrarySaveThumbnailParamsSchema = z.object({
  fileId: z.number().int().positive(),
  path: z.string(),
  bytes: z.number().int().nonnegative(),
  status: z.enum(["ready", "failed"]),
  now: z.string().min(1),
});

export const LibraryTimelineDbParamsSchema = LibraryTimelineParamsSchema;
export const LibraryTimelineIndexDbParamsSchema = LibraryTimelineIndexParamsSchema;
export const LibraryItemDbParamsSchema = LibraryItemParamsSchema;
export const LibraryUndatedDbParamsSchema = LibraryUndatedParamsSchema;
export const LibrarySetDateDbParamsSchema = LibrarySetDateParamsSchema;
export const LibraryClearDateDbParamsSchema = LibraryClearDateParamsSchema;
