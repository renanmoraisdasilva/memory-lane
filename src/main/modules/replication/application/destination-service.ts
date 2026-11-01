import path from "node:path";
import { randomUUID } from "node:crypto";
import type { DetectedDrive } from "../../drives/domain/drive";
import type { DbClient } from "../../../clients/db-client";
import type { Logger } from "../../../logging/types";
import type { ArchiveIdentity } from "../../../db/repositories/archive-identity-repository";
import type { ReplicationDestinationRecord } from "../../../db/repositories/replication-destination-repository";
import type {
  AdoptionState,
  CoverageMapCell,
  DestinationCandidate,
  DestinationDetail,
  DestinationSummary,
  RegisterDestinationParams,
  UpdateDestinationParams,
} from "@shared/contracts/replication/types";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import {
  assertDifferentVolume,
  assertNoRootOverlap,
  resolveRelativePath,
} from "../../../platform/destination-path-policy";
import { createDestinationWriter } from "../infrastructure/destination-writer";
import {
  readAnyMarker,
  writeMarker,
  type DestinationMarker,
} from "../infrastructure/destination-marker";
import {
  firstPartialPriority,
  toDestinationDetail,
  toDestinationSummary,
} from "./destination-summary";

export interface DestinationServiceDependencies {
  db: DbClient;
  listDetected: () => Promise<DetectedDrive[]>;
  logger: Logger;
  now?: () => Date;
}

