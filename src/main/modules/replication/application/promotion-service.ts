import type { CatalogSummary, VolumeId } from "@shared/contracts/drives";
import type { ApplyPromotionParams, PromotionState } from "@shared/contracts/replication/types";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { DbClient } from "../../../clients/db-client";
import type { Logger } from "../../../logging/types";
import type { ReplicationDestinationRecord } from "../../../db/repositories/replication-destination-repository";
import type { PromotionRecord } from "../../../db/repositories/replication-promotion-types";
import { relativePathKey } from "../../../platform/destination-path-policy";
import type { DetectedDrive } from "../../drives/domain/drive";
import { evaluatePromotion } from "../domain/promotion-policy";
import type { DestinationReader } from "../infrastructure/destination-reader";
import type { DestinationFileEntry } from "../infrastructure/destination-reader";
import type { FileHasher } from "../../scanning/domain/scan-files";
import {
  destinationMount,
  loadPromotionContext,
  promotionJob,
  buildPromotionState,
  type PromotionContext,
} from "./promotion-state";
import type { PlanService } from "./plan-service";
import { updatePromotionMarkers } from "./promotion-markers";
import type { WorkloadCoordinator } from "../../workloads/application/workload-coordinator";

interface ReplicaVerificationRow {
  destination_row_id: number;
  file_id: number;
  relative_path: string;
  source_relative_path: string;
  sha256: string | null;
  destination_size_at_verify: number | null;
  destination_modified_at_fs_at_verify: string | null;
  source_size: number;
  source_modified_at_fs: string | null;
  state: "present" | "missing";
}

interface PromotionApplyResult {
  promotion: PromotionRecord;
  catalog: CatalogSummary;
  catalogId: string;
  newSourceRootRelative: string;
  oldSourceVolumeId: string;
  oldSourceLabel: string;
  destinations: ReplicationDestinationRecord[];
}

interface PromotionRollbackResult {
  promotion: PromotionRecord;
  restoredSourceVolumeId: VolumeId;
  restoredSourceLabel: string;
}

