import { z } from "zod";
import { LibraryItemSchema } from "./library";

export const HealthFileSchema = LibraryItemSchema.extend({
  mediaClass: z.enum(["image", "video", "other"]),
  path: z.string().min(1),
  folder: z.string(),
});
export type HealthFile = z.infer<typeof HealthFileSchema>;

export const DuplicateGroupSchema = z.object({
  groupId: z.number().int().positive(),
  sha256: z.string().min(1),
  fileCount: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
  files: z.array(HealthFileSchema),
});
export type DuplicateGroup = z.infer<typeof DuplicateGroupSchema>;

export const DuplicateGroupsPageSchema = z.object({
  groups: z.array(DuplicateGroupSchema),
  totalGroups: z.number().int().nonnegative(),
  totalFiles: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
});
export type DuplicateGroupsPage = z.infer<typeof DuplicateGroupsPageSchema>;

export const DuplicateGroupsParamsSchema = z.object({
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
export type DuplicateGroupsParams = z.infer<typeof DuplicateGroupsParamsSchema>;

export const MissingFileSchema = z.object({
  fileId: z.number().int().positive(),
  name: z.string().min(1),
  path: z.string().min(1),
  folder: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  mediaClass: z.enum(["image", "video", "other"]),
  format: z.string().nullable(),
  lastPath: z.string().min(1),
  lastSeenAt: z.string().min(1).nullable(),
  reason: z.string().nullable(),
  hasMovedCandidate: z.boolean(),
});
export type MissingFile = z.infer<typeof MissingFileSchema>;

export const MissingFilesPageSchema = z.object({
  items: z.array(MissingFileSchema),
  total: z.number().int().nonnegative(),
});
export type MissingFilesPage = z.infer<typeof MissingFilesPageSchema>;

export const MissingFilesParamsSchema = z.object({
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().min(1).max(200).optional(),
});
export type MissingFilesParams = z.infer<typeof MissingFilesParamsSchema>;

export const MissingDuplicateSchema = z.object({
  fileId: z.number().int().positive(),
  name: z.string().min(1),
  path: z.string().min(1),
  folder: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  lastSeenAt: z.string().min(1).nullable(),
  duplicateFileId: z.number().int().positive(),
  duplicateName: z.string().min(1),
  duplicatePath: z.string().min(1),
  duplicateFolder: z.string(),
  pendingMovedCandidates: z.number().int().nonnegative(),
  hasVerifiedReplicas: z.boolean(),
  hasDateOverride: z.boolean(),
});
export type MissingDuplicate = z.infer<typeof MissingDuplicateSchema>;

export const MissingDuplicatesPageSchema = z.object({
  items: z.array(MissingDuplicateSchema),
  total: z.number().int().nonnegative(),
  candidateFileIds: z.array(z.number().int().positive()),
  readyFileIds: z.array(z.number().int().positive()),
  withPendingMoves: z.number().int().nonnegative(),
  pendingMovedCandidates: z.number().int().nonnegative(),
  withVerifiedReplicas: z.number().int().nonnegative(),
  withDateOverride: z.number().int().nonnegative(),
});
export type MissingDuplicatesPage = z.infer<typeof MissingDuplicatesPageSchema>;

export const MissingDuplicatesParamsSchema = z.object({
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().min(1).max(200).optional(),
});
export type MissingDuplicatesParams = z.infer<typeof MissingDuplicatesParamsSchema>;

export const PurgeMissingDuplicatesParamsSchema = z.object({
  fileIds: z.array(z.number().int().positive()).min(1).max(50_000),
  includePendingMoves: z.boolean().default(false),
});
export type PurgeMissingDuplicatesParams = z.infer<typeof PurgeMissingDuplicatesParamsSchema>;

export const PurgeMissingDuplicatesResultSchema = z.object({
  removed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  dismissedMovedCandidates: z.number().int().nonnegative(),
});
export type PurgeMissingDuplicatesResult = z.infer<typeof PurgeMissingDuplicatesResultSchema>;

export const MovedCandidateSchema = z.object({
  id: z.number().int().positive(),
  fileId: z.number().int().positive(),
  name: z.string().min(1),
  oldPath: z.string().min(1),
  newPath: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string().min(1),
});
export type MovedCandidate = z.infer<typeof MovedCandidateSchema>;

export const MovedCandidatesPageSchema = z.object({
  items: z.array(MovedCandidateSchema),
  total: z.number().int().nonnegative(),
});
export type MovedCandidatesPage = z.infer<typeof MovedCandidatesPageSchema>;

export const MovedCandidateTargetsSchema = z.object({
  candidateIds: z.array(z.number().int().positive()).min(1).max(500),
});
export type MovedCandidateTargets = z.infer<typeof MovedCandidateTargetsSchema>;

export const MovedDismissTargetsSchema = z.object({
  candidateIds: z.array(z.number().int().positive()).min(1).max(50_000),
});

export const MovedActionResultSchema = z.object({
  updated: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
});
export type MovedActionResult = z.infer<typeof MovedActionResultSchema>;

export const HealthSummarySchema = z.object({
  duplicateGroups: z.number().int().nonnegative(),
  duplicateFiles: z.number().int().nonnegative(),
  duplicateBytes: z.number().int().nonnegative(),
  missingFiles: z.number().int().nonnegative(),
  movedCandidates: z.number().int().nonnegative(),
  lastValidationAt: z.string().min(1).nullable(),
});
export type HealthSummary = z.infer<typeof HealthSummarySchema>;

export const ValidationLevelSchema = z.enum(["existence", "metadata", "hash", "metadataRefresh"]);
export type ValidationLevel = z.infer<typeof ValidationLevelSchema>;

export const ValidationStatusSchema = z.enum(["idle", "running", "paused", "complete", "failed"]);

export const ValidationReportSchema = z.object({
  total: z.number().int().nonnegative(),
  verified: z.number().int().nonnegative(),
  missing: z.number().int().nonnegative(),
  metadataChanged: z.number().int().nonnegative(),
  hashMismatch: z.number().int().nonnegative(),
  metadataUpdated: z.number().int().nonnegative(),
  unreadable: z.number().int().nonnegative(),
  startedAt: z.string().min(1).nullable(),
  finishedAt: z.string().min(1).nullable(),
});
export type ValidationReport = z.infer<typeof ValidationReportSchema>;

export const ValidationStateSchema = z.object({
  sessionId: z.number().int().positive().nullable(),
  status: ValidationStatusSchema,
  levels: z.array(ValidationLevelSchema),
  total: z.number().int().nonnegative(),
  processed: z.number().int().nonnegative(),
  currentLevel: ValidationLevelSchema.nullable(),
  startedAt: z.string().min(1).nullable(),
  finishedAt: z.string().min(1).nullable(),
  errorMessage: z.string().min(1).nullable(),
  report: ValidationReportSchema.nullable(),
});
export type ValidationState = z.infer<typeof ValidationStateSchema>;

export const ValidationStartParamsSchema = z.object({
  levels: z.array(ValidationLevelSchema).min(1),
});
export type ValidationStartParams = z.infer<typeof ValidationStartParamsSchema>;
