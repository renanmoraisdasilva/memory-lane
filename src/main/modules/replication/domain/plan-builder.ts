import type {
  DestinationSummary,
  PlanCoverage,
  PlanRemainder,
  ReplicationPlan,
  ReplicationRunScope,
} from "@shared/contracts/replication/types";
import { sortSourceChronology } from "./chronology";
import type { CoverageResult } from "./coverage";
import {
  activeDestinations,
  bytesOf,
  type PlanDestinationInput,
  type PlanInput,
} from "./plan-types";
import { buildWarnings } from "./plan-warnings";
import type { SourceFileFacts } from "./replication-types";

interface PartialRowDraft {
  destination: DestinationSummary;
  adoptedFiles: number;
  adoptedBytes: number;
  newFiles: number;
  newBytes: number;
  newRangeStart: string | null;
  newRangeEnd: string | null;
  freeAfterBytes: number;
  offline: boolean;
}

function percent(part: number, whole: number): number {
  return whole === 0 ? 100 : Math.round((part / whole) * 10000) / 100;
}

function byPriority(left: PlanDestinationInput, right: PlanDestinationInput): number {
  return left.summary.priority - right.summary.priority;
}

function rangeFor(files: SourceFileFacts[]): { start: string | null; end: string | null } {
  const dates = files
    .map((file) => file.resolvedDate)
    .filter((date): date is string => date !== null);
  return {
    start: dates.length === 0 ? null : (dates[0] ?? null),
    end: dates.length === 0 ? null : (dates[dates.length - 1] ?? null),
  };
}

function buildFullCopy(
  sourceFiles: SourceFileFacts[],
  destination: PlanDestinationInput | null,
): ReplicationPlan["fullCopy"] {
  if (destination === null) {
    return null;
  }
  const newFiles = sourceFiles.filter((file) => !destination.verifiedFileIds.has(file.id));
  const newBytes = bytesOf(newFiles);
  let remaining = destination.summary.availableBytes;
  let assignedBytes = 0;
  let assignedFiles = 0;
  for (const file of newFiles) {
    if (file.size > remaining) {
      continue;
    }
    remaining -= file.size;
    assignedBytes += file.size;
    assignedFiles += 1;
  }
  const shortfallBytes = newBytes - assignedBytes;
  const shortfallFiles = newFiles.length - assignedFiles;
  const completeAfterRun = shortfallBytes === 0;
  return {
    kind: "full_copy",
    destination: destination.summary,
    sourceFiles: sourceFiles.length,
    sourceBytes: bytesOf(sourceFiles),
    newFiles: newFiles.length,
    newBytes,
    shortfallFiles,
    shortfallBytes,
    freeAfterBytes: remaining,
    completeAfterRun,
    promotionReady:
      completeAfterRun &&
      destination.summary.connection === "connected" &&
      destination.summary.identityConfidence === "confirmed",
  };
}

interface AssignmentResult {
  assigned: SourceFileFacts[][];
  remaining: number[];
  remainder: SourceFileFacts[];
}

function assignCandidates(
  candidates: SourceFileFacts[],
  ordered: PlanDestinationInput[],
): AssignmentResult {
  const remaining = ordered.map((destination) => destination.summary.availableBytes);
  const assigned = ordered.map<SourceFileFacts[]>(() => []);
  const remainder: SourceFileFacts[] = [];
  let current = 0;
  for (const file of candidates) {
    let placed = false;
    while (current < ordered.length) {
      const capacity = remaining[current];
      const bucket = assigned[current];
      if (capacity === undefined || bucket === undefined) {
        current += 1;
        continue;
      }
      if (file.size > capacity) {
        current += 1;
        continue;
      }
      bucket.push(file);
      remaining[current] = capacity - file.size;
      placed = true;
      break;
    }
    if (!placed) {
      remainder.push(file);
    }
  }
  return { assigned, remaining, remainder };
}

function buildPartial(
  allSourceFiles: SourceFileFacts[],
  candidates: SourceFileFacts[],
  destinations: PlanDestinationInput[],
): {
  job: ReplicationPlan["partial"];
  assignedIds: Set<number>;
  remainder: SourceFileFacts[];
  rows: PartialRowDraft[];
} {
  const ordered = [...destinations].sort(byPriority);
  if (ordered.length === 0) {
    return { job: null, assignedIds: new Set(), remainder: candidates, rows: [] };
  }

  const rows: PartialRowDraft[] = ordered.map((destination) => ({
    destination: destination.summary,
    adoptedFiles: destination.verifiedFileIds.size,
    adoptedBytes: bytesOf(
      allSourceFiles.filter((file) => destination.verifiedFileIds.has(file.id)),
    ),
    newFiles: 0,
    newBytes: 0,
    newRangeStart: null,
    newRangeEnd: null,
    freeAfterBytes: destination.summary.availableBytes,
    offline: destination.summary.connection === "offline",
  }));
  const { assigned, remaining, remainder } = assignCandidates(candidates, ordered);

  for (const [index, files] of assigned.entries()) {
    const row = rows[index];
    const capacity = remaining[index];
    if (row === undefined || capacity === undefined) {
      continue;
    }
    row.newFiles = files.length;
    row.newBytes = bytesOf(files);
    row.freeAfterBytes = capacity;
    const range = rangeFor(files);
    row.newRangeStart = range.start;
    row.newRangeEnd = range.end;
  }

  const assignedIds = new Set(assigned.flat().map((file) => file.id));
  return {
    job: {
      kind: "partial",
      rows: rows.map((row) => ({ ...row, destination: row.destination })),
    },
    assignedIds,
    remainder,
    rows,
  };
}

