import { z } from "zod";
import { VolumeIdSchema } from "../drives";

export const DestinationGoalSchema = z.enum(["extend_coverage", "full_copy"]);
export type DestinationGoal = z.infer<typeof DestinationGoalSchema>;

export const DestinationRecordStatusSchema = z.enum(["active", "retired", "lost"]);
export type DestinationRecordStatus = z.infer<typeof DestinationRecordStatusSchema>;

export const DestinationConnectionSchema = z.enum(["connected", "offline", "retired", "lost"]);
export type DestinationConnection = z.infer<typeof DestinationConnectionSchema>;

export const FullCopyStatusSchema = z.enum([
  "not_applicable",
  "in_progress",
  "complete",
  "incomplete",
]);
export type FullCopyStatus = z.infer<typeof FullCopyStatusSchema>;

export const IdentityConfidenceSchema = z.enum(["confirmed", "probable", "needs_confirmation"]);
export type IdentityConfidence = z.infer<typeof IdentityConfidenceSchema>;

export const ReplicationRunStatusSchema = z.enum([
  "planned",
  "running",
  "paused",
  "stopping",
  "completed",
  "stopped",
  "failed",
  "interrupted",
]);

export const ReplicationRunScopeSchema = z.enum([
  "all_connected",
  "full_copy_only",
  "partial_only",
]);
export type ReplicationRunScope = z.infer<typeof ReplicationRunScopeSchema>;

export const AdoptionStatusSchema = z.enum([
  "idle",
  "scanning",
  "hashing",
  "paused",
  "complete",
  "failed",
  "interrupted",
]);
export type AdoptionStatus = z.infer<typeof AdoptionStatusSchema>;

export const AttentionCountsSchema = z.object({
  onlyOnDriveFiles: z.number().int().nonnegative(),
  onlyOnDriveBytes: z.number().int().nonnegative(),
  sourceMissingFiles: z.number().int().nonnegative(),
  sourceMissingBytes: z.number().int().nonnegative(),
});
export type AttentionCounts = z.infer<typeof AttentionCountsSchema>;

export const DestinationSummarySchema = z.object({
  id: z.number().int().positive(),
  destinationId: z.string().min(1),
  volumeId: VolumeIdSchema,
  label: z.string().min(1),
  letter: z.string().nullable(),
  mount: z.string().nullable(),
  fileSystem: z.string().min(1),
  goal: DestinationGoalSchema,
  connection: DestinationConnectionSchema,
  identityConfidence: IdentityConfidenceSchema,
  totalBytes: z.number().int().nonnegative(),
  freeBytes: z.number().int().nonnegative(),
  reserveBytes: z.number().int().nonnegative(),
  verifiedBytes: z.number().int().nonnegative(),
  verifiedFiles: z.number().int().nonnegative(),
  availableBytes: z.number().int().nonnegative(),
  lastSeenAt: z.string().nullable(),
  lastVerifiedAt: z.string().nullable(),
  priority: z.number().int().nonnegative(),
  fullCopyStatus: FullCopyStatusSchema,
  fullCopyShortfallBytes: z.number().int().nonnegative(),
  fullCopyShortfallFiles: z.number().int().nonnegative(),
  attention: AttentionCountsSchema,
  isFirstInFillOrder: z.boolean(),
});
export type DestinationSummary = z.infer<typeof DestinationSummarySchema>;

export const CoverageMapCellSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12).nullable(),
  count: z.number().int().nonnegative(),
});
export type CoverageMapCell = z.infer<typeof CoverageMapCellSchema>;

export const AdoptionStateSchema = z.object({
  destinationId: z.string().min(1),
  status: AdoptionStatusSchema,
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  lastSavedAt: z.string().nullable(),
  scannedFiles: z.number().int().nonnegative(),
  matchedFiles: z.number().int().nonnegative(),
  verifiedFiles: z.number().int().nonnegative(),
  conflictFiles: z.number().int().nonnegative(),
  staleFiles: z.number().int().nonnegative(),
  ambiguousFiles: z.number().int().nonnegative(),
  extraFiles: z.number().int().nonnegative(),
  unreadableFiles: z.number().int().nonnegative(),
  currentFile: z.string().nullable(),
  totalFiles: z.number().int().nonnegative().nullable(),
  etaSeconds: z.number().int().nonnegative().nullable(),
  errorMessage: z.string().nullable(),
  canPause: z.boolean(),
  canResume: z.boolean(),
});
export type AdoptionState = z.infer<typeof AdoptionStateSchema>;

