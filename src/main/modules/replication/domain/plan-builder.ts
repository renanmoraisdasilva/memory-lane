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
  type ReplicationExecutionPlan,
} from "./plan-types";
import { buildWarnings } from "./plan-warnings";
import { buildReplacements } from "./replacement-planner";
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

interface FullCopyResult {
  job: NonNullable<ReplicationPlan["fullCopy"]>;
  files: SourceFileFacts[];
}

function buildFullCopy(
  sourceFiles: SourceFileFacts[],
  destination: PlanDestinationInput | null,
): FullCopyResult | null {
  if (destination === null) {
    return null;
  }
  const newFiles = sourceFiles.filter((file) => !destination.verifiedFileIds.has(file.id));
  const newBytes = bytesOf(newFiles);
  let remaining = destination.summary.availableBytes;
  const assignedFiles: SourceFileFacts[] = [];
  for (const file of newFiles) {
    if (file.size > remaining) {
      continue;
    }
    remaining -= file.size;
    assignedFiles.push(file);
  }
  const assignedBytes = bytesOf(assignedFiles);
  const shortfallBytes = newBytes - assignedBytes;
  const shortfallFiles = newFiles.length - assignedFiles.length;
  const completeAfterRun = shortfallBytes === 0;
  return {
    job: {
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
        destination.summary.fullCopyStatus === "complete" &&
        destination.staleFiles + destination.missingFiles + destination.conflictFiles === 0 &&
        destination.summary.connection === "connected" &&
        destination.summary.identityConfidence === "confirmed",
    },
    files: assignedFiles,
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
  remaining: number[],
): AssignmentResult {
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
  replacementsByDestination: ReadonlyMap<number, SourceFileFacts[]>,
): {
  job: ReplicationPlan["partial"];
  assignedIds: Set<number>;
  remainder: SourceFileFacts[];
  rows: PartialRowDraft[];
  filesByDestination: Map<number, SourceFileFacts[]>;
} {
  const ordered = [...destinations].sort(byPriority);
  if (ordered.length === 0) {
    return {
      job: null,
      assignedIds: new Set(),
      remainder: candidates,
      rows: [],
      filesByDestination: new Map(),
    };
  }

  const rows: PartialRowDraft[] = ordered.map((destination) => {
    const replacementFiles = replacementsByDestination.get(destination.summary.id) ?? [];
    const replacementBytes = bytesOf(replacementFiles);
    return {
      destination: destination.summary,
      adoptedFiles: destination.verifiedFileIds.size,
      adoptedBytes: bytesOf(
        allSourceFiles.filter((file) => destination.verifiedFileIds.has(file.id)),
      ),
      newFiles: replacementFiles.length,
      newBytes: replacementBytes,
      newRangeStart: null,
      newRangeEnd: null,
      freeAfterBytes: Math.max(0, destination.summary.availableBytes - replacementBytes),
      offline: destination.summary.connection === "offline",
    };
  });
  const { assigned, remaining, remainder } = assignCandidates(
    candidates,
    ordered,
    rows.map((row) => row.freeAfterBytes),
  );

  const filesByDestination = new Map<number, SourceFileFacts[]>();
  for (const [index, row] of rows.entries()) {
    const replacementFiles = replacementsByDestination.get(row.destination.id) ?? [];
    const newFiles = assigned[index] ?? [];
    const copyFiles = [...replacementFiles, ...newFiles];
    if (copyFiles.length > 0) {
      filesByDestination.set(row.destination.id, copyFiles);
    }
    const capacity = remaining[index];
    if (capacity !== undefined) {
      row.freeAfterBytes = capacity;
    }
    row.newFiles += newFiles.length;
    row.newBytes += bytesOf(newFiles);
    const range = rangeFor(copyFiles);
    row.newRangeStart = range.start;
    row.newRangeEnd = range.end;
  }

  const assignedIds = new Set<number>([
    ...[...replacementsByDestination.values()].flat().map((file) => file.id),
    ...assigned.flat().map((file) => file.id),
  ]);
  return {
    job: {
      kind: "partial",
      rows: rows.map((row) => ({ ...row, destination: row.destination })),
    },
    assignedIds,
    remainder,
    rows,
    filesByDestination,
  };
}

function scopesFor(
  fullCopy: ReplicationPlan["fullCopy"],
  partial: ReplicationPlan["partial"],
): ReplicationRunScope[] {
  const fullWork = fullCopy !== null && fullCopy.newFiles > 0;
  const partialWork = partial !== null && partial.rows.some((row) => row.newFiles > 0);
  const scopes: ReplicationRunScope[] = [];
  if (fullWork || partialWork) {
    scopes.push("all_connected");
  }
  if (fullWork) {
    scopes.push("full_copy_only");
  }
  if (partialWork) {
    scopes.push("partial_only");
  }
  return scopes;
}

function assignedIdsByDestination(
  files: Map<number, SourceFileFacts[]>,
): Array<[number, number[]]> {
  return [...files.entries()]
    .sort(([left], [right]) => left - right)
    .map(([destinationId, assigned]) => [
      destinationId,
      assigned.map((file) => file.id).sort((left, right) => left - right),
    ]);
}

function planHash(
  input: PlanInput,
  partialFiles: Map<number, SourceFileFacts[]>,
  fullCopyFiles: SourceFileFacts[],
): string {
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
        [...destination.verifiedFileIds].sort((left, right) => left - right),
      ]),
    assignments: assignedIdsByDestination(partialFiles),
    fullCopy: fullCopyFiles.map((file) => file.id).sort((left, right) => left - right),
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

