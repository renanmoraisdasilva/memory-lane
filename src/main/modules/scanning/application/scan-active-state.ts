import type { VolumeId } from "@shared/contracts/drives";
import type { ScanState } from "@shared/contracts/scan";
import type { WorkloadLease } from "../../workloads/application/workload-coordinator";
import type { PauseGate } from "./pause-gate";

export class ScanStoppedError extends Error {
  constructor() {
    super("Scan stopped");
    this.name = "ScanStoppedError";
  }
}

export interface ActiveScan {
  volumeId: VolumeId;
  rootPath: string;
  cachePath: string;
  state: ScanState;
  paused: boolean;
  stopping: boolean;
  gate: PauseGate | null;
  loop: Promise<void> | null;
  workloadLease: WorkloadLease | null;
}

export function isResumableScan(status: ScanState["status"]): boolean {
  return status === "paused" || status === "interrupted" || status === "error";
}
