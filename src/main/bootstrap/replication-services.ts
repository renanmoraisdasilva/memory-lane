import type { DbClient } from "../clients/db-client";
import type { Logger } from "../logging/types";
import type { DetectedDrive } from "../modules/drives/domain/drive";
import { AdoptionService } from "../modules/replication/application/adoption-service";
import { DestinationService } from "../modules/replication/application/destination-service";
import { PlanService } from "../modules/replication/application/plan-service";
import { PromotionService } from "../modules/replication/application/promotion-service";
import { RunService } from "../modules/replication/application/run-service";
import { createDestinationReader } from "../modules/replication/infrastructure/destination-reader";
import { createFileHasher } from "../modules/scanning/infrastructure/file-hasher";
import type { WorkloadCoordinator } from "../modules/workloads/application/workload-coordinator";

export interface ReplicationServices {
  destinationService: DestinationService;
  adoptionService: AdoptionService;
  planService: PlanService;
  runService: RunService;
  promotionService: PromotionService;
}

export function createReplicationServices(input: {
  db: DbClient;
  listDetected: () => Promise<DetectedDrive[]>;
  workloads: WorkloadCoordinator;
  logger: Logger;
}): ReplicationServices {
  const planService = new PlanService({ db: input.db, listDetected: input.listDetected });
  return {
    destinationService: new DestinationService({
      db: input.db,
      listDetected: input.listDetected,
      logger: input.logger,
    }),
    adoptionService: new AdoptionService({
      db: input.db,
      listDetected: input.listDetected,
      reader: createDestinationReader(),
      hasher: createFileHasher(),
      workloads: input.workloads,
      logger: input.logger,
    }),
    planService,
    runService: new RunService({
      db: input.db,
      listDetected: input.listDetected,
      planService,
      workloads: input.workloads,
      logger: input.logger,
    }),
    promotionService: new PromotionService({
      db: input.db,
      listDetected: input.listDetected,
      planService,
      workloads: input.workloads,
      reader: createDestinationReader(),
      hasher: createFileHasher(),
      logger: input.logger,
    }),
  };
}
