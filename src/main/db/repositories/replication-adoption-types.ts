import type { AdoptionStatus } from "@shared/contracts/replication/types";

export interface ReplicationAdoptionRecord {
  destinationRowId: number;
  destinationKey: string;
  status: AdoptionStatus;
  startedAt: string | null;
  finishedAt: string | null;
  lastSavedAt: string | null;
  scannedFiles: number;
  matchedFiles: number;
  verifiedFiles: number;
  conflictFiles: number;
  staleFiles: number;
  ambiguousFiles: number;
  extraFiles: number;
  unreadableFiles: number;
  errorMessage: string | null;
}

export interface AdoptionReplicaRow {
  fileId: number;
  relativePath: string;
  relativePathKey: string;
  sourceRelativePath: string;
  sizeBytes: number;
  sha256: string | null;
  status: "discovered" | "copied" | "verified" | "stale" | "missing" | "conflict" | "failed";
  destinationSizeAtVerify: number | null;
  destinationModifiedAtFsAtVerify: string | null;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
}

export interface AdoptionReplicaWrite {
  fileId: number;
  relativePath: string;
  relativePathKey: string;
  sourceRelativePath: string;
  sourceRelativePathKey: string;
  sizeBytes: number;
  sha256: string | null;
  status: "discovered" | "copied" | "verified" | "stale" | "missing" | "conflict" | "failed";
  sourceSizeAtVerify: number | null;
  sourceModifiedAtFsAtVerify: string | null;
  destinationSizeAtVerify: number | null;
  destinationModifiedAtFsAtVerify: string | null;
  lastCheckedAt: string;
  lastError: string | null;
}

export interface AdoptionOrphanWrite {
  relativePath: string;
  relativePathKey: string;
  sizeBytes: number;
  sha256: string | null;
  modifiedAtFs: string | null;
  classification: "extra" | "previously_in_source" | "ambiguous" | "unreadable";
  matchedSourceCount: number;
  lastCheckedAt: string;
  lastError: string | null;
}

export interface AdoptionBatchInput {
  replicas: AdoptionReplicaWrite[];
  orphans: AdoptionOrphanWrite[];
  touchedReplicaFileIds: number[];
  now: string;
}

export interface AdoptionStatusChangeInput {
  destinationRowId: number;
  status: AdoptionStatus;
  now: string;
  errorMessage: string | null;
}

export interface MarkUnseenInput {
  destinationRowId: number;
  seenFileIds: number[];
  seenOrphanPathKeys: string[];
  now: string;
}
