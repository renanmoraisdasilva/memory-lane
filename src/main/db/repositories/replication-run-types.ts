import type {
  ReplicationRunScope,
  ReplicationRunStatus,
  RunEventType,
} from "@shared/contracts/replication/types";

export interface ReplicationRunRecord {
  id: number;
  status: ReplicationRunStatus;
  scope: ReplicationRunScope;
  goal: "extend_coverage" | "full_copy" | "both";
  planRevision: number;
  planHash: string | null;
  planUpdatedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  pausedAt: string | null;
  resumedAt: string | null;
  stopRequestedAt: string | null;
  lastHeartbeatAt: string | null;
  destinationSnapshot: string | null;
  plannedFiles: number;
  plannedBytes: number;
  copiedFiles: number;
  copiedBytes: number;
  verifiedFiles: number;
  verifiedBytes: number;
  failedFiles: number;
  failedBytes: number;
  staleFiles: number;
  staleBytes: number;
  remainderFiles: number;
  remainderBytes: number;
  errorMessage: string | null;
}

export interface RunEventRecord {
  id: number;
  runId: number;
  at: string;
  type: RunEventType;
  planRevision: number | null;
  note: string | null;
}

export interface CreateRunInput {
  scope: ReplicationRunScope;
  goal: "extend_coverage" | "full_copy" | "both";
  planRevision: number;
  planHash: string;
  destinationSnapshot: string;
  plannedFiles: number;
  plannedBytes: number;
  remainderFiles: number;
  remainderBytes: number;
  now: string;
}

export interface UpdateRunPlanInput {
  planRevision: number;
  planHash: string;
  destinationSnapshot: string;
  plannedFiles: number;
  plannedBytes: number;
  remainderFiles: number;
  remainderBytes: number;
  now: string;
}

export interface RunFileResultInput {
  runId: number;
  destinationRowId: number;
  fileId: number;
  relativePath: string;
  relativePathKey: string;
  sourceRelativePath: string;
  sourceRelativePathKey: string;
  sizeBytes: number;
  sha256: string | null;
  status: "verified" | "stale" | "conflict" | "failed" | "copied";
  sourceSizeAtVerify: number | null;
  sourceModifiedAtFsAtVerify: string | null;
  destinationSizeAtVerify: number | null;
  destinationModifiedAtFsAtVerify: string | null;
  lastCheckedAt: string;
  lastError: string | null;
}
