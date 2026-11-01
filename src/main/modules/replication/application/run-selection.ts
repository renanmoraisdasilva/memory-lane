import type { ReplicationRunScope, RunOrderEntry } from "@shared/contracts/replication/types";
import type { ExecutionDestination, ReplicationExecution } from "./plan-service";
import type { RunControl } from "./run-control";

export interface SelectedRunWork {
  fullCopy: ExecutionDestination | null;
  partial: ExecutionDestination[];
  files: number;
  bytes: number;
  goal: "extend_coverage" | "full_copy" | "both";
}

function filesOf(destination: ExecutionDestination): number {
  return destination.files.length;
}

function bytesOf(destination: ExecutionDestination): number {
  return destination.files.reduce((total, file) => total + file.size, 0);
}

export function selectRunWork(
  execution: ReplicationExecution,
  scope: ReplicationRunScope,
): SelectedRunWork {
  const includeFull = scope !== "partial_only";
  const includePartial = scope !== "full_copy_only";
  const fullCopy =
    includeFull && execution.fullCopy !== null && filesOf(execution.fullCopy) > 0
      ? execution.fullCopy
      : null;
  const partial = includePartial
    ? execution.partial.filter((assignment) => filesOf(assignment) > 0)
    : [];
  const fullFiles = fullCopy === null ? 0 : filesOf(fullCopy);
  const fullBytes = fullCopy === null ? 0 : bytesOf(fullCopy);
  const partialFiles = partial.reduce((total, assignment) => total + filesOf(assignment), 0);
  const partialBytes = partial.reduce((total, assignment) => total + bytesOf(assignment), 0);
  const hasFull = fullCopy !== null;
  const hasPartial = partial.length > 0;
  return {
    fullCopy,
    partial,
    files: fullFiles + partialFiles,
    bytes: fullBytes + partialBytes,
    goal: hasFull && hasPartial ? "both" : hasFull ? "full_copy" : "extend_coverage",
  };
}

export interface ExecutionSnapshot {
  json: string;
  files: number;
  bytes: number;
  entries: RunOrderEntry[];
}

function entryFor(assignment: ExecutionDestination, kind: RunOrderEntry["kind"]): RunOrderEntry {
  return {
    destinationId: assignment.destination.destinationId,
    label: assignment.destination.label,
    kind,
    priority: assignment.destination.priority,
    state: "pending",
    plannedFiles: assignment.files.length,
    plannedBytes: bytesOf(assignment),
  };
}

export function snapshotFor(selection: SelectedRunWork): ExecutionSnapshot {
  const entries: RunOrderEntry[] = [];
  if (selection.fullCopy !== null) {
    entries.push(entryFor(selection.fullCopy, "full_copy"));
  }
  for (const assignment of selection.partial) {
    entries.push(entryFor(assignment, "partial"));
  }
  return {
    json: JSON.stringify(entries),
    files: entries.reduce((total, entry) => total + entry.plannedFiles, 0),
    bytes: entries.reduce((total, entry) => total + entry.plannedBytes, 0),
    entries,
  };
}

export function controlFor(entries: RunOrderEntry[], now: Date): RunControl {
  const control: RunControl = {
    paused: false,
    stopping: false,
    cancelled: false,
    currentDestinationId: null,
    currentDestinationLabel: null,
    currentFile: null,
    processedFiles: 0,
    processedBytes: 0,
    startedMs: now.getTime(),
    speedBytesPerSecond: null,
    etaSeconds: null,
    order: new Map(),
    errors: [],
  };
  for (const entry of entries) {
    control.order.set(entry.destinationId, "pending");
  }
  return control;
}
