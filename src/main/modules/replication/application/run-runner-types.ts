import type { DbClient } from "../../../clients/db-client";
import type { Logger } from "../../../logging/types";
import type { DetectedDrive } from "../../drives/domain/drive";
import type { ExecutionDestination } from "./plan-service";
import type { RunControl } from "./run-control";
export type RunOutcome = "completed" | "paused" | "stopped" | "interrupted" | "failed";

export interface RunRunnerDependencies {
  db: DbClient;
  listDetected: () => Promise<DetectedDrive[]>;
  logger: Logger;
  now: () => Date;
  sleep: (milliseconds: number) => Promise<void>;
  control: RunControl;
}

export interface RunRunnerInput {
  runId: number;
  fullCopy: ExecutionDestination | null;
  partial: ExecutionDestination[];
  replaceStale: boolean;
}
