import path from "node:path";
import type { AdoptionState } from "@shared/contracts/replication/types";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { DbClient } from "../../../clients/db-client";
import type { Logger } from "../../../logging/types";
import type { ReplicationAdoptionRecord } from "../../../db/repositories/replication-adoption-types";
import type { ArchiveIdentity } from "../../../db/repositories/archive-identity-repository";
import type { ReplicationDestinationRecord } from "../../../db/repositories/replication-destination-repository";
import type { DetectedDrive } from "../../drives/domain/drive";
import { resolveRelativePath } from "../../../platform/destination-path-policy";
import type {
  WorkloadCoordinator,
  WorkloadLease,
} from "../../workloads/application/workload-coordinator";
import type { DestinationReader } from "../infrastructure/destination-reader";
import { createDestinationWriter } from "../infrastructure/destination-writer";
import { writeMarker } from "../infrastructure/destination-marker";
import { runAdoption, type AdoptionControl } from "./adoption-runner";
import type { ReplicationFileHasher } from "./adoption-file-processor";

interface ResolvedDestination {
  record: ReplicationDestinationRecord;
  root: string;
}

interface ActiveAdoption {
  control: AdoptionControl;
  lease: WorkloadLease;
  loop: Promise<void>;
}

interface AdoptionDependencies {
  db: DbClient;
  listDetected: () => Promise<DetectedDrive[]>;
  reader: DestinationReader;
  hasher: ReplicationFileHasher;
  workloads: WorkloadCoordinator;
  logger: Logger;
  now?: () => Date;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function runningAdoption(
  record: ReplicationAdoptionRecord,
  active: ActiveAdoption | null,
): boolean {
  return (
    active !== null &&
    (record.status === "scanning" || record.status === "hashing") &&
    !active.control.paused
  );
}

function canResumeAdoption(status: ReplicationAdoptionRecord["status"]): boolean {
  return status === "paused" || status === "interrupted";
}

export class AdoptionService {
  private readonly nowDate: () => Date;
  private readonly active = new Map<string, ActiveAdoption>();

  constructor(private readonly dependencies: AdoptionDependencies) {
    this.nowDate = dependencies.now ?? (() => new Date());
  }

  async getState(destinationKey: string): Promise<AdoptionState> {
    const record = await this.adoption(destinationKey);
    return this.toState(record, this.active.get(destinationKey) ?? null);
  }

  async start(destinationKey: string): Promise<AdoptionState> {
    const existingActive = this.active.get(destinationKey);
    if (existingActive !== undefined) {
      return this.getState(destinationKey);
    }
    const resolved = await this.resolve(destinationKey);
    const lease = this.dependencies.workloads.acquire("replication", `adoption:${destinationKey}`);
    try {
      return await this.begin(destinationKey, resolved, lease);
    } catch (error) {
      lease.release();
      throw error;
    }
  }

  async pause(destinationKey: string): Promise<AdoptionState> {
    const record = await this.adoption(destinationKey);
    const active = this.active.get(destinationKey);
    if (active === undefined) {
      return this.toState(record, null);
    }
    active.control.paused = true;
    const now = this.now();
    await this.dependencies.db.request<ReplicationAdoptionRecord>(
      "replication.updateAdoptionStatus",
      { destinationId: record.destinationRowId, status: "paused", now, errorMessage: null },
    );
    await active.loop;
    return this.toState(await this.adoption(destinationKey), null);
  }