export function buildReplicationExecutionPlan(input: PlanInput): ReplicationExecutionPlan {
  const sourceFiles = sortSourceChronology(input.sourceFiles);
  const active = activeDestinations(input.destinations);
  const fullDestinations = active
    .filter((destination) => destination.summary.goal === "full_copy")
    .sort(byPriority);
  const partialDestinations = active.filter(
    (destination) => destination.summary.goal === "extend_coverage",
  );
  const fullCopyResult = buildFullCopy(sourceFiles, fullDestinations[0] ?? null);
  const fullCopy = fullCopyResult?.job ?? null;
  const replacements = buildReplacements(sourceFiles, partialDestinations);
  const candidates = sourceFiles.filter(
    (file) => !input.coverage.unionIds.has(file.id) && !replacements.assignedIds.has(file.id),
  );
  const partialResult = buildPartial(
    sourceFiles,
    candidates,
    partialDestinations,
    replacements.filesByDestination,
  );
  const remainder: PlanRemainder = {
    files: partialResult.remainder.length,
    bytes: bytesOf(partialResult.remainder),
    startDate: startDateFor(partialResult.remainder),
  };
  const warnings = buildWarnings(input, partialResult.remainder, replacements);
  const blocked = warnings.find((warning) => warning.severity === "blocking");
  const executionScopes = scopesFor(fullCopy, partialResult.job);

  return {
    plan: {
      sourceFiles: sourceFiles.length,
      sourceBytes: bytesOf(sourceFiles),
      undatedFiles: sourceFiles.filter((file) => file.resolvedDate === null).length,
      fullCopy,
      partial: partialResult.job,
      remainder,
      coverage: buildCoverage(sourceFiles, input.coverage, fullCopy, partialResult.assignedIds),
      warnings,
      executionScopes,
      planHash: planHash(input, partialResult.filesByDestination, fullCopyResult?.files ?? []),
      canStart: [
        blocked === undefined,
        sourceFiles.length > 0,
        active.length > 0,
        executionScopes.length > 0,
      ].every(Boolean),
      blockedReason: blocked?.message ?? null,
    },
    fullCopyFiles: fullCopyResult?.files ?? [],
    partialFiles: partialResult.filesByDestination,
  };
}

export function buildReplicationPlan(input: PlanInput): ReplicationPlan {
  return buildReplicationExecutionPlan(input).plan;
}
