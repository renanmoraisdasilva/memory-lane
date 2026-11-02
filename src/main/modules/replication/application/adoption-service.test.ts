import { describe, expect, it, vi } from "vitest";
import type { DbClient } from "../../../clients/db-client";
import type { DbMethod } from "../../../db/worker-protocol";
import type { ReplicationAdoptionRecord } from "../../../db/repositories/replication-adoption-types";
import { WorkloadCoordinator } from "../../workloads/application/workload-coordinator";
import { AdoptionService } from "./adoption-service";

const now = "2026-11-01T12:00:00.000Z";

function record(overrides: Partial<ReplicationAdoptionRecord>): ReplicationAdoptionRecord {
  return {
    destinationRowId: 1,
    destinationKey: "dest-1",
    status: "scanning",
    startedAt: now,
    finishedAt: null,
    lastSavedAt: now,
    scannedFiles: 10,
    matchedFiles: 8,
    verifiedFiles: 8,
    conflictFiles: 0,
    staleFiles: 0,
    ambiguousFiles: 2,
    extraFiles: 0,
    unreadableFiles: 0,
    errorMessage: null,
    ...overrides,
  };
}

function serviceWith(records: ReplicationAdoptionRecord[]): AdoptionService {
  const db: DbClient = {
    request<T>(method: DbMethod): Promise<T> {
      if (method === "replication.listAdoptions") {
        return Promise.resolve(records as T);
      }
      throw new Error(`Unexpected database method ${method}`);
    },
  };
  return new AdoptionService({
    db,
    listDetected: async () => [],
    reader: { scan: async () => ({ files: [], skipped: [] }) },
    hasher: { hash: async () => "a".repeat(64) },
    workloads: new WorkloadCoordinator(() => new Date(now)),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    now: () => new Date(now),
  });
}

describe("AdoptionService", () => {
  it("lists only adoptions that are running or need attention", async () => {
    const service = serviceWith([
      record({ destinationRowId: 1, destinationKey: "dest-scan", status: "scanning" }),
      record({ destinationRowId: 2, destinationKey: "dest-complete", status: "complete" }),
      record({ destinationRowId: 3, destinationKey: "dest-paused", status: "paused" }),
      record({ destinationRowId: 4, destinationKey: "dest-idle", status: "idle" }),
      record({ destinationRowId: 5, destinationKey: "dest-failed", status: "failed" }),
      record({ destinationRowId: 6, destinationKey: "dest-interrupted", status: "interrupted" }),
    ]);

    await expect(service.listActive()).resolves.toEqual([
      expect.objectContaining({
        destinationId: "dest-scan",
        status: "scanning",
        scannedFiles: 10,
      }),
      expect.objectContaining({
        destinationId: "dest-paused",
        status: "paused",
        canResume: true,
      }),
      expect.objectContaining({
        destinationId: "dest-interrupted",
        status: "interrupted",
        canResume: true,
      }),
    ]);
  });

  it("returns an empty list when no adoption needs attention", async () => {
    const service = serviceWith([
      record({ destinationKey: "dest-1", status: "complete" }),
      record({ destinationKey: "dest-2", status: "idle" }),
    ]);
    await expect(service.listActive()).resolves.toEqual([]);
  });
});
