import { createHash } from "node:crypto";
import { toVolumeId } from "@shared/contracts/drives";
import type {
  CoverageSummary,
  ReplicationOverview,
  ReplicationPlan,
} from "@shared/contracts/replication/types";
import type { DbClient } from "../../../clients/db-client";
import type { ArchiveIdentity } from "../../../db/repositories/archive-identity-repository";
import type { ReplicationDestinationRecord } from "../../../db/repositories/replication-destination-repository";
import type { ReplicationSourceFile } from "../../../db/repositories/replication-source-repository";
import type { DetectedDrive } from "../../drives/domain/drive";
import { computeCoverage, type CoverageResult } from "../domain/coverage";
import { evaluateFullCopy } from "../domain/full-copy-status";
import type { CoverageDestinationFacts, SourceFileFacts } from "../domain/replication-types";
import { buildReplicationExecutionPlan, buildReplicationPlan } from "../domain/plan-builder";
import type { PlanDestinationInput } from "../domain/plan-types";
import { firstPartialPriority, toDestinationSummary } from "./destination-summary";

interface PlanData {
  identity: ArchiveIdentity;
  sourceFiles: SourceFileFacts[];
  sources: ReplicationSourceFile[];
  records: ReplicationDestinationRecord[];
  coverage: CoverageResult;
  planDestinations: PlanDestinationInput[];
  overviewDestinations: ReplicationOverview["destinations"];
  hasFullCopy: boolean;
}

export interface ExecutionDestination {
  destination: ReplicationDestinationRecord;
  files: ReplicationSourceFile[];
}

export interface ReplicationExecution {
  plan: ReplicationPlan;
  partial: ExecutionDestination[];
  fullCopy: ExecutionDestination | null;
}

interface CoveragePayload {
  destinationRowId: number;
  verifiedFileIds: number[];
  verifiedBytes: number;
  lastVerifiedAt: string | null;
}

interface ReplacementPayload {
  destinationRowId: number;
  fileId: number;
}

export interface PlanServiceDependencies {
  db: DbClient;
  listDetected: () => Promise<DetectedDrive[]>;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sourceFacts(files: ReplicationSourceFile[]): SourceFileFacts[] {
  return files
    .filter((file) => file.state === "present")
    .map((file) => ({
      id: file.id,
      sourceRelativePath: file.sourceRelativePath,
      name: file.name,
      size: file.size,
      resolvedDate: file.resolvedDate,
      mediaClass: file.mediaClass,
    }));
}

export class PlanService {
  constructor(private readonly dependencies: PlanServiceDependencies) {}

  async getOverview(): Promise<ReplicationOverview> {
    const records = await this.dependencies.db.request<ReplicationDestinationRecord[]>(
      "replication.listDestinations",
      {},
    );
    const hasActiveFullCopy = records.some(
      (record) => record.goal === "full_copy" && record.status === "active",
    );
    if (hasActiveFullCopy) {
      return this.overviewFromData(await this.load());
    }

    const [drives, identity, coverage] = await Promise.all([
      this.dependencies.listDetected(),
      this.dependencies.db.request<ArchiveIdentity>("replication.getSourceIdentity", {}),
      this.dependencies.db.request<CoverageSummary>("replication.getCoverageSummary", {}),
    ]);
    const drivesByVolume = new Map(drives.map((drive) => [drive.volumeId, drive]));
    const firstPriority = firstPartialPriority(records);
    const destinations = records.map((record) =>
      toDestinationSummary(
        record,
        drivesByVolume.get(record.volumeId as DetectedDrive["volumeId"]),
        firstPriority,
      ),
    );
    return {
      source: {
        label: identity.label,
        volumeId: toVolumeId(identity.activeSourceVolumeId ?? identity.catalogId),
        fileCount: coverage.sourceFiles,
        bytes: coverage.sourceBytes,
        coverageAsOf: coverage.coverageAsOf,
        readOnly: true,
      },
      coverage,
      destinations,
      hasFullCopy: destinations.some(
        (destination) =>
          destination.goal === "full_copy" &&
          destination.connection !== "retired" &&
          destination.connection !== "lost",
      ),
      run: null,
    };
  }