export const CoverageSummarySchema = z.object({
  sourceFiles: z.number().int().nonnegative(),
  sourceBytes: z.number().int().nonnegative(),
  partialFiles: z.number().int().nonnegative(),
  partialBytes: z.number().int().nonnegative(),
  partialPercent: z.number().min(0).max(100),
  partialRemainderFiles: z.number().int().nonnegative(),
  partialRemainderBytes: z.number().int().nonnegative(),
  fullCopyFiles: z.number().int().nonnegative(),
  fullCopyBytes: z.number().int().nonnegative(),
  allDestinationFiles: z.number().int().nonnegative(),
  allDestinationBytes: z.number().int().nonnegative(),
  allDestinationPercent: z.number().min(0).max(100),
  overlapBytes: z.number().int().nonnegative(),
  coverageAsOf: z.string().nullable(),
});
export type CoverageSummary = z.infer<typeof CoverageSummarySchema>;

export const DestinationDetailSchema = DestinationSummarySchema.extend({
  rootRelative: z.string(),
  adoptionRootRelative: z.string(),
  copyRootRelative: z.string().nullable(),
  layout: z.enum(["dedicated", "mirror_source"]),
  allocationMode: z.enum(["all_safe", "percent", "fixed"]),
  allocationPercent: z.number().nullable(),
  allocationBytes: z.number().int().nonnegative().nullable(),
  localCatalogRelative: z.string().nullable(),
  localCatalogId: z.string().nullable(),
  localLibraryFiles: z.number().int().nonnegative(),
  localLibraryBytes: z.number().int().nonnegative(),
  cacheReady: z.boolean(),
  sourceIndexRelative: z.string().nullable(),
  sourceIndexUpdatedAt: z.string().nullable(),
  coverageMap: z.array(CoverageMapCellSchema),
  overlapBytes: z.number().int().nonnegative(),
  conflictFiles: z.number().int().nonnegative(),
  staleFiles: z.number().int().nonnegative(),
  missingFiles: z.number().int().nonnegative(),
  promotionReady: z.boolean(),
  adoption: z.lazy(() => AdoptionStateSchema).nullable(),
});
export type DestinationDetail = z.infer<typeof DestinationDetailSchema>;

export const DestinationCandidateSchema = z.object({
  volumeId: VolumeIdSchema,
  label: z.string().min(1),
  letter: z.string().nullable(),
  rootPath: z.string().min(1),
  fileSystem: z.string().min(1),
  totalBytes: z.number().int().nonnegative(),
  freeBytes: z.number().int().nonnegative(),
  hasMarker: z.boolean(),
  markerCatalogId: z.string().nullable(),
  isActiveSource: z.boolean(),
  blockedReason: z.string().nullable(),
});
export type DestinationCandidate = z.infer<typeof DestinationCandidateSchema>;

export const PlanWarningSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(["info", "warning", "blocking"]),
  message: z.string().min(1),
});
export type PlanWarning = z.infer<typeof PlanWarningSchema>;

export const FullCopyPlanJobSchema = z.object({
  kind: z.literal("full_copy"),
  destination: DestinationSummarySchema,
  sourceFiles: z.number().int().nonnegative(),
  sourceBytes: z.number().int().nonnegative(),
  newFiles: z.number().int().nonnegative(),
  newBytes: z.number().int().nonnegative(),
  shortfallFiles: z.number().int().nonnegative(),
  shortfallBytes: z.number().int().nonnegative(),
  freeAfterBytes: z.number().int().nonnegative(),
  completeAfterRun: z.boolean(),
  promotionReady: z.boolean(),
});

export const PartialPlanRowSchema = z.object({
  destination: DestinationSummarySchema,
  adoptedFiles: z.number().int().nonnegative(),
  adoptedBytes: z.number().int().nonnegative(),
  newFiles: z.number().int().nonnegative(),
  newBytes: z.number().int().nonnegative(),
  newRangeStart: z.string().nullable(),
  newRangeEnd: z.string().nullable(),
  freeAfterBytes: z.number().int().nonnegative(),
  offline: z.boolean(),
});

export const PartialPlanJobSchema = z.object({
  kind: z.literal("partial"),
  rows: z.array(PartialPlanRowSchema),
});

