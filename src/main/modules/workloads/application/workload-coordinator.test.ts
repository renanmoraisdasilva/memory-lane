import { describe, expect, it } from "vitest";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { WorkloadCoordinator } from "./workload-coordinator";

const now = new Date("2026-11-01T12:00:00.000Z");

describe("workload coordinator", () => {
  it("[ML-HEALTH-023] [ML-REPL-067] grants one heavy workload at a time", () => {
    const coordinator = new WorkloadCoordinator(() => now);
    const scan = coordinator.acquire("scan", "scan-1");
    expect(coordinator.current()).toMatchObject({
      kind: "scan",
      ownerId: "scan-1",
      startedAt: now.toISOString(),
    });

    expect(() => coordinator.acquire("replication", "run-1")).toThrow(AppError);
    try {
      coordinator.acquire("validation", "validation-1");
    } catch (error) {
      expect((error as AppError).code).toBe(APP_ERROR_CODES.WORKLOAD_CONFLICT);
    }

    scan.release();
    expect(coordinator.current()).toBeNull();
    expect(() => coordinator.acquire("replication", "run-1")).not.toThrow();
  });

  it("releases leases idempotently and ignores stale releases", () => {
    const coordinator = new WorkloadCoordinator(() => now);
    const first = coordinator.acquire("scan", "scan-1");
    first.release();
    first.release();
    const second = coordinator.acquire("replication", "run-1");
    first.release();
    expect(coordinator.current()?.ownerId).toBe("run-1");
    second.release();
    expect(coordinator.current()).toBeNull();
  });

  it("reports active kinds and can assert without acquiring", () => {
    const coordinator = new WorkloadCoordinator(() => now);
    expect(coordinator.isActive()).toBe(false);
    expect(() => coordinator.assertCanStart("scan", "scan-1")).not.toThrow();

    const lease = coordinator.acquire("validation", "validation-1");
    expect(coordinator.isActive("validation")).toBe(true);
    expect(coordinator.isActive("scan")).toBe(false);
    expect(() => coordinator.assertCanStart("scan", "scan-1")).toThrow(AppError);
    lease.release();
    expect(coordinator.isActive()).toBe(false);
  });
});