  async resume(destinationKey: string): Promise<AdoptionState> {
    const active = this.active.get(destinationKey);
    if (active !== undefined) {
      return this.getState(destinationKey);
    }
    const resolved = await this.resolve(destinationKey);
    const record = await this.adoption(destinationKey);
    if (record.status !== "paused" && record.status !== "interrupted") {
      throw new AppError(APP_ERROR_CODES.INVALID_REQUEST, "There is no paused adoption to resume");
    }
    const lease = this.dependencies.workloads.acquire("replication", `adoption:${destinationKey}`);
    try {
      return await this.begin(destinationKey, resolved, lease);
    } catch (error) {
      lease.release();
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    const loops: Promise<void>[] = [];
    for (const active of this.active.values()) {
      active.control.cancelled = true;
      loops.push(active.loop);
    }
    await Promise.allSettled(loops);
  }

  async interruptActive(): Promise<void> {
    await this.shutdown();
  }

  private async begin(
    destinationKey: string,
    resolved: ResolvedDestination,
    lease: WorkloadLease,
  ): Promise<AdoptionState> {
    const now = this.now();
    const adoption = await this.dependencies.db.request<ReplicationAdoptionRecord>(
      "replication.beginAdoption",
      { destinationId: resolved.record.id, now },
    );
    const control: AdoptionControl = {
      paused: false,
      cancelled: false,
      currentFile: null,
      etaSeconds: null,
      totalFiles: 0,
    };
    const active: ActiveAdoption = {
      control,
      lease,
      loop: Promise.resolve(),
    };
    this.active.set(destinationKey, active);
    active.loop = this.run(destinationKey, resolved, control, lease);
    return this.toState(adoption, active);
  }

  private async run(
    destinationKey: string,
    resolved: ResolvedDestination,
    control: AdoptionControl,
    lease: WorkloadLease,
  ): Promise<void> {
    const now = this.now();
    try {
      const status = await runAdoption(
        {
          db: this.dependencies.db,
          reader: this.dependencies.reader,
          hasher: this.dependencies.hasher,
          logger: this.dependencies.logger,
          now: () => this.nowDate(),
          control,
        },
        {
          destinationRowId: resolved.record.id,
          destinationRoot: resolved.root,
          copyRootRelative: resolved.record.copyRootRelative,
          runStartedAt: now,
        },
      );
      const finishedAt = this.now();
      if (status === "complete") {
        await this.writeSourceIndex(resolved, finishedAt);
        await this.dependencies.db.request("replication.finishAdoption", {
          destinationId: resolved.record.id,
          status: "complete",
          now: finishedAt,
          errorMessage: null,
        });
        this.dependencies.logger.info("Destination adoption completed", {
          destinationId: destinationKey,
        });
      } else if (status === "interrupted") {
        await this.dependencies.db.request("replication.finishAdoption", {
          destinationId: resolved.record.id,
          status: "interrupted",
          now: finishedAt,
          errorMessage: null,
        });
      }
    } catch (error) {
      this.dependencies.logger.error("Destination adoption failed", error);
      try {
        await this.dependencies.db.request("replication.finishAdoption", {
          destinationId: resolved.record.id,
          status: "failed",
          now: this.now(),
          errorMessage: errorText(error),
        });
      } catch {
        // The database worker may already be closing.
      }
    } finally {
      lease.release();
      if (this.active.get(destinationKey)?.control === control) {
        this.active.delete(destinationKey);
      }
    }
  }

  private async writeSourceIndex(resolved: ResolvedDestination, now: string): Promise<void> {
    try {
      const index = await this.dependencies.db.request<{ relativePath: string }>(
        "replication.writeSourceIndex",
        {
          destinationId: resolved.record.id,
          destinationRoot: resolved.root,
          now,
        },
      );
      const identity = await this.dependencies.db.request<ArchiveIdentity>(
        "replication.getSourceIdentity",
        {},
      );
      await writeMarker(createDestinationWriter(resolved.root), {
        schemaVersion: 1,
        catalogId: identity.catalogId,
        destinationId: resolved.record.destinationId,
        sourceLabel: identity.label,
        sourceVolumeId: identity.activeSourceVolumeId ?? identity.catalogId,
        rootRelative: resolved.record.rootRelative,
        copyRootRelative: resolved.record.copyRootRelative,
        replicaGoal: resolved.record.goal,
        replicaLayout: resolved.record.layout,
        localCatalogId: resolved.record.localCatalogId,
        localCatalogRelative: resolved.record.localCatalogRelative,
        sourceIndexRelative: index.relativePath,
        updatedAt: now,
      });
    } catch (error) {
      this.dependencies.logger.warn("Source index update failed after adoption", {
        message: errorText(error),
      });
    }
  }

  private toState(record: ReplicationAdoptionRecord, active: ActiveAdoption | null): AdoptionState {
    return {
      destinationId: record.destinationKey,
      status: record.status,
      startedAt: record.startedAt,
      finishedAt: record.finishedAt,
      lastSavedAt: record.lastSavedAt,
      scannedFiles: record.scannedFiles,
      matchedFiles: record.matchedFiles,
      verifiedFiles: record.verifiedFiles,
      conflictFiles: record.conflictFiles,
      staleFiles: record.staleFiles,
      ambiguousFiles: record.ambiguousFiles,
      extraFiles: record.extraFiles,
      unreadableFiles: record.unreadableFiles,
      currentFile: active?.control.currentFile ?? null,
      totalFiles: active?.control.totalFiles ?? null,
      etaSeconds: active?.control.etaSeconds ?? null,
      errorMessage: record.errorMessage,
      canPause: runningAdoption(record, active),
      canResume: canResumeAdoption(record.status),
    };
  }

  private async resolve(destinationKey: string): Promise<ResolvedDestination> {
    const record = await this.dependencies.db.request<ReplicationDestinationRecord | null>(
      "replication.findDestinationByDestinationId",
      { destinationId: destinationKey },
    );
    if (record === null) {
      throw new AppError(APP_ERROR_CODES.DESTINATION_NOT_FOUND, "Destination was not found");
    }
    if (record.status !== "active") {
      throw new AppError(
        APP_ERROR_CODES.DESTINATION_DISCONNECTED,
        "Only active destinations can be adopted",
      );
    }
    const drives = await this.dependencies.listDetected();
    const drive = drives.find((candidate) => candidate.volumeId === record.volumeId);
    if (drive === undefined) {
      throw new AppError(
        APP_ERROR_CODES.DESTINATION_DISCONNECTED,
        "Connect the destination drive before adopting it",
      );
    }
    const root = record.rootRelative.trim().length
      ? resolveRelativePath(drive.rootPath, record.rootRelative)
      : path.resolve(drive.rootPath);
    return { record, root };
  }

  private async adoption(destinationKey: string): Promise<ReplicationAdoptionRecord> {
    return this.dependencies.db.request<ReplicationAdoptionRecord>("replication.getAdoption", {
      destinationId: destinationKey,
    });
  }

  private now(): string {
    return this.nowDate().toISOString();
  }
}
