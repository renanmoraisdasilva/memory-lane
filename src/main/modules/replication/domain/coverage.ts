import type { CoverageSummary } from "@shared/contracts/replication/types";
import type { CoverageDestinationFacts, SourceFileFacts } from "./replication-types";

export interface CoverageResult {
  summary: CoverageSummary;
  partialIds: ReadonlySet<number>;
  fullCopyIds: ReadonlySet<number>;
  unionIds: ReadonlySet<number>;
  overlapIds: ReadonlySet<number>;
}

function bytesFor(sourceFiles: Map<number, SourceFileFacts>, ids: ReadonlySet<number>): number {
  let total = 0;
  for (const id of ids) {
    total += sourceFiles.get(id)?.size ?? 0;
  }
  return total;
}

function percent(part: number, whole: number): number {
  if (whole === 0) {
    return 100;
  }
  return Math.round((part / whole) * 10000) / 100;
}

function latestTimestamp(values: Array<string | null>): string | null {
  let latest: string | null = null;
  for (const value of values) {
    if (value !== null && (latest === null || value > latest)) {
      latest = value;
    }
  }
  return latest;
}

function activeDestinations(destinations: CoverageDestinationFacts[]): CoverageDestinationFacts[] {
  return destinations.filter((destination) => destination.status === "active");
}

export function computeCoverage(
  sourceFiles: SourceFileFacts[],
  destinations: CoverageDestinationFacts[],
): CoverageResult {
  const byId = new Map(sourceFiles.map((file) => [file.id, file]));
  const partialIds = new Set<number>();
  const fullCopyIds = new Set<number>();
  const coverCount = new Map<number, number>();
  const active = activeDestinations(destinations);

  for (const destination of active) {
    for (const fileId of destination.verifiedFileIds) {
      if (!byId.has(fileId)) {
        continue;
      }
      if (destination.goal === "full_copy") {
        fullCopyIds.add(fileId);
      } else {
        partialIds.add(fileId);
      }
      coverCount.set(fileId, (coverCount.get(fileId) ?? 0) + 1);
    }
  }

  const unionIds = new Set<number>([...partialIds, ...fullCopyIds]);
  const overlapIds = new Set(
    [...coverCount.entries()].filter(([, count]) => count >= 2).map(([fileId]) => fileId),
  );
  const unionBytes = bytesFor(byId, unionIds);
  const partialBytes = bytesFor(byId, partialIds);
  const fullCopyBytes = bytesFor(byId, fullCopyIds);
  const sourceBytes = sourceFiles.reduce((total, file) => total + file.size, 0);

  return {
    summary: {
      sourceFiles: sourceFiles.length,
      sourceBytes,
      partialFiles: partialIds.size,
      partialBytes,
      partialPercent: percent(partialIds.size, sourceFiles.length),
      partialRemainderFiles: sourceFiles.length - partialIds.size,
      partialRemainderBytes: sourceBytes - partialBytes,
      fullCopyFiles: fullCopyIds.size,
      fullCopyBytes,
      allDestinationFiles: unionIds.size,
      allDestinationBytes: unionBytes,
      allDestinationPercent: percent(unionIds.size, sourceFiles.length),
      overlapBytes: bytesFor(byId, overlapIds),
      coverageAsOf: latestTimestamp(active.map((destination) => destination.lastVerifiedAt)),
    },
    partialIds,
    fullCopyIds,
    unionIds,
    overlapIds,
  };
}
