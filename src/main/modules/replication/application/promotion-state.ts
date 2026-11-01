import path from "node:path";
import { toVolumeId } from "@shared/contracts/drives";
import type { VolumeId } from "@shared/contracts/drives";
import type { PromotionState } from "@shared/contracts/replication/types";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { DbClient } from "../../../clients/db-client";
import type { ArchiveIdentity } from "../../../db/repositories/archive-identity-repository";
import type { ReplicationDestinationRecord } from "../../../db/repositories/replication-destination-repository";
import type { PromotionRecord } from "../../../db/repositories/replication-promotion-types";
import type { ReplicationRunRecord } from "../../../db/repositories/replication-run-types";
import type { DetectedDrive } from "../../drives/domain/drive";
import type { WorkloadCoordinator } from "../../workloads/application/workload-coordinator";
import { evaluatePromotion, evaluateRollback } from "../domain/promotion-policy";
import { resolveRelativePath } from "../../../platform/destination-path-policy";
import type { PlanService, ReplicationExecution } from "./plan-service";

const GIB = 1024 ** 3;

export interface PromotionContext {
  execution: ReplicationExecution;
  record: ReplicationDestinationRecord;
  records: ReplicationDestinationRecord[];
  identity: ArchiveIdentity;
  drives: DetectedDrive[];
  drive: DetectedDrive | undefined;
  run: ReplicationRunRecord | null;
  latestPromotion: PromotionRecord | null;
  rollbackWindowOpen: boolean;
}

interface LatestPromotionPayload {
  promotion: PromotionRecord | null;
  windowOpen: boolean;
}

export function destinationMount(
  record: ReplicationDestinationRecord,
  drive: DetectedDrive,
): string {
  return record.rootRelative.trim().length
    ? resolveRelativePath(drive.rootPath, record.rootRelative)
    : path.resolve(drive.rootPath);
}

export async function loadPromotionContext(input: {
  db: DbClient;
  planService: PlanService;
  listDetected: () => Promise<DetectedDrive[]>;
  destinationId: string;
}): Promise<PromotionContext> {
  const [execution, records, identity, drives, run] = await Promise.all([
    input.planService.getExecutionPlan(),
    input.db.request<ReplicationDestinationRecord[]>("replication.listDestinations", {}),
    input.db.request<ArchiveIdentity>("replication.getSourceIdentity", {}),
    input.listDetected(),
    input.db.request<ReplicationRunRecord | null>("replication.getLatestRun", {}),
  ]);
  const record = records.find((item) => item.destinationId === input.destinationId);
  if (record === undefined) {
    throw new AppError(APP_ERROR_CODES.DESTINATION_NOT_FOUND, "The destination was not found");
  }
  const drive = drives.find((candidate) => candidate.volumeId === record.volumeId);
  const destinationRootPath = drive === undefined ? null : destinationMount(record, drive);
  const latest = await input.db.request<LatestPromotionPayload>("promotion.getLatest", {
    toVolumeId: record.volumeId,
    destinationRootPath,
  });
  return {
    execution,
    record,
    records,
    identity,
    drives,
    drive,
    run,
    latestPromotion: latest.promotion,
    rollbackWindowOpen: latest.windowOpen,
  };
}

export function promotionJob(context: PromotionContext) {
  const job = context.execution.plan.fullCopy;
  return job !== null && job.destination.destinationId === context.record.destinationId
    ? job
    : null;
}

export function partialPromotionDestinations(
  context: PromotionContext,
): PromotionState["partialDestinations"] {
  const drivesByVolume = new Map(context.drives.map((drive) => [drive.volumeId, drive]));
  return context.records
    .filter((record) => record.goal === "extend_coverage" && record.status === "active")
    .map((record) => ({
      destinationId: record.destinationId,
      label: record.label,
      goal: record.goal,
      status: record.status,
      connection:
        record.status === "active" && drivesByVolume.has(toVolumeId(record.volumeId))
          ? ("connected" as const)
          : record.status === "lost"
            ? ("lost" as const)
            : ("offline" as const),
      verifiedFiles: record.verifiedFiles,
      verifiedBytes: record.verifiedBytes,
    }));
}

export function buildPromotionState(
  context: PromotionContext,
  workloads: WorkloadCoordinator,
): PromotionState {
  const { plan } = context.execution;
  const job = promotionJob(context);
  const metrics = promotionMetrics(context, job);
  const oldSource = oldSourceFacts(context, plan.sourceBytes);
  const eligibility = promotionEligibility(context, workloads, job, metrics);
  const facts = promotionRecordFacts(context.latestPromotion);
  const rollback = evaluateRollback({
    status: facts.status,
    windowOpen: context.rollbackWindowOpen,
  });
  return {
    promotionId: facts.id,
    destinationId: context.record.destinationId,
    destinationLabel: context.record.label,
    destinationVolumeId: toVolumeId(context.record.volumeId),
    sourceLabel: context.identity.label,
    sourceVolumeId: oldSource.volumeId,
    status: facts.status,
    connected: context.drive !== undefined,
    identityConfirmed: context.record.identityConfidence === "confirmed",
    canPromote: eligibility.canPromote,
    blockedReason: eligibility.blockedReason,
    verified: facts.verified,
    counts: {
      sourceFiles: metrics.sourceFiles,
      sourceBytes: metrics.sourceBytes,
      verifiedFiles: metrics.verifiedFiles,
      verifiedBytes: metrics.verifiedBytes,
      shortfallFiles: metrics.shortfallFiles,
      shortfallBytes: metrics.shortfallBytes,
      staleFiles: context.record.staleFiles,
      missingFiles: context.record.missingFiles,
      conflictFiles: context.record.conflictFiles,
      failedFiles: context.record.failedFiles,
      destinationOnlyFiles: context.record.onlyOnDriveFiles,
      destinationOnlyBytes: context.record.onlyOnDriveBytes,
    },
    oldSource,
    partialDestinations: partialPromotionDestinations(context),
    startedAt: facts.startedAt,
    completedAt: facts.completedAt,
    rolledBackAt: facts.rolledBackAt,
    errorMessage: facts.errorMessage,
    canRollback: rollback.canRollback,
    rollbackBlockedReason: rollback.blockedReason,
    newCatalog: null,
    previousSourceVolumeId: facts.previousSourceVolumeId,
  } satisfies PromotionState;
}

