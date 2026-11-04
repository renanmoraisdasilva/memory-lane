import path from "node:path";
import type { DetectedDrive } from "../../drives/domain/drive";
import type { ReplicationDestinationRecord } from "../../../db/repositories/replication-destination-repository";
import type {
  AttentionCounts,
  DestinationConnection,
  DestinationDetail,
  DestinationSummary,
} from "@shared/contracts/replication/types";

function numberOr(...values: Array<number | null | undefined>): number {
  for (const value of values) {
    if (value !== null && value !== undefined) {
      return value;
    }
  }
  return 0;
}

function connectionFor(
  record: ReplicationDestinationRecord,
  drive: DetectedDrive | undefined,
): DestinationConnection {
  if (record.status === "retired") return "retired";
  if (record.status === "lost") return "lost";
  return drive === undefined ? "offline" : "connected";
}

function attentionFor(record: ReplicationDestinationRecord): AttentionCounts {
  return {
    onlyOnDriveFiles: record.onlyOnDriveFiles,
    onlyOnDriveBytes: record.onlyOnDriveBytes,
    sourceMissingFiles: record.sourceMissingFiles,
    sourceMissingBytes: record.sourceMissingBytes,
  };
}

function isFirstInFillOrder(
  record: ReplicationDestinationRecord,
  firstPartialPriority: number | null,
): boolean {
  return (
    record.status === "active" &&
    record.goal === "extend_coverage" &&
    firstPartialPriority !== null &&
    record.priority === firstPartialPriority
  );
}

function allocationLimit(
  record: ReplicationDestinationRecord,
  totalBytes: number,
  freeBytes: number,
): number {
  if (record.allocationMode === "fixed") {
    return record.allocationBytes ?? 0;
  }
  if (record.allocationMode === "percent") {
    return Math.floor((totalBytes * (record.allocationPercent ?? 0)) / 100);
  }
  return record.verifiedBytes + Math.max(0, freeBytes - record.reserveBytes);
}

function availableBytes(
  record: ReplicationDestinationRecord,
  drive: DetectedDrive | undefined,
): number {
  const total = numberOr(drive?.totalBytes, record.lastCapacityBytes);
  const free = numberOr(drive?.freeBytes, record.lastFreeBytes);
  const limit = allocationLimit(record, total, free);
  return Math.max(0, Math.min(limit - record.verifiedBytes, free - record.reserveBytes));
}

function driveFacts(
  record: ReplicationDestinationRecord,
  drive: DetectedDrive | undefined,
): {
  totalBytes: number;
  freeBytes: number;
  mount: string | null;
  letter: string | null;
  fileSystem: string;
  connection: DestinationConnection;
} {
  return {
    totalBytes: numberOr(drive?.totalBytes, record.lastCapacityBytes),
    freeBytes: numberOr(drive?.freeBytes, record.lastFreeBytes),
    mount: drive === undefined ? null : path.resolve(drive.rootPath, record.rootRelative),
    letter: drive?.letter ?? null,
    fileSystem: drive?.fileSystem ?? "unknown",
    connection: connectionFor(record, drive),
  };
}

export function toDestinationSummary(
  record: ReplicationDestinationRecord,
  drive: DetectedDrive | undefined,
  firstPartialPriority: number | null,
): DestinationSummary {
  const facts = driveFacts(record, drive);
  return {
    id: record.id,
    destinationId: record.destinationId,
    volumeId: record.volumeId as DestinationSummary["volumeId"],
    label: record.label,
    letter: facts.letter,
    mount: facts.mount,
    fileSystem: facts.fileSystem,
    goal: record.goal,
    connection: facts.connection,
    identityConfidence: record.identityConfidence,
    totalBytes: facts.totalBytes,
    freeBytes: facts.freeBytes,
    reserveBytes: record.reserveBytes,
    verifiedBytes: record.verifiedBytes,
    verifiedFiles: record.verifiedFiles,
    unverifiedFiles:
      record.conflictFiles + record.staleFiles + record.missingFiles + record.failedFiles,
    availableBytes: availableBytes(record, drive),
    lastSeenAt: record.lastSeenAt,
    lastVerifiedAt: record.lastVerifiedAt,
    priority: record.priority,
    fullCopyStatus: record.fullCopyStatus,
    fullCopyShortfallBytes: record.fullCopyShortfallBytes,
    fullCopyShortfallFiles: record.fullCopyShortfallFiles,
    attention: attentionFor(record),
    isFirstInFillOrder: isFirstInFillOrder(record, firstPartialPriority),
  };
}

export function toDestinationDetail(
  record: ReplicationDestinationRecord,
  drive: DetectedDrive | undefined,
  firstPartialPriority: number | null,
): DestinationDetail {
  return {
    ...toDestinationSummary(record, drive, firstPartialPriority),
    rootRelative: record.rootRelative,
    adoptionRootRelative: record.rootRelative,
    copyRootRelative: record.copyRootRelative,
    layout: record.layout,
    allocationMode: record.allocationMode,
    allocationPercent: record.allocationPercent,
    allocationBytes: record.allocationBytes,
    localCatalogRelative: record.localCatalogRelative,
    localCatalogId: record.localCatalogId,
    localLibraryFiles: 0,
    localLibraryBytes: 0,
    cacheReady: false,
    sourceIndexRelative: record.sourceIndexRelative,
    sourceIndexUpdatedAt: record.sourceIndexUpdatedAt,
    coverageMap: [],
    overlapBytes: 0,
    conflictFiles: 0,
    staleFiles: 0,
    missingFiles: 0,
    promotionReady:
      record.goal === "full_copy" &&
      record.status === "active" &&
      record.fullCopyStatus === "complete" &&
      record.staleFiles + record.missingFiles + record.conflictFiles === 0 &&
      drive !== undefined &&
      record.identityConfidence === "confirmed",
    adoption: null,
  };
}

export function firstPartialPriority(records: ReplicationDestinationRecord[]): number | null {
  return (
    records
      .filter((record) => record.status === "active" && record.goal === "extend_coverage")
      .sort((left, right) => left.priority - right.priority)[0]?.priority ?? null
  );
}
