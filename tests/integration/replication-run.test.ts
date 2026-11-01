import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

describe("replication run", () => {
  it("copies the partial plan, verifies it, and refreshes coverage", async () => {
    const harness = await createScanHarness();
    const destinationRoot = await mkdtemp(path.join(os.tmpdir(), "memory-lane-run-destination-"));
    destinationRoots.push(destinationRoot);
    await mkdir(path.join(harness.drive.rootPath, "photos", "2011"), { recursive: true });
    await writeFile(path.join(harness.drive.rootPath, "photos", "2011", "a.jpg"), "AAA");
    await writeFile(path.join(harness.drive.rootPath, "photos", "2011", "b.jpg"), "BBB");
    await writeFile(path.join(harness.drive.rootPath, "notes.txt"), "NOTES");
    await harness.scanService.startScan(harness.drive.volumeId);
    await waitForComplete(harness.scanService, harness.drive);

    const destinationDrive: DetectedDrive = {
      ...harness.drive,
      volumeId: toVolumeId("run-destination-volume"),
      serialNumber: "RUN-DEST-SERIAL",
      label: "Backup A",
      letter: "F:",
      rootPath: destinationRoot,
      driveType: "removable",
      isExternal: true,
    };
    const listDetected = async (): Promise<DetectedDrive[]> => [harness.drive, destinationDrive];
    const logger = testLogger();
    const destinationService = new DestinationService({ db: harness.db, listDetected, logger });
    const destination = await destinationService.register({
      volumeId: destinationDrive.volumeId,
      rootRelative: "",
      goal: "extend_coverage",
      layout: "dedicated",
      allocationMode: "all_safe",
      allocationPercent: null,
      allocationBytes: null,
      reserveBytes: 1024,
    });
    const planService = new PlanService({ db: harness.db, listDetected });
    const runService = new RunService({
      db: harness.db,
      listDetected,
      planService,
      workloads: new WorkloadCoordinator(),
      logger,
    });

    try {
      const started = await runService.start({ scope: "partial_only", replaceStale: false });
      expect(started.status).toBe("running");
      expect(started.plannedFiles).toBe(3);
      const complete = await waitForRun(runService, (state) => state?.status === "completed");
      expect(complete).toMatchObject({
        status: "completed",
        plannedFiles: 3,
        verifiedFiles: 3,
        failedFiles: 0,
        percent: 100,
      });

      const copyRoot = path.join(destinationRoot, "Memory Lane", "Development drive");
      await expect(access(path.join(copyRoot, "photos", "2011", "a.jpg"))).resolves.toBeUndefined();
      await expect(readFile(path.join(copyRoot, "photos", "2011", "a.jpg"), "utf8")).resolves.toBe(
        "AAA",
      );
      await expect(readFile(path.join(copyRoot, "notes.txt"), "utf8")).resolves.toBe("NOTES");
      await expect(readFile(path.join(harness.drive.rootPath, "notes.txt"), "utf8")).resolves.toBe(
        "NOTES",
      );

      const detail = await destinationService.get(destination.id);
      expect(detail.verifiedFiles).toBe(3);
      expect(detail.localLibraryFiles).toBe(3);
      const plan = await planService.getPlan();
      expect(plan.coverage.hasFullCopy).toBe(false);
      expect(plan.coverage.partialPercent).toBe(100);
      expect(plan.partial?.rows[0]?.newFiles).toBe(0);

      const events = await runService.getEvents(complete.id, null, 50);
      expect(events.events.map((event) => event.type)).toContain("started");
      expect(events.events.map((event) => event.type)).toContain("completed");

      await expect(
        runService.start({ scope: "partial_only", replaceStale: false }),
      ).rejects.toThrow(/no partial-coverage files/);
    } finally {
      await runService.shutdown();
      await harness.dispose();
    }
  });

  it("reports a destination conflict without overwriting the file", async () => {
    const harness = await createScanHarness();
    const destinationRoot = await mkdtemp(path.join(os.tmpdir(), "memory-lane-run-conflict-"));
    destinationRoots.push(destinationRoot);
    await mkdir(path.join(harness.drive.rootPath, "photos"), { recursive: true });
    await writeFile(path.join(harness.drive.rootPath, "photos", "a.jpg"), "SOURCE");
    await mkdir(path.join(destinationRoot, "Memory Lane", "Development drive", "photos"), {
      recursive: true,
    });
    await writeFile(
      path.join(destinationRoot, "Memory Lane", "Development drive", "photos", "a.jpg"),
      "DIFFERENT",
    );
    await harness.scanService.startScan(harness.drive.volumeId);
    await waitForComplete(harness.scanService, harness.drive);

    const destinationDrive: DetectedDrive = {
      ...harness.drive,
      volumeId: toVolumeId("conflict-destination-volume"),
      serialNumber: "CONFLICT-SERIAL",
      label: "Backup A",
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
      goal: "extend_coverage",
      layout: "dedicated",
      allocationMode: "all_safe",
      allocationPercent: null,
      allocationBytes: null,
      reserveBytes: 1024,
    });
    const runService = new RunService({
      db: harness.db,
      listDetected,
      planService: new PlanService({ db: harness.db, listDetected }),
      workloads: new WorkloadCoordinator(),
      logger,
    });
    try {
      await runService.start({ scope: "partial_only", replaceStale: false });
      const state = await waitForRun(runService, (candidate) => candidate?.status === "completed");
      expect(state.failedFiles).toBe(1);
      expect(state.errorMessage).toContain("CONFLICT_REVIEW_REQUIRED");
      await expect(
        readFile(
          path.join(destinationRoot, "Memory Lane", "Development drive", "photos", "a.jpg"),
          "utf8",
        ),
      ).resolves.toBe("DIFFERENT");
    } finally {
      await runService.shutdown();
      await harness.dispose();
    }
  });
});
