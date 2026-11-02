import { z } from "zod";
import {
  DUPLICATE_CLEANUP_KEEPER_RULE,
  DUPLICATE_CLEANUP_SKIP_REASONS,
} from "../domain/duplicate-cleanup";
import { LibraryItemSchema } from "./library";

export const HealthFileSchema = LibraryItemSchema.extend({
  mediaClass: z.enum(["image", "video", "other"]),
  path: z.string().min(1),
  folder: z.string(),
  createdAtFs: z.string().min(1).nullable(),
  modifiedAtFs: z.string().min(1).nullable(),
  hasVerifiedReplica: z.boolean(),
  hasDateOverride: z.boolean(),
});
export type HealthFile = z.infer<typeof HealthFileSchema>;

export const DuplicateGroupSchema = z.object({
  groupId: z.number().int().positive(),
  sha256: z.string().min(1),
  fileCount: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
  files: z.array(HealthFileSchema),
  keeperFileId: z.number().int().positive(),
  keeperReason: z.string().min(1),
  eligible: z.boolean(),
  skipReason: z.enum(DUPLICATE_CLEANUP_SKIP_REASONS).nullable(),
  excessBytes: z.number().int().nonnegative(),
});
export type DuplicateGroup = z.infer<typeof DuplicateGroupSchema>;

export const DuplicateGroupsPageSchema = z.object({
  groups: z.array(DuplicateGroupSchema),
  totalGroups: z.number().int().nonnegative(),
  totalFiles: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
  totalExcessBytes: z.number().int().nonnegative(),
});
export type DuplicateGroupsPage = z.infer<typeof DuplicateGroupsPageSchema>;