  async getCoverage(): Promise<CoverageSummary> {
    return this.dependencies.db.request<CoverageSummary>("replication.getCoverageSummary", {});
  }

  private overviewFromData(data: PlanData): ReplicationOverview {
    return {
      source: {
        label: data.identity.label,
        volumeId: toVolumeId(data.identity.activeSourceVolumeId ?? data.identity.catalogId),
        fileCount: data.coverage.summary.sourceFiles,
        bytes: data.coverage.summary.sourceBytes,
        coverageAsOf: data.coverage.summary.coverageAsOf,
        readOnly: true,
      },
      coverage: data.coverage.summary,
      destinations: data.overviewDestinations,
      hasFullCopy: data.hasFullCopy,
      run: null,
    };
  }

  async getPlan(): Promise<ReplicationPlan> {
    const data = await this.load();
    return buildReplicationPlan({
      sourceFiles: data.sourceFiles,
      destinations: data.planDestinations,
      coverage: data.coverage,
      hash: sha256,
    });
  }

  async refreshStatuses(): Promise<void> {
    await this.load();
  }

  async getExecutionPlan(): Promise<ReplicationExecution> {
    const data = await this.load();
    const execution = buildReplicationExecutionPlan({
      sourceFiles: data.sourceFiles,
      destinations: data.planDestinations,
      coverage: data.coverage,
      hash: sha256,
    });
    const sourcesById = new Map(data.sources.map((file) => [file.id, file]));
    const recordsById = new Map(data.records.map((record) => [record.id, record]));
    const toAssignment = (
      destinationId: number,
      files: SourceFileFacts[],
    ): ExecutionDestination | null => {
      const destination = recordsById.get(destinationId);
      if (destination === undefined) {
        return null;
      }
      return {
        destination,
        files: files
          .map((file) => sourcesById.get(file.id))
          .filter((file): file is ReplicationSourceFile => file !== undefined),
      };
    };
    const partial: ExecutionDestination[] = [];
    for (const [destinationId, files] of execution.partialFiles) {
      const assignment = toAssignment(destinationId, files);
      if (assignment !== null) {
        partial.push(assignment);
      }
    }
    const fullCopyDestination = data.records.find(
      (record) => record.destinationId === execution.plan.fullCopy?.destination.destinationId,
    );
    const fullCopy =
      fullCopyDestination === undefined
        ? null
        : toAssignment(fullCopyDestination.id, execution.fullCopyFiles);
    return { plan: execution.plan, partial, fullCopy };
  }