export const PlanRemainderSchema = z.object({
  files: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
  startDate: z.string().nullable(),
});
export type PlanRemainder = z.infer<typeof PlanRemainderSchema>;

export const PlanCoverageSchema = z.object({
  fullCopyPercent: z.number().min(0).max(100).nullable(),
  partialPercent: z.number().min(0).max(100),
  allDestinationPercent: z.number().min(0).max(100),
  hasFullCopy: z.boolean(),
});
export type PlanCoverage = z.infer<typeof PlanCoverageSchema>;

export const ReplicationPlanSchema = z.object({
  sourceFiles: z.number().int().nonnegative(),
  sourceBytes: z.number().int().nonnegative(),
  undatedFiles: z.number().int().nonnegative(),
  fullCopy: FullCopyPlanJobSchema.nullable(),
  partial: PartialPlanJobSchema.nullable(),
  remainder: PlanRemainderSchema,
  coverage: PlanCoverageSchema,
  warnings: z.array(PlanWarningSchema),
  executionScopes: z.array(ReplicationRunScopeSchema),
  planHash: z.string().min(1),
  canStart: z.boolean(),
  blockedReason: z.string().nullable(),
});
export type ReplicationPlan = z.infer<typeof ReplicationPlanSchema>;

export const RunSummarySchema = z.object({
  id: z.number().int().positive(),
  status: ReplicationRunStatusSchema,
  scope: ReplicationRunScopeSchema,
  planRevision: z.number().int().positive(),
  currentDestinationLabel: z.string().nullable(),
  currentFile: z.string().nullable(),
  percent: z.number().min(0).max(100),
  verifiedFiles: z.number().int().nonnegative(),
  verifiedBytes: z.number().int().nonnegative(),
  plannedFiles: z.number().int().nonnegative(),
  plannedBytes: z.number().int().nonnegative(),
  etaSeconds: z.number().int().nonnegative().nullable(),
  canPause: z.boolean(),
  canResume: z.boolean(),
  canStop: z.boolean(),
  canEditPlan: z.boolean(),
  lockedReason: z.string().nullable(),
});

export const ReplicationOverviewSchema = z.object({
  source: z.object({
    label: z.string().min(1),
    volumeId: VolumeIdSchema,
    fileCount: z.number().int().nonnegative(),
    bytes: z.number().int().nonnegative(),
    coverageAsOf: z.string().nullable(),
    readOnly: z.literal(true),
  }),
  coverage: CoverageSummarySchema,
  destinations: z.array(DestinationSummarySchema),
  hasFullCopy: z.boolean(),
  run: RunSummarySchema.nullable(),
});
export type ReplicationOverview = z.infer<typeof ReplicationOverviewSchema>;

export const AdoptionDestinationParamsSchema = z.object({
  destinationId: z.string().min(1),
});

export const GetDestinationParamsSchema = z.object({
  destinationId: z.string().min(1),
});

export const RegisterDestinationParamsSchema = z.object({
  volumeId: VolumeIdSchema,
  rootRelative: z.string().default(""),
  goal: DestinationGoalSchema,
  layout: z.enum(["dedicated", "mirror_source"]).default("dedicated"),
  allocationMode: z.enum(["all_safe", "percent", "fixed"]).default("all_safe"),
  allocationPercent: z.number().min(0).max(100).nullable().optional(),
  allocationBytes: z.number().int().nonnegative().nullable().optional(),
  reserveBytes: z.number().int().nonnegative(),
});
export type RegisterDestinationParams = z.infer<typeof RegisterDestinationParamsSchema>;

export const UpdateDestinationParamsSchema = z.object({
  destinationId: z.string().min(1),
  goal: DestinationGoalSchema.optional(),
  allocationMode: z.enum(["all_safe", "percent", "fixed"]).optional(),
  allocationPercent: z.number().min(0).max(100).nullable().optional(),
  allocationBytes: z.number().int().nonnegative().nullable().optional(),
  reserveBytes: z.number().int().nonnegative().optional(),
  priority: z.number().int().nonnegative().optional(),
  layout: z.enum(["dedicated", "mirror_source"]).optional(),
  status: DestinationRecordStatusSchema.optional(),
});
export type UpdateDestinationParams = z.infer<typeof UpdateDestinationParamsSchema>;
