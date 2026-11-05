import type { PlanDestinationInput } from "./plan-types";
import type { SourceFileFacts } from "./replication-types";

export interface ReplacementResult {
  filesByDestination: Map<number, SourceFileFacts[]>;
  assignedIds: Set<number>;
  plannedFiles: number;
  skippedFiles: number;
}

export function buildReplacements(
  sourceFiles: SourceFileFacts[],
  destinations: PlanDestinationInput[],
): ReplacementResult {
  const filesByDestination = new Map<number, SourceFileFacts[]>();
  const assignedIds = new Set<number>();
  let plannedFiles = 0;
  let skippedFiles = 0;
  for (const destination of destinations) {
    if (destination.summary.connection !== "connected") {
      continue;
    }
    let remaining = destination.summary.availableBytes;
    const files: SourceFileFacts[] = [];
    for (const file of sourceFiles) {
      if (!destination.replacementFileIds.has(file.id)) {
        continue;
      }
      if (file.size > remaining) {
        skippedFiles += 1;
        continue;
      }
      files.push(file);
      assignedIds.add(file.id);
      remaining -= file.size;
      plannedFiles += 1;
    }
    if (files.length > 0) {
      filesByDestination.set(destination.summary.id, files);
    }
  }
  return { filesByDestination, assignedIds, plannedFiles, skippedFiles };
}
