import { describe, expect, it } from "vitest";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { DbClient } from "../../../clients/db-client";
import type { Logger } from "../../../logging/types";
import { WorkloadCoordinator } from "../../workloads/application/workload-coordinator";
import type { PlanService } from "./plan-service";
import { RunService } from "./run-service";

const logger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
};

function serviceWith(db: DbClient, workloads = new WorkloadCoordinator()): RunService {
  return new RunService({
    db,
    listDetected: async () => [],
    planService: {} as PlanService,
    workloads,
    logger,
  });
}

describe("run source-switch guard", () => {
  it("allows setup before any source catalog is open", async () => {
    const db = {
      request: async () => {
        throw new AppError(APP_ERROR_CODES.CATALOG_NOT_FOUND, "Open a catalog before using it");
      },
    } as unknown as DbClient;
    await expect(serviceWith(db).assertCanChangeSource()).resolves.toBeUndefined();
  });

  it("blocks a source switch while adoption is running", async () => {
    const workloads = new WorkloadCoordinator();
    const lease = workloads.acquire("replication", "adoption:dest-1");
    const db = { request: async () => null } as unknown as DbClient;
    try {
      await expect(serviceWith(db, workloads).assertCanChangeSource()).rejects.toThrow(
        /Finish or pause the backup/,
      );
    } finally {
      lease.release();
    }
  });
});
