import type { RunError, RunOrderState } from "@shared/contracts/replication/types";
import type { WorkloadLease } from "../../workloads/application/workload-coordinator";

export interface RunControl {
  paused: boolean;
  stopping: boolean;
  cancelled: boolean;
  currentDestinationId: string | null;
  currentDestinationLabel: string | null;
  currentFile: string | null;
  processedFiles: number;
  processedBytes: number;
  startedMs: number;
  speedBytesPerSecond: number | null;
  etaSeconds: number | null;
  order: Map<string, RunOrderState>;
  errors: RunError[];
}

export interface ActiveRun {
  runId: number;
  control: RunControl;
  lease: WorkloadLease;
  loop: Promise<void>;
}