function scopesFor(input: PlanInput): ReplicationRunScope[] {
  const active = activeDestinations(input.destinations);
  const hasFull = active.some((destination) => destination.summary.goal === "full_copy");
  const hasPartial = active.some((destination) => destination.summary.goal === "extend_coverage");
  const scopes: ReplicationRunScope[] = [];
  if (hasFull || hasPartial) {
    scopes.push("all_connected");
  }
  if (hasFull) {
    scopes.push("full_copy_only");
  }
  if (hasPartial) {
    scopes.push("partial_only");
  }
  return scopes;
}

function planHash(input: PlanInput): string {
  const canonical = JSON.stringify({
    source: [...input.sourceFiles]
      .sort((left, right) => left.id - right.id)
      .map((file) => [file.id, file.size, file.resolvedDate]),
    destinations: [...input.destinations]
      .sort((left, right) => left.summary.id - right.summary.id)
      .map((destination) => [
        destination.summary.id,
        destination.summary.destinationId,
        destination.summary.goal,
        destination.summary.priority,
        destination.summary.connection,
        destination.summary.availableBytes,
        [...destination.verifiedFileIds].sort((left, right) => left - right),
      ]),
  });
  return input.hash(canonical);
}

function buildCoverage(
  sourceFiles: SourceFileFacts[],
  coverage: CoverageResult,
  fullCopy: ReplicationPlan["fullCopy"],
  assignedIds: Set<number>,
): PlanCoverage {
  const projectedPartial = new Set([...coverage.partialIds, ...assignedIds]);
  const hasFullCopy = fullCopy !== null;
  const projectedFull = new Set<number>(coverage.fullCopyIds);
  if (fullCopy !== null) {
    const missing = fullCopy.shortfallFiles;
    const newlyCovered = fullCopy.newFiles - missing;
    let added = 0;
    for (const file of sourceFiles) {
      if (!coverage.fullCopyIds.has(file.id) && added < newlyCovered) {
        projectedFull.add(file.id);
        added += 1;
      }
    }
  }
  const union = new Set<number>([...projectedPartial, ...projectedFull]);
  return {
    fullCopyPercent: hasFullCopy ? percent(projectedFull.size, sourceFiles.length) : null,
    partialPercent: percent(projectedPartial.size, sourceFiles.length),
    allDestinationPercent: percent(union.size, sourceFiles.length),
    hasFullCopy,
  };
}

function startDateFor(files: SourceFileFacts[]): string | null {
  return files.find((file) => file.resolvedDate !== null)?.resolvedDate ?? null;
}

export function buildReplicationPlan(input: PlanInput): ReplicationPlan {
  const sourceFiles = sortSourceChronology(input.sourceFiles);
  const active = activeDestinations(input.destinations);
  const fullDestinations = active
    .filter((destination) => destination.summary.goal === "full_copy")
    .sort(byPriority);
  const partialDestinations = active.filter(
    (destination) => destination.summary.goal === "extend_coverage",
  );
  const fullCopy = buildFullCopy(sourceFiles, fullDestinations[0] ?? null);
  const candidates = sourceFiles.filter((file) => !input.coverage.unionIds.has(file.id));
  const partialResult = buildPartial(sourceFiles, candidates, partialDestinations);
  const remainder: PlanRemainder = {
    files: partialResult.remainder.length,
    bytes: bytesOf(partialResult.remainder),
    startDate: startDateFor(partialResult.remainder),
  };
  const warnings = buildWarnings(input, partialResult.remainder);
  const blocked = warnings.find((warning) => warning.severity === "blocking");
  const executionScopes = scopesFor(input);

  return {
    sourceFiles: sourceFiles.length,
    sourceBytes: bytesOf(sourceFiles),
    undatedFiles: sourceFiles.filter((file) => file.resolvedDate === null).length,
    fullCopy,
    partial: partialResult.job,
    remainder,
    coverage: buildCoverage(sourceFiles, input.coverage, fullCopy, partialResult.assignedIds),
    warnings,
    executionScopes,
    planHash: planHash(input),
    canStart:
      blocked === undefined &&
      sourceFiles.length > 0 &&
      active.length > 0 &&
      executionScopes.length > 0,
    blockedReason: blocked?.message ?? null,
  };
}
