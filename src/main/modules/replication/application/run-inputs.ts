import { z } from "zod";
import type { RunOrderEntry } from "@shared/contracts/replication/types";
import { RunOrderEntrySchema } from "@shared/contracts/replication/types";
import type { ReplicationExecution } from "./plan-service";
import type { RunControl } from "./run-control";

export interface ExecutionSnapshot {
  json: string;
  files: number;
  bytes: number;
  entries: RunOrderEntry[];
}

export function snapshotFor(execution: ReplicationExecution): ExecutionSnapshot {
  const entries: RunOrderEntry[] = execution.partial.map((assignment) => ({
    destinationId: assignment.destination.destinationId,
    label: assignment.destination.label,
    priority: assignment.destination.priority,
    state: "pending",
    plannedFiles: assignment.files.length,
    plannedBytes: assignment.files.reduce((total, file) => total + file.size, 0),
  }));
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

export function parseOrderSnapshot(value: string | null): RunOrderEntry[] {
  if (value === null) {
    return [];
  }
  try {
    const parsed = z.array(RunOrderEntrySchema).safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}