  private async load(): Promise<PlanData> {
    const [records, drives, identity, sources, coverageRows, replacementRows] = await Promise.all([
      this.dependencies.db.request<ReplicationDestinationRecord[]>(
        "replication.listDestinations",
        {},
      ),
      this.dependencies.listDetected(),
      this.dependencies.db.request<ArchiveIdentity>("replication.getSourceIdentity", {}),
      this.dependencies.db.request<ReplicationSourceFile[]>("replication.listSourceFiles", {}),
      this.dependencies.db.request<CoveragePayload[]>("replication.listVerifiedCoverage", {}),
      this.dependencies.db.request<ReplacementPayload[]>("replication.listReplicaReplacements", {}),
    ]);
    const drivesByVolume = new Map(drives.map((drive) => [drive.volumeId, drive]));
    const firstPriority = firstPartialPriority(records);
    const coverageById = new Map(
      coverageRows.map((row) => [row.destinationRowId, new Set(row.verifiedFileIds)]),
    );
    const replacementsById = new Map<number, Set<number>>();
    for (const row of replacementRows) {
      const ids = replacementsById.get(row.destinationRowId) ?? new Set<number>();
      ids.add(row.fileId);
      replacementsById.set(row.destinationRowId, ids);
    }
    const files = sourceFacts(sources);
    const refreshedRecords = await this.refreshFullCopyStatuses({
      files,
      records,
      coverageById,
      drivesByVolume,
      firstPriority,
    });
    const summaries = refreshedRecords.map((record) =>
      toDestinationSummary(
        record,
        drivesByVolume.get(record.volumeId as DetectedDrive["volumeId"]),
        firstPriority,
      ),
    );
    const coverageDestinations: CoverageDestinationFacts[] = [];
    const planDestinations: PlanDestinationInput[] = [];
    refreshedRecords.forEach((record, index) => {
      const summary = summaries[index];
      if (summary === undefined) {
        return;
      }
      coverageDestinations.push({
        id: record.id,
        destinationId: record.destinationId,
        goal: record.goal,
        status: record.status,
        connection: summary.connection,
        verifiedFileIds: coverageById.get(record.id) ?? new Set(),
        lastVerifiedAt: summary.lastVerifiedAt,
      });
      planDestinations.push({
        summary,
        verifiedFileIds: coverageById.get(record.id) ?? new Set(),
        replacementFileIds: replacementsById.get(record.id) ?? new Set(),
        conflictFiles: record.conflictFiles,
        staleFiles: record.staleFiles,
        missingFiles: record.missingFiles,
      });
    });
    const coverage = computeCoverage(files, coverageDestinations);
    return {
      identity,
      sourceFiles: files,
      sources,
      records: refreshedRecords,
      coverage,
      planDestinations,
      overviewDestinations: summaries,
      hasFullCopy: summaries.some(
        (summary) =>
          summary.goal === "full_copy" &&
          summary.connection !== "retired" &&
          summary.connection !== "lost",
      ),
    };
  }

  private async refreshFullCopyStatuses(input: {
    files: SourceFileFacts[];
    records: ReplicationDestinationRecord[];
    coverageById: Map<number, Set<number>>;
    drivesByVolume: Map<string, DetectedDrive>;
    firstPriority: number | null;
  }): Promise<ReplicationDestinationRecord[]> {
    const now = new Date().toISOString();
    const updates: Promise<unknown>[] = [];
    const refreshed = input.records.map((record) => {
      if (record.goal !== "full_copy") {
        if (record.fullCopyStatus === "not_applicable") {
          return record;
        }
        updates.push(
          this.dependencies.db.request("replication.updateFullCopyStatus", {
            destinationId: record.id,
            status: "not_applicable",
            shortfallFiles: 0,
            shortfallBytes: 0,
            now,
          }),
        );
        return {
          ...record,
          fullCopyStatus: "not_applicable" as const,
          fullCopyShortfallFiles: 0,
          fullCopyShortfallBytes: 0,
        };
      }
      if (record.status !== "active") {
        return record;
      }
      const summary = toDestinationSummary(
        record,
        input.drivesByVolume.get(record.volumeId),
        input.firstPriority,
      );
      const evaluation = evaluateFullCopy({
        sourceFiles: input.files,
        verifiedFileIds: input.coverageById.get(record.id) ?? new Set<number>(),
        availableBytes: summary.availableBytes,
        staleFiles: record.staleFiles,
        missingFiles: record.missingFiles,
        conflictFiles: record.conflictFiles,
      });
      if (
        record.fullCopyStatus === evaluation.status &&
        record.fullCopyShortfallFiles === evaluation.shortfallFiles &&
        record.fullCopyShortfallBytes === evaluation.shortfallBytes
      ) {
        return record;
      }
      updates.push(
        this.dependencies.db.request("replication.updateFullCopyStatus", {
          destinationId: record.id,
          status: evaluation.status,
          shortfallFiles: evaluation.shortfallFiles,
          shortfallBytes: evaluation.shortfallBytes,
          now,
        }),
      );
      return {
        ...record,
        fullCopyStatus: evaluation.status,
        fullCopyShortfallFiles: evaluation.shortfallFiles,
        fullCopyShortfallBytes: evaluation.shortfallBytes,
      };
    });
    if (updates.length > 0) {
      await Promise.all(updates);
    }
    return refreshed;
  }
}