function sanitizeFolderName(value: string, fallback: string): string {
  const cleaned = value
    .replaceAll(/[<>:"/\\|?*]/g, "-")
    .replaceAll(/[\u0000-\u001f]/g, "")
    .trim()
    .replaceAll(/\.+$/g, "")
    .replaceAll(/\s+$/g, "");
  return cleaned.length > 0 ? cleaned.slice(0, 80) : fallback;
}

function chooseDrive(
  drives: DetectedDrive[],
  volumeId: DestinationSummary["volumeId"],
): DetectedDrive {
  const drive = drives.find((candidate) => candidate.volumeId === volumeId);
  if (drive === undefined) {
    throw new AppError(APP_ERROR_CODES.DRIVE_NOT_FOUND, "The destination drive is not connected");
  }
  if (!drive.isExternal || drive.driveType === "unknown") {
    throw new AppError(APP_ERROR_CODES.DRIVE_UNSUPPORTED, "Select an external destination drive");
  }
  return drive;
}

function resolveDestinationRoot(
  drive: DetectedDrive,
  source: ArchiveIdentity,
  rootRelative: string,
  context: { catalogPath: string },
): string {
  const destinationRoot = rootRelative.trim().length
    ? resolveRelativePath(drive.rootPath, rootRelative)
    : path.resolve(drive.rootPath);
  const sourceRoot = path.resolve(
    path.dirname(path.dirname(context.catalogPath)),
    source.sourceRootRelative,
  );
  assertNoRootOverlap(sourceRoot, destinationRoot);
  return destinationRoot;
}

function markerFor(input: {
  source: ArchiveIdentity;
  destinationId: string;
  rootRelative: string;
  record: ReplicationDestinationRecord;
  now: string;
}): DestinationMarker {
  return {
    schemaVersion: 1,
    catalogId: input.source.catalogId,
    destinationId: input.destinationId,
    sourceLabel: input.source.label,
    sourceVolumeId: input.source.activeSourceVolumeId ?? input.source.catalogId,
    rootRelative: input.rootRelative,
    copyRootRelative: input.record.copyRootRelative,
    replicaGoal: input.record.goal,
    replicaLayout: input.record.layout,
    localCatalogId: input.record.localCatalogId,
    localCatalogRelative: input.record.localCatalogRelative,
    sourceIndexRelative: input.record.sourceIndexRelative,
    updatedAt: input.now,
  };
}

export class DestinationService {
  private readonly nowDate: () => Date;

  constructor(private readonly dependencies: DestinationServiceDependencies) {
    this.nowDate = dependencies.now ?? (() => new Date());
  }

  async listCandidates(): Promise<DestinationCandidate[]> {
    const [drives, source] = await Promise.all([
      this.dependencies.listDetected(),
      this.sourceIdentity(),
    ]);
    return Promise.all(
      drives.map(async (drive) => {
        const marker = await readAnyMarker(drive.rootPath);
        const isActiveSource = drive.volumeId === source.activeSourceVolumeId;
        const blockedReason = isActiveSource
          ? "This drive is the active source archive."
          : marker !== null && marker.catalogId !== source.catalogId
            ? "This drive belongs to another source archive."
            : null;
        return {
          volumeId: drive.volumeId,
          label: drive.label,
          letter: drive.letter,
          rootPath: drive.rootPath,
          fileSystem: drive.fileSystem,
          totalBytes: drive.totalBytes,
          freeBytes: drive.freeBytes,
          hasMarker: marker !== null,
          markerCatalogId: marker?.catalogId ?? null,
          isActiveSource,
          blockedReason,
        };
      }),
    );
  }

  async list(): Promise<DestinationSummary[]> {
    const [records, drives] = await Promise.all([this.records(), this.dependencies.listDetected()]);
    const drivesByVolume = new Map(drives.map((drive) => [drive.volumeId, drive]));
    const firstPriority = firstPartialPriority(records);
    return records.map((record) =>
      toDestinationSummary(
        record,
        drivesByVolume.get(record.volumeId as DetectedDrive["volumeId"]),
        firstPriority,
      ),
    );
  }

  async getByDestinationId(destinationId: string): Promise<DestinationDetail> {
    const record = await this.findExistingByKey(destinationId);
    if (record === null) {
      throw new AppError(APP_ERROR_CODES.DESTINATION_NOT_FOUND, "Destination was not found");
    }
    return this.get(record.id);
  }

  async get(destinationId: number): Promise<DestinationDetail> {
    const [record, records, drives] = await Promise.all([
      this.dependencies.db.request<ReplicationDestinationRecord>("replication.getDestination", {
        destinationId,
      }),
      this.records(),
      this.dependencies.listDetected(),
    ]);
    const drive = drives.find((candidate) => candidate.volumeId === record.volumeId);
    const detail = toDestinationDetail(record, drive, firstPartialPriority(records));
    const [adoption, coverageMap, health, overlapBytes] = await Promise.all([
      this.dependencies.db.request<AdoptionState>("replication.getAdoption", {
        destinationId: record.destinationId,
      }),
      this.dependencies.db.request<CoverageMapCell[]>("replication.getDestinationCoverageMap", {
        destinationId: record.id,
      }),
      this.dependencies.db.request<{
        conflictFiles: number;
        staleFiles: number;
        missingFiles: number;
      }>("replication.getDestinationReplicaHealth", { destinationId: record.id }),
      this.dependencies.db.request<number>("replication.getDestinationOverlapBytes", {
        destinationId: record.id,
      }),
    ]);
    let localLibrary = { files: 0, bytes: 0 };
    if (drive !== undefined) {
      const root = record.rootRelative.trim().length
        ? resolveRelativePath(drive.rootPath, record.rootRelative)
        : path.resolve(drive.rootPath);
      try {
        localLibrary = await this.dependencies.db.request<{
          files: number;
          bytes: number;
        }>("replication.getDestinationLibraryStats", {
          destinationId: record.id,
          destinationRoot: root,
        });
      } catch (error) {
        this.dependencies.logger.warn("Destination local library is unavailable", {
          destinationId: record.destinationId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return {
      ...detail,
      adoption,
      coverageMap,
      conflictFiles: health.conflictFiles,
      staleFiles: health.staleFiles,
      missingFiles: health.missingFiles,
      overlapBytes,
      localLibraryFiles: localLibrary.files,
      localLibraryBytes: localLibrary.bytes,
      promotionReady:
        record.fullCopyStatus === "complete" &&
        record.status === "active" &&
        detail.connection === "connected" &&
        record.identityConfidence === "confirmed",
    };
  }

  async register(params: RegisterDestinationParams): Promise<DestinationDetail> {
    const [drives, source] = await Promise.all([
      this.dependencies.listDetected(),
      this.sourceIdentity(),
    ]);
    const drive = chooseDrive(drives, params.volumeId);
    assertDifferentVolume(source.activeSourceVolumeId ?? "", drive.volumeId);

    const existing = await this.findExisting(drive.volumeId);
    if (existing !== null) {
      return this.get(existing.id);
    }

    const context = await this.dependencies.db.request<{ catalogPath: string }>(
      "library.getContext",
      {},
    );
    const destinationRoot = resolveDestinationRoot(drive, source, params.rootRelative, context);
    const marker = await readAnyMarker(drive.rootPath);
    if (marker !== null && marker.catalogId !== source.catalogId) {
      throw new AppError(
        APP_ERROR_CODES.FORBIDDEN,
        "This drive belongs to another source archive",
        { markerCatalogId: marker.catalogId },
      );
    }
    const markerExisting =
      marker === null ? null : await this.findExistingByKey(marker.destinationId);
    if (markerExisting !== null) {
      return this.get(markerExisting.id);
    }

    const record = await this.persistRegistration({
      params,
      drive,
      source,
      destinationRoot,
      destinationId: marker?.destinationId ?? randomUUID(),
    });
    return this.get(record.id);
  }

  async update(params: UpdateDestinationParams): Promise<DestinationDetail> {
    const record = await this.findExistingByKey(params.destinationId);
    if (record === null) {
      throw new AppError(APP_ERROR_CODES.DESTINATION_NOT_FOUND, "Destination was not found");
    }
    const update: Record<string, unknown> = { destinationId: record.id };
    if (params.goal !== undefined) update.goal = params.goal;
    if (params.allocationMode !== undefined) update.allocationMode = params.allocationMode;
    if (params.allocationPercent !== undefined) update.allocationPercent = params.allocationPercent;
    if (params.allocationBytes !== undefined) update.allocationBytes = params.allocationBytes;
    if (params.reserveBytes !== undefined) update.reserveBytes = params.reserveBytes;
    if (params.priority !== undefined) update.priority = params.priority;
    if (params.layout !== undefined) update.layout = params.layout;
    if (params.status !== undefined) update.status = params.status;
    await this.dependencies.db.request("replication.updateDestination", update);
    return this.get(record.id);
  }

  private async persistRegistration(input: {
    params: RegisterDestinationParams;
    drive: DetectedDrive;
    source: ArchiveIdentity;
    destinationRoot: string;
    destinationId: string;
  }): Promise<ReplicationDestinationRecord> {
    const now = this.nowDate().toISOString();
    const record = await this.dependencies.db.request<ReplicationDestinationRecord>(
      "replication.registerDestination",
      {
        destinationId: input.destinationId,
        volumeId: input.drive.volumeId,
        volumeSerial: input.drive.serialNumber,
        label: input.drive.label,
        fileSystem: input.drive.fileSystem,
        letter: input.drive.letter,
        mountRootPath: input.drive.rootPath,
        rootRelative: input.params.rootRelative,
        destinationCatalogPath: path.join(input.destinationRoot, ".memorylane", "catalog.db"),
        archiveFolderName: sanitizeFolderName(
          input.source.label,
          input.source.catalogId.slice(0, 8),
        ),
        goal: input.params.goal,
        layout: input.params.layout,
        allocationMode: input.params.allocationMode,
        allocationPercent: input.params.allocationPercent ?? null,
        allocationBytes: input.params.allocationBytes ?? null,
        reserveBytes: input.params.reserveBytes,
        now,
      },
    );

    await writeMarker(
      createDestinationWriter(input.destinationRoot),
      markerFor({
        source: input.source,
        destinationId: input.destinationId,
        rootRelative: input.params.rootRelative,
        record,
        now,
      }),
    );
    this.dependencies.logger.info("Registered replication destination", {
      destinationId: input.destinationId,
      volumeId: input.drive.volumeId,
      rootRelative: input.params.rootRelative,
    });
    return record;
  }

  private async findExisting(volumeId: string): Promise<ReplicationDestinationRecord | null> {
    return this.dependencies.db.request<ReplicationDestinationRecord | null>(
      "replication.findDestinationByVolume",
      { volumeId },
    );
  }

  private async findExistingByKey(
    destinationId: string,
  ): Promise<ReplicationDestinationRecord | null> {
    return this.dependencies.db.request<ReplicationDestinationRecord | null>(
      "replication.findDestinationByDestinationId",
      { destinationId },
    );
  }

  private async records(): Promise<ReplicationDestinationRecord[]> {
    return this.dependencies.db.request<ReplicationDestinationRecord[]>(
      "replication.listDestinations",
      {},
    );
  }

  private async sourceIdentity(): Promise<ArchiveIdentity> {
    return this.dependencies.db.request<ArchiveIdentity>("replication.getSourceIdentity", {});
  }
}
