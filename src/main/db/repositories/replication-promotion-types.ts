import type { PromotionStatus } from "@shared/contracts/replication/types";

export interface PromotionRecord {
  id: number;
  catalogId: string;
  fromVolumeId: string | null;
  toVolumeId: string | null;
  status: PromotionStatus;
  startedAt: string | null;
  completedAt: string | null;
  rolledBackAt: string | null;
  fromSourceRootRelative: string | null;
  toSourceRootRelative: string | null;
  sourceSnapshotPath: string | null;
  destinationSnapshotPath: string | null;
  verifiedFiles: number;
  verifiedBytes: number;
  shortfallFiles: number;
  shortfallBytes: number;
  errorMessage: string | null;
}

export interface InsertPromotionInput {
  catalogId: string;
  fromVolumeId: string | null;
  toVolumeId: string | null;
  status: PromotionStatus;
  startedAt: string;
  completedAt: string | null;
  rolledBackAt: string | null;
  fromSourceRootRelative: string;
  toSourceRootRelative: string;
  sourceSnapshotPath: string;
  destinationSnapshotPath: string;
  verifiedFiles: number;
  verifiedBytes: number;
  shortfallFiles: number;
  shortfallBytes: number;
  errorMessage: string | null;
}
