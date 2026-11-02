import type { DbClient } from "../clients/db-client";
import type { Logger } from "../logging/types";
import type { ShellActions } from "../modules/library/application/library-service";
import type { FileHasher, FileMetadataExtractor } from "../modules/scanning/domain/scan-files";
import type { WorkloadCoordinator } from "../modules/workloads/application/workload-coordinator";
import { CleanupService } from "../modules/health/application/cleanup-service";
import { HealthService } from "../modules/health/application/health-service";

export interface HealthServicesInput {
  db: DbClient;
  hasher: FileHasher;
  metadata: FileMetadataExtractor;
  logger: Logger;
  shellActions: ShellActions;
  workloads: WorkloadCoordinator;
}

export interface HealthServices {
  health: HealthService;
  cleanup: CleanupService;
}

export function createHealthServices(input: HealthServicesInput): HealthServices {
  return {
    health: new HealthService({
      db: input.db,
      hasher: input.hasher,
      metadata: input.metadata,
      logger: input.logger,
      workloads: input.workloads,
    }),
    cleanup: new CleanupService({
      db: input.db,
      hasher: input.hasher,
      logger: input.logger,
      shellActions: input.shellActions,
      workloads: input.workloads,
    }),
  };
}