export interface PromotionServiceDependencies {
  db: DbClient;
  listDetected: () => Promise<DetectedDrive[]>;
  planService: PlanService;
  workloads: WorkloadCoordinator;
  reader: DestinationReader;
  hasher: FileHasher;
  logger: Logger;
  now?: () => Date;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class PromotionService {
  private readonly nowDate: () => Date;

  constructor(private readonly dependencies: PromotionServiceDependencies) {
    this.nowDate = dependencies.now ?? (() => new Date());
  }

  async getState(destinationId: string): Promise<PromotionState> {
    const context = await loadPromotionContext({
      db: this.dependencies.db,
      planService: this.dependencies.planService,
      listDetected: this.dependencies.listDetected,
      destinationId,
    });
    return buildPromotionState(context, this.dependencies.workloads);
  }

  async verify(destinationId: string, deep: boolean): Promise<PromotionState> {
    const context = await this.loadContext(destinationId);
    this.assertVerifiable(context);
    await this.markMismatches(destinationId, deep);
    const state = buildPromotionState(
      await this.loadContext(destinationId),
      this.dependencies.workloads,
    );
    await this.dependencies.db.request("promotion.record", {
      destinationId,
      verifiedFiles: state.counts.verifiedFiles,
      verifiedBytes: state.counts.verifiedBytes,
      shortfallFiles: state.counts.shortfallFiles,
      shortfallBytes: state.counts.shortfallBytes,
      now: this.now(),
    });
    return buildPromotionState(await this.loadContext(destinationId), this.dependencies.workloads);
  }

  private async markMismatches(destinationId: string, deep: boolean): Promise<void> {
    const context = await this.loadContext(destinationId);
    if (context.drive === undefined) {
      throw new AppError(APP_ERROR_CODES.DESTINATION_DISCONNECTED, "Connect the destination first");
    }
    const root = destinationMount(context.record, context.drive);
    const scan = await this.dependencies.reader.scan(root);
    const files = new Map(scan.files.map((file) => [relativePathKey(file.relativePath), file]));
    const rows = await this.dependencies.db.request<ReplicaVerificationRow[]>(
      "promotion.listReplicaFiles",
      { destinationId },
    );
    const now = this.now();
    for (const row of rows) {
      if (row.state !== "present") {
        continue;
      }
      const mismatch = await this.mismatchFor(row, files, deep);
      if (mismatch === null) {
        continue;
      }
      await this.dependencies.db.request("replication.setReplicaStatus", {
        destinationId: row.destination_row_id,
        fileId: row.file_id,
        status: mismatch.status,
        now,
        errorMessage: mismatch.message,
      });
    }
  }

  private async mismatchFor(
    row: ReplicaVerificationRow,
    files: Map<string, DestinationFileEntry>,
    deep: boolean,
  ): Promise<{ status: "stale" | "missing"; message: string } | null> {
    const file = files.get(relativePathKey(row.relative_path));
    if (file === undefined) {
      return { status: "missing", message: "Destination file is missing" };
    }
    if (file.size !== row.source_size) {
      return { status: "stale", message: "Destination file size changed" };
    }
    if (file.modifiedAtFs === row.destination_modified_at_fs_at_verify) {
      return null;
    }
    if (!deep) {
      return { status: "stale", message: "Destination file modified time changed" };
    }
    const hash = await this.dependencies.hasher.hash(file.absolutePath);
    return row.sha256 !== null && hash === row.sha256
      ? null
      : { status: "stale", message: "Destination file hash changed" };
  }

  private assertVerifiable(context: PromotionContext): void {
    if (promotionJob(context) === null) {
      throw new AppError(
        APP_ERROR_CODES.PROMOTION_BLOCKED,
        "This destination is not the planned full-copy target.",
      );
    }
    const structural = evaluatePromotion({
      sourceRole: context.identity.role,
      goal: context.record.goal,
      destinationStatus: context.record.status,
      connection: context.drive === undefined ? "offline" : "connected",
      identityConfirmed: context.record.identityConfidence === "confirmed",
      sourceFiles: context.execution.plan.sourceFiles,
      remainingFiles: 0,
      shortfallFiles: 0,
      staleFiles: 0,
      missingFiles: 0,
      conflictFiles: 0,
      failedFiles: 0,
      activeRunStatus: context.run?.status ?? null,
      workloadActive: this.dependencies.workloads.current() !== null,
    });
    if (!structural.canPromote) {
      throw new AppError(
        APP_ERROR_CODES.PROMOTION_BLOCKED,
        structural.blockedReason ?? "Promotion is blocked.",
      );
    }
    if (context.drive === undefined) {
      throw new AppError(APP_ERROR_CODES.DESTINATION_DISCONNECTED, "Connect the destination first");
    }
  }

  private loadContext(destinationId: string): Promise<PromotionContext> {
    return loadPromotionContext({
      db: this.dependencies.db,
      planService: this.dependencies.planService,
      listDetected: this.dependencies.listDetected,
      destinationId,
    });
  }

  async apply(params: ApplyPromotionParams): Promise<PromotionState> {
    const verified = await this.verify(params.destinationId, params.deepVerify);
    if (!verified.canPromote) {
      throw new AppError(
        APP_ERROR_CODES.PROMOTION_BLOCKED,
        verified.blockedReason ?? "Promotion is blocked.",
      );
    }
    const context = await loadPromotionContext({
      db: this.dependencies.db,
      planService: this.dependencies.planService,
      listDetected: this.dependencies.listDetected,
      destinationId: params.destinationId,
    });
    if (context.drive === undefined) {
      throw new AppError(APP_ERROR_CODES.DESTINATION_DISCONNECTED, "Connect the destination first");
    }
    const now = this.now();
    const result = await this.dependencies.db.request<PromotionApplyResult>("promotion.apply", {
      destinationId: params.destinationId,
      destinationRootPath: destinationMount(context.record, context.drive),
      destinationVolumeId: context.record.volumeId,
      destinationVolumeSerial: context.drive.serialNumber,
      destinationLabel: context.drive.label,
      destinationFileSystem: context.drive.fileSystem,
      oldSourceFate: params.oldSourceFate,
      partialFates: params.partialFates,
      oldSourceFits: verified.oldSource.fitsFullCopy,
      now,
    });
    await updatePromotionMarkers({
      records: result.destinations,
      drives: await this.dependencies.listDetected(),
      catalogId: result.catalogId,
      sourceLabel: verified.sourceLabel,
      sourceVolumeId: result.catalog.volumeId,
      now,
      logger: this.dependencies.logger,
    });
    return {
      ...verified,
      promotionId: result.promotion.id,
      status: "completed",
      canPromote: false,
      blockedReason: null,
      verified: true,
      startedAt: result.promotion.startedAt ?? verified.startedAt,
      completedAt: now,
      rolledBackAt: null,
      errorMessage: null,
      canRollback: true,
      rollbackBlockedReason: null,
      newCatalog: result.catalog,
      previousSourceVolumeId: verified.oldSource.volumeId,
    };
  }

  async rollback(promotionId: number, destinationId: string): Promise<PromotionState> {
    const context = await loadPromotionContext({
      db: this.dependencies.db,
      planService: this.dependencies.planService,
      listDetected: this.dependencies.listDetected,
      destinationId,
    }).catch(() => null);
    const promotionRootPath =
      context === null || context.drive === undefined
        ? null
        : destinationMount(context.record, context.drive);
    const now = this.now();
    const result = await this.dependencies.db.request<PromotionRollbackResult>(
      "promotion.rollback",
      { promotionId, promotionRootPath, now },
    );
    const restoredContext = await loadPromotionContext({
      db: this.dependencies.db,
      planService: this.dependencies.planService,
      listDetected: this.dependencies.listDetected,
      destinationId,
    });
    const restored = buildPromotionState(restoredContext, this.dependencies.workloads);
    await updatePromotionMarkers({
      records: restoredContext.records,
      drives: await this.dependencies.listDetected(),
      catalogId: restoredContext.identity.catalogId,
      sourceLabel: result.restoredSourceLabel,
      sourceVolumeId: result.restoredSourceVolumeId,
      now,
      logger: this.dependencies.logger,
    });
    return {
      ...restored,
      promotionId: result.promotion.id,
      status: "rolled_back",
      canPromote: false,
      blockedReason: "The promotion was rolled back. Verify the full copy again before promoting.",
      canRollback: false,
      rollbackBlockedReason: "This promotion was already rolled back.",
      rolledBackAt: now,
      previousSourceVolumeId: result.restoredSourceVolumeId,
    };
  }

  async closeRollbackWindow(): Promise<void> {
    try {
      await this.dependencies.db.request("promotion.closeWindow", { now: this.now() });
    } catch (error) {
      this.dependencies.logger.warn("Promotion rollback window could not be closed", {
        message: errorText(error),
      });
    }
  }

  private now(): string {
    return this.nowDate().toISOString();
  }
}
