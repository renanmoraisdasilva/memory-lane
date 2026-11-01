import type {
  DestinationConnection,
  DestinationGoal,
  DestinationRecordStatus,
} from "@shared/contracts/replication/types";

export interface SourceFileFacts {
  id: number;
  sourceRelativePath: string;
  name: string;
  size: number;
  resolvedDate: string | null;
  mediaClass: string;
}

export interface CoverageDestinationFacts {
  id: number;
  destinationId: string;
  goal: DestinationGoal;
  status: DestinationRecordStatus;
  connection: DestinationConnection;
  verifiedFileIds: ReadonlySet<number>;
  lastVerifiedAt: string | null;
}

export interface ReplicaStatusCounts {
  conflictFiles: number;
  staleFiles: number;
  missingFiles: number;
}
