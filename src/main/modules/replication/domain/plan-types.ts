import type { DestinationSummary } from "@shared/contracts/replication/types";
import type { CoverageResult } from "./coverage";
import type { ReplicaStatusCounts, SourceFileFacts } from "./replication-types";

export interface PlanDestinationInput extends ReplicaStatusCounts {
  summary: DestinationSummary;
  verifiedFileIds: ReadonlySet<number>;
}

export interface PlanInput {
  sourceFiles: SourceFileFacts[];
  destinations: PlanDestinationInput[];
  coverage: CoverageResult;
  hash: (value: string) => string;
}

export function isActiveDestination(summary: DestinationSummary): boolean {
  return summary.connection !== "retired" && summary.connection !== "lost";
}

export function activeDestinations(destinations: PlanDestinationInput[]): PlanDestinationInput[] {
  return destinations.filter((destination) => isActiveDestination(destination.summary));
}

export function bytesOf(files: SourceFileFacts[]): number {
  return files.reduce((total, file) => total + file.size, 0);
}
