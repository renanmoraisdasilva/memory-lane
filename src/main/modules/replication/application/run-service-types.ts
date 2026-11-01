import type { DbClient } from "../../../clients/db-client";
import type { Logger } from "../../../logging/types";
import type { DetectedDrive } from "../../drives/domain/drive";
import type { WorkloadCoordinator } from "../../workloads/application/workload-coordinator";
import type { PlanService } from "./plan-service";
import type { runPartialBackfill } from "./run-runner";

export interface RunServiceDependencies {
  db: DbClient;
  listDetected: () => Promise<DetectedDrive[]>;
  planService: PlanService;
  workloads: WorkloadCoordinator;
  logger: Logger;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
  execute?: typeof runPartialBackfill;
}

export function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