function optional<T>(value: T | null | undefined): T | null {
  return value ?? null;
}

function promotionStatus(promotion: PromotionRecord | null): PromotionState["status"] {
  return promotion === null ? "planned" : promotion.status;
}

function isVerifiedStatus(status: PromotionState["status"]): boolean {
  return status === "verified" || status === "completed";
}

function previousSourceVolume(promotion: PromotionRecord | null): VolumeId | null {
  if (promotion === null || promotion.status !== "completed") {
    return null;
  }
  return promotion.fromVolumeId === null ? null : toVolumeId(promotion.fromVolumeId);
}

function promotionRecordFacts(promotion: PromotionRecord | null): {
  id: number | null;
  status: PromotionState["status"];
  verified: boolean;
  startedAt: string | null;
  completedAt: string | null;
  rolledBackAt: string | null;
  errorMessage: string | null;
  previousSourceVolumeId: VolumeId | null;
} {
  const status = promotionStatus(promotion);
  return {
    id: optional(promotion?.id),
    status,
    verified: isVerifiedStatus(status),
    startedAt: optional(promotion?.startedAt),
    completedAt: optional(promotion?.completedAt),
    rolledBackAt: optional(promotion?.rolledBackAt),
    errorMessage: optional(promotion?.errorMessage),
    previousSourceVolumeId: previousSourceVolume(promotion),
  };
}

interface PromotionMetrics {
  sourceFiles: number;
  sourceBytes: number;
  remainingFiles: number;
  remainingBytes: number;
  verifiedFiles: number;
  verifiedBytes: number;
  shortfallFiles: number;
  shortfallBytes: number;
}

function promotionMetrics(
  context: PromotionContext,
  job: ReturnType<typeof promotionJob>,
): PromotionMetrics {
  const { plan } = context.execution;
  const sourceFiles = plan.sourceFiles;
  const remainingFiles = job === null ? sourceFiles : job.newFiles;
  const remainingBytes = job === null ? plan.sourceBytes : job.newBytes;
  return {
    sourceFiles,
    sourceBytes: plan.sourceBytes,
    remainingFiles,
    remainingBytes,
    verifiedFiles: sourceFiles - remainingFiles,
    verifiedBytes: plan.sourceBytes - remainingBytes,
    shortfallFiles: job?.shortfallFiles ?? 0,
    shortfallBytes: job?.shortfallBytes ?? 0,
  };
}

function oldSourceFacts(
  context: PromotionContext,
  requiredBytes: number,
): PromotionState["oldSource"] {
  const volumeId = context.identity.activeSourceVolumeId ?? context.identity.catalogId;
  const drive = context.drives.find((candidate) => candidate.volumeId === volumeId);
  const availableBytes = drive === undefined ? 0 : Math.max(0, drive.freeBytes - GIB);
  return {
    label: context.identity.label,
    volumeId: toVolumeId(volumeId),
    sourceRootRelative: context.identity.sourceRootRelative,
    availableBytes,
    requiredBytes,
    fitsFullCopy: availableBytes >= requiredBytes,
  };
}

function promotionEligibility(
  context: PromotionContext,
  workloads: WorkloadCoordinator,
  job: ReturnType<typeof promotionJob>,
  metrics: PromotionMetrics,
): { canPromote: boolean; blockedReason: string | null } {
  const eligible = evaluatePromotion({
    sourceRole: context.identity.role,
    goal: context.record.goal,
    destinationStatus: context.record.status,
    connection: context.drive === undefined ? "offline" : "connected",
    identityConfirmed: context.record.identityConfidence === "confirmed",
    sourceFiles: metrics.sourceFiles,
    remainingFiles: metrics.remainingFiles,
    shortfallFiles: metrics.shortfallFiles,
    staleFiles: context.record.staleFiles,
    missingFiles: context.record.missingFiles,
    conflictFiles: context.record.conflictFiles,
    failedFiles: context.record.failedFiles,
    activeRunStatus: context.run?.status ?? null,
    workloadActive: workloads.current() !== null,
  });
  if (job === null) {
    return {
      canPromote: false,
      blockedReason: "This destination is not the planned full-copy target.",
    };
  }
  return eligible;
}
