import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { toVolumeId } from "@shared/contracts/drives";
import type { ReplicationRunState } from "@shared/contracts/replication/types";
import { afterEach, describe, expect, it } from "vitest";
import type { DetectedDrive } from "../../src/main/modules/drives/domain/drive";
import { DestinationService } from "../../src/main/modules/replication/application/destination-service";
import { PlanService } from "../../src/main/modules/replication/application/plan-service";
import { PromotionService } from "../../src/main/modules/replication/application/promotion-service";
import { RunService } from "../../src/main/modules/replication/application/run-service";
import { createDestinationReader } from "../../src/main/modules/replication/infrastructure/destination-reader";
import { createFileHasher } from "../../src/main/modules/scanning/infrastructure/file-hasher";
import { WorkloadCoordinator } from "../../src/main/modules/workloads/application/workload-coordinator";
import { createScanHarness, testLogger, waitForComplete } from "./scan-harness";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function waitForRun(
  service: RunService,
  predicate: (state: ReplicationRunState | null) => boolean,
  timeoutMs = 20_000,
): Promise<ReplicationRunState> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const state = await service.getRunState();
    if (state !== null && predicate(state)) {
      return state;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Timed out waiting for the backup run");
}

describe("promotion service", () => {
  it("verifies, promotes with keep/retire fates, and rolls back through the service", async () => {
    const harness = await createScanHarness();
    const partialRoot = await mkdtemp(path.join(os.tmpdir(), "memory-lane-promote-partial-"));
    const fullRoot = await mkdtemp(path.join(os.tmpdir(), "memory-lane-promote-full-"));
    roots.push(partialRoot, fullRoot);
    await mkdir(path.join(harness.drive.rootPath, "photos"), { recursive: true });
    await writeFile(path.join(harness.drive.rootPath, "photos", "a.jpg"), "AAA");
    await writeFile(path.join(harness.drive.rootPath, "notes.txt"), "NOTES");
    await harness.scanService.startScan(harness.drive.volumeId);
    await waitForComplete(harness.scanService, harness.drive);

    const partialDrive: DetectedDrive = {
      ...harness.drive,
      volumeId: toVolumeId("promotion-partial-volume"),
      serialNumber: "PARTIAL-SERIAL",
      label: "Backup B",
      letter: "G:",
      rootPath: partialRoot,
      driveType: "removable",
      isExternal: true,
    };
    const fullDrive: DetectedDrive = {
      ...harness.drive,
      volumeId: toVolumeId("promotion-full-volume"),
      serialNumber: "FULL-SERIAL",
      label: "Backup A",
      letter: "F:",
      rootPath: fullRoot,
      driveType: "removable",
      isExternal: true,
    };
    const listDetected = async (): Promise<DetectedDrive[]> => [
      harness.drive,
      partialDrive,
      fullDrive,
    ];
    const logger = testLogger();
    const destinationService = new DestinationService({ db: harness.db, listDetected, logger });
    const partial = await destinationService.register({
      volumeId: partialDrive.volumeId,
      rootRelative: "",
      goal: "extend_coverage",
      layout: "dedicated",
      allocationMode: "all_safe",
      allocationPercent: null,
      allocationBytes: null,
      reserveBytes: 0,
    });
    const full = await destinationService.register({
      volumeId: fullDrive.volumeId,
      rootRelative: "",
      goal: "full_copy",
      layout: "dedicated",
      allocationMode: "all_safe",
      allocationPercent: null,
      allocationBytes: null,
      reserveBytes: 0,
    });
    const planService = new PlanService({ db: harness.db, listDetected });
    const workloads = new WorkloadCoordinator();
    const runService = new RunService({
      db: harness.db,
      listDetected,
      planService,
      workloads,
      logger,
    });
    const promotionService = new PromotionService({
      db: harness.db,
      listDetected,
      planService,
      workloads,
      reader: createDestinationReader(),
      hasher: createFileHasher(),
      logger,
    });
    try {
      await runService.start({ scope: "partial_only", replaceStale: false });
      await waitForRun(runService, (state) => state?.status === "completed");
      while (workloads.current() !== null) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      await runService.start({ scope: "full_copy_only", replaceStale: false });
      await waitForRun(runService, (state) => state?.status === "completed");
      while (workloads.current() !== null) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const state = await promotionService.getState(full.destinationId);
      expect(state.blockedReason).toBeNull();
      expect(state.canPromote).toBe(true);
      expect(state.partialDestinations).toEqual([
        expect.objectContaining({ destinationId: partial.destinationId, label: "Backup B" }),
      ]);

      const verified = await promotionService.verify(full.destinationId, true);
      expect(verified).toMatchObject({ status: "verified", verified: true, canPromote: true });

      const applied = await promotionService.apply({
        destinationId: full.destinationId,
        deepVerify: false,
        oldSourceFate: "retire",
        partialFates: [{ destinationId: partial.destinationId, keep: false }],
        confirm: true,
      });
      expect(applied.status).toBe("completed");
      expect(applied.canRollback).toBe(true);
      expect(typeof applied.promotionId).toBe("number");
      expect(applied.newCatalog?.volumeId).toBe(fullDrive.volumeId);

      await harness.handler.handle("catalog.open", {
        catalogPath: path.join(fullRoot, ".memorylane", "catalog.db"),
        identity: {
          volumeId: fullDrive.volumeId,
          serialNumber: fullDrive.serialNumber,
          label: fullDrive.label,
          fileSystem: fullDrive.fileSystem,
          rootPath: fullRoot,
          letter: "F:",
        },
      });
      const destinations = await harness.db.request<
        Array<{ destinationId: string; status: string; goal: string }>
      >("replication.listDestinations", {});
      expect(destinations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            destinationId: partial.destinationId,
            status: "retired",
            goal: "extend_coverage",
          }),
          expect.objectContaining({ label: harness.drive.label, status: "retired" }),
        ]),
      );

      const rolled = await promotionService.rollback(applied.promotionId ?? 0, full.destinationId);
      expect(rolled.status).toBe("rolled_back");
      const restored = await harness.db.request<{ role: string }>(
        "replication.getSourceIdentity",
        {},
      );
      expect(restored.role).toBe("source");
    } finally {
      await runService.shutdown();
      await harness.dispose();
    }
  });
});