export const DuplicateGroupsParamsSchema = z.object({
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
export type DuplicateGroupsParams = z.infer<typeof DuplicateGroupsParamsSchema>;

export const DuplicateCleanupSkipCountsSchema = z.object({
  notAGroup: z.number().int().nonnegative(),
  empty: z.number().int().nonnegative(),
  belowMinimumSize: z.number().int().nonnegative(),
  keeperNotCovered: z.number().int().nonnegative(),
  candidateDateOverride: z.number().int().nonnegative(),
  multipleDateOverrides: z.number().int().nonnegative(),
  hardLink: z.number().int().nonnegative(),
});
export type DuplicateCleanupSkipCounts = z.infer<typeof DuplicateCleanupSkipCountsSchema>;

export const DuplicateCleanupSummarySchema = z.object({
  totalGroups: z.number().int().nonnegative(),
  totalFiles: z.number().int().nonnegative(),
  totalDuplicateBytes: z.number().int().nonnegative(),
  eligibleGroups: z.number().int().nonnegative(),
  skippedGroups: z.number().int().nonnegative(),
  filesToMove: z.number().int().nonnegative(),
  bytesToMove: z.number().int().nonnegative(),
  keepers: z.number().int().nonnegative(),
  skipCounts: DuplicateCleanupSkipCountsSchema,
  minimumFileSizeBytes: z.number().int().positive(),
  rootPath: z.string().min(1),
  quarantineRoot: z.string().min(1),
});
export type DuplicateCleanupSummary = z.infer<typeof DuplicateCleanupSummarySchema>;

export const DuplicateCleanupFileSchema = z.object({
  fileId: z.number().int().positive(),
  name: z.string().min(1),
  path: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  createdAtFs: z.string().min(1).nullable(),
  modifiedAtFs: z.string().min(1).nullable(),
});
export type DuplicateCleanupFile = z.infer<typeof DuplicateCleanupFileSchema>;

export const DuplicateCleanupGroupSchema = z.object({
  groupId: z.number().int().positive(),
  sha256: z.string().min(1),
  keeper: DuplicateCleanupFileSchema,
  candidates: z.array(DuplicateCleanupFileSchema).min(1),
  excessBytes: z.number().int().nonnegative(),
});
export type DuplicateCleanupGroup = z.infer<typeof DuplicateCleanupGroupSchema>;

export const DuplicateCleanupPlanSchema = z.object({
  rootPath: z.string().min(1),
  keeperRule: z.literal(DUPLICATE_CLEANUP_KEEPER_RULE),
  summary: DuplicateCleanupSummarySchema,
  groups: z.array(DuplicateCleanupGroupSchema),
});
export type DuplicateCleanupPlan = z.infer<typeof DuplicateCleanupPlanSchema>;

export const DuplicateCleanupStatusSchema = z.enum([
  "idle",
  "running",
  "complete",
  "cancelled",
  "failed",
]);

export const DuplicateCleanupStateSchema = z.object({
  runId: z.number().int().positive().nullable(),
  status: DuplicateCleanupStatusSchema,
  groupsTotal: z.number().int().nonnegative(),
  groupsProcessed: z.number().int().nonnegative(),
  groupsSkipped: z.number().int().nonnegative(),
  filesTotal: z.number().int().nonnegative(),
  filesMoved: z.number().int().nonnegative(),
  filesSkipped: z.number().int().nonnegative(),
  bytesTotal: z.number().int().nonnegative(),
  bytesMoved: z.number().int().nonnegative(),
  currentPath: z.string().min(1).nullable(),
  quarantinePath: z.string().min(1).nullable(),
  cancelRequested: z.boolean(),
  errorMessage: z.string().min(1).nullable(),
  startedAt: z.string().min(1).nullable(),
  finishedAt: z.string().min(1).nullable(),
});
export type DuplicateCleanupState = z.infer<typeof DuplicateCleanupStateSchema>;

export const DuplicateCleanupMoveSchema = z.object({
  fileId: z.number().int().positive(),
  sourcePath: z.string().min(1),
  quarantinePath: z.string().min(1),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  sizeBytes: z.number().int().nonnegative(),
  createdAtFs: z.string().min(1).nullable(),
  modifiedAtFs: z.string().min(1).nullable(),
  keeperFileId: z.number().int().positive(),
  keeperPath: z.string().min(1),
  movedAt: z.string().min(1),
});
export type DuplicateCleanupMove = z.infer<typeof DuplicateCleanupMoveSchema>;

export const DuplicateCleanupRunParamsSchema = z.object({
  startedAt: z.string().min(1),
  keeperRule: z.literal(DUPLICATE_CLEANUP_KEEPER_RULE),
  rootPath: z.string().min(1),
  groupsTotal: z.number().int().nonnegative(),
  filesTotal: z.number().int().nonnegative(),
  bytesTotal: z.number().int().nonnegative(),
  quarantinePath: z.string().min(1),
  journalPath: z.string().min(1),
});
export type DuplicateCleanupRunParams = z.infer<typeof DuplicateCleanupRunParamsSchema>;

export const DuplicateCleanupMovesParamsSchema = z.object({
  runId: z.number().int().positive(),
  moves: z.array(DuplicateCleanupMoveSchema).min(1).max(1000),
});

export const DuplicateCleanupApplyResultSchema = z.object({
  recorded: z.number().int().nonnegative(),
  removed: z.number().int().nonnegative(),
});
export type DuplicateCleanupApplyResult = z.infer<typeof DuplicateCleanupApplyResultSchema>;

export const DuplicateCleanupFinishParamsSchema = z.object({
  runId: z.number().int().positive(),
  status: z.enum(["complete", "cancelled", "failed"]),
  groupsProcessed: z.number().int().nonnegative(),
  groupsSkipped: z.number().int().nonnegative(),
  filesMoved: z.number().int().nonnegative(),
  filesSkipped: z.number().int().nonnegative(),
  bytesMoved: z.number().int().nonnegative(),
  finishedAt: z.string().min(1),
  errorMessage: z.string().min(1).nullable(),
});
export type DuplicateCleanupFinishParams = z.infer<typeof DuplicateCleanupFinishParamsSchema>;

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
  dismissedAt: z.string().min(1).nullable(),
});
export type MissingFile = z.infer<typeof MissingFileSchema>;

export const MissingFilesPageSchema = z.object({
  items: z.array(MissingFileSchema),
  total: z.number().int().nonnegative(),
  fileIds: z.array(z.number().int().positive()),
  dismissedTotal: z.number().int().nonnegative(),
});
export type MissingFilesPage = z.infer<typeof MissingFilesPageSchema>;

export const MissingFilesParamsSchema = z.object({
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().min(1).max(200).optional(),
  dismissedOnly: z.boolean().optional(),
});
export type MissingFilesParams = z.infer<typeof MissingFilesParamsSchema>;

export const MissingFileTargetsSchema = z.object({
  fileIds: z.array(z.number().int().positive()).min(1).max(50_000),
});
export type MissingFileTargets = z.infer<typeof MissingFileTargetsSchema>;

export const MissingActionResultSchema = z.object({
  updated: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
});
export type MissingActionResult = z.infer<typeof MissingActionResultSchema>;

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

export const MovedCandidatesParamsSchema = z.object({
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().min(1).max(200).optional(),
});
export type MovedCandidatesParams = z.infer<typeof MovedCandidatesParamsSchema>;

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
