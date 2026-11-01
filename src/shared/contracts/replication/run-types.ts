import { z } from "zod";

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
export type ReplicationRunStatus = z.infer<typeof ReplicationRunStatusSchema>;

export const ReplicationRunScopeSchema = z.enum([
  "all_connected",
  "full_copy_only",
  "partial_only",
]);
export type ReplicationRunScope = z.infer<typeof ReplicationRunScopeSchema>;

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
export type RunSummary = z.infer<typeof RunSummarySchema>;

export const RunOrderStateSchema = z.enum(["pending", "active", "complete", "offline", "skipped"]);
export type RunOrderState = z.infer<typeof RunOrderStateSchema>;

export const RunOrderEntrySchema = z.object({
  destinationId: z.string().min(1),
  label: z.string().min(1),
  priority: z.number().int().nonnegative(),
  state: RunOrderStateSchema,
  plannedFiles: z.number().int().nonnegative(),
  plannedBytes: z.number().int().nonnegative(),
});
export type RunOrderEntry = z.infer<typeof RunOrderEntrySchema>;

export const RunErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean(),
});
export type RunError = z.infer<typeof RunErrorSchema>;

export const RunCapabilitiesSchema = z.object({
  canPause: z.boolean(),
  canResume: z.boolean(),
  canStop: z.boolean(),
  canEditPlan: z.boolean(),
  canAddDestination: z.boolean(),
  canPromote: z.boolean(),
  canSwitchSource: z.boolean(),
  lockedReason: z.string().nullable(),
});
export type RunCapabilities = z.infer<typeof RunCapabilitiesSchema>;

export const ReplicationRunStateSchema = z.object({
  id: z.number().int().positive(),
  status: ReplicationRunStatusSchema,
  scope: ReplicationRunScopeSchema,
  planRevision: z.number().int().positive(),
  planHash: z.string().nullable(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  pausedAt: z.string().nullable(),
  resumedAt: z.string().nullable(),
  stopRequestedAt: z.string().nullable(),
  lastHeartbeatAt: z.string().nullable(),
  currentDestinationId: z.string().nullable(),
  currentDestinationLabel: z.string().nullable(),
  currentFile: z.string().nullable(),
  plannedFiles: z.number().int().nonnegative(),
  plannedBytes: z.number().int().nonnegative(),
  copiedFiles: z.number().int().nonnegative(),
  copiedBytes: z.number().int().nonnegative(),
  verifiedFiles: z.number().int().nonnegative(),
  verifiedBytes: z.number().int().nonnegative(),
  failedFiles: z.number().int().nonnegative(),
  failedBytes: z.number().int().nonnegative(),
  staleFiles: z.number().int().nonnegative(),
  staleBytes: z.number().int().nonnegative(),
  remainderFiles: z.number().int().nonnegative(),
  remainderBytes: z.number().int().nonnegative(),
  percent: z.number().min(0).max(100),
  speedBytesPerSecond: z.number().nonnegative().nullable(),
  etaSeconds: z.number().int().nonnegative().nullable(),
  order: z.array(RunOrderEntrySchema),
  errors: z.array(RunErrorSchema),
  capabilities: RunCapabilitiesSchema,
  errorMessage: z.string().nullable(),
});
export type ReplicationRunState = z.infer<typeof ReplicationRunStateSchema>;

export const RunEventTypeSchema = z.enum([
  "started",
  "paused",
  "resumed",
  "stop_requested",
  "plan_changed",
  "destination_added",
  "completed",
  "stopped",
  "failed",
  "interrupted",
]);
export type RunEventType = z.infer<typeof RunEventTypeSchema>;

export const RunEventSchema = z.object({
  id: z.number().int().positive(),
  runId: z.number().int().positive(),
  at: z.string().min(1),
  type: RunEventTypeSchema,
  planRevision: z.number().int().positive().nullable(),
  note: z.string().nullable(),
});
export type RunEvent = z.infer<typeof RunEventSchema>;

export const RunEventsPageSchema = z.object({
  events: z.array(RunEventSchema),
  nextCursor: z.number().int().positive().nullable(),
});
export type RunEventsPage = z.infer<typeof RunEventsPageSchema>;

export const StartRunParamsSchema = z.object({
  scope: ReplicationRunScopeSchema.default("partial_only"),
  planHash: z.string().min(1).optional(),
  replaceStale: z.boolean().default(false),
});
export type StartRunParams = z.infer<typeof StartRunParamsSchema>;

export const RunEventsParamsSchema = z.object({
  runId: z.number().int().positive(),
  cursor: z.number().int().positive().nullable().optional(),
  limit: z.number().int().positive().max(200).optional(),
});
export type RunEventsParams = z.infer<typeof RunEventsParamsSchema>;
