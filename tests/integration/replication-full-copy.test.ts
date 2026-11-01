import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { toVolumeId } from "@shared/contracts/drives";
import type { ReplicationRunState } from "@shared/contracts/replication/types";
import { afterEach, describe, expect, it } from "vitest";
import type { DetectedDrive } from "../../src/main/modules/drives/domain/drive";
import { DestinationService } from "../../src/main/modules/replication/application/destination-service";
import { PlanService } from "../../src/main/modules/replication/application/plan-service";
import { RunService } from "../../src/main/modules/replication/application/run-service";
import { WorkloadCoordinator } from "../../src/main/modules/workloads/application/workload-coordinator";
import { createScanHarness, testLogger, waitForComplete } from "./scan-harness";

const destinationRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    destinationRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
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

interface FullCopyHarness {
  runService: RunService;
  planService: PlanService;
  destinationService: DestinationService;
  destinationRoot: string;
  dispose: () => Promise<void>;
}

async function createFullCopyHarness(allocationBytes: number | null): Promise<FullCopyHarness> {
  const harness = await createScanHarness();
  const destinationRoot = await mkdtemp(path.join(os.tmpdir(), "memory-lane-full-copy-"));
  destinationRoots.push(destinationRoot);
  await mkdir(path.join(harness.drive.rootPath, "photos"), { recursive: true });
  await writeFile(path.join(harness.drive.rootPath, "photos", "a.jpg"), "AAA");
  await writeFile(path.join(harness.drive.rootPath, "notes.txt"), "NOTES");
  await harness.scanService.startScan(harness.drive.volumeId);
  await waitForComplete(harness.scanService, harness.drive);

  const destinationDrive: DetectedDrive = {
    ...harness.drive,
    volumeId: toVolumeId(`full-copy-${String(allocationBytes)}`),
    serialNumber: `FULL-${String(allocationBytes)}`,
    label: "Full Backup",
    letter: "F:",
    rootPath: destinationRoot,
    driveType: "removable",
    isExternal: true,
  };
  const listDetected = async (): Promise<DetectedDrive[]> => [harness.drive, destinationDrive];
  const logger = testLogger();
  const destinationService = new DestinationService({ db: harness.db, listDetected, logger });
  await destinationService.register({
    volumeId: destinationDrive.volumeId,
    rootRelative: "",
    goal: "full_copy",
    layout: "dedicated",
    allocationMode: allocationBytes === null ? "all_safe" : "fixed",
    allocationPercent: null,
    allocationBytes,
    reserveBytes: 0,
  });
  const planService = new PlanService({ db: harness.db, listDetected });
  const runService = new RunService({
    db: harness.db,
    listDetected,
    planService,
    workloads: new WorkloadCoordinator(),
    logger,
  });
  return {
    runService,
    planService,
    destinationService,
    destinationRoot,
    async dispose() {
      await runService.shutdown();
      await harness.dispose();
    },
  };
}

describe("replication full copy", () => {
  it("copies every present source file and marks the copy complete", async () => {
    const harness = await createFullCopyHarness(null);
    try {
      const plan = await harness.planService.getPlan();
      expect(plan.executionScopes).toEqual(["all_connected", "full_copy_only"]);
      expect(plan.fullCopy?.newFiles).toBe(2);

      const started = await harness.runService.start({
        scope: "full_copy_only",
        replaceStale: false,
      });
      expect(started.scope).toBe("full_copy_only");
      expect(started.plannedFiles).toBe(2);
      expect(started.order[0]?.kind).toBe("full_copy");

      const complete = await waitForRun(
        harness.runService,
        (state) => state?.status === "completed",
      );
      expect(complete.verifiedFiles).toBe(2);
      expect(complete.failedFiles).toBe(0);

      const copyRoot = path.join(harness.destinationRoot, "Memory Lane", "Development drive");
      await expect(readFile(path.join(copyRoot, "photos", "a.jpg"), "utf8")).resolves.toBe("AAA");
      await expect(readFile(path.join(copyRoot, "notes.txt"), "utf8")).resolves.toBe("NOTES");

      const destinationRecord = (await harness.destinationService.list())[0];
      expect(destinationRecord).toMatchObject({
        goal: "full_copy",
        fullCopyStatus: "complete",
        fullCopyShortfallFiles: 0,
        verifiedFiles: 2,
      });

      const refreshed = await harness.planService.getPlan();
      expect(refreshed.fullCopy?.newFiles).toBe(0);
      expect(refreshed.executionScopes).toEqual([]);
      await expect(
        harness.runService.start({ scope: "full_copy_only", replaceStale: false }),
      ).rejects.toThrow(/already complete/);
    } finally {
      await harness.dispose();
    }
  });

  it("reports a shortfall and never spills a full copy into partial destinations", async () => {
    const harness = await createFullCopyHarness(4);
    try {
      const plan = await harness.planService.getPlan();
      expect(plan.fullCopy).toMatchObject({
        newFiles: 2,
        shortfallFiles: 1,
        completeAfterRun: false,
      });
      await expect(
        harness.runService.start({ scope: "full_copy_only", replaceStale: false }),
      ).rejects.toThrow(/enough safe space/);
      expect(await harness.runService.getRunState()).toBeNull();

      const destinationRecord = (await harness.destinationService.list())[0];
      expect(destinationRecord?.fullCopyStatus).toBe("incomplete");
      expect(destinationRecord?.fullCopyShortfallFiles).toBe(1);
      expect((await harness.planService.getCoverage()).partialPercent).toBe(0);
    } finally {
      await harness.dispose();
    }
  });
});
