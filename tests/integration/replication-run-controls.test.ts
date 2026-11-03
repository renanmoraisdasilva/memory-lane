import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { toVolumeId } from "@shared/contracts/drives";
import { afterEach, describe, expect, it } from "vitest";
import type { DetectedDrive } from "../../src/main/modules/drives/domain/drive";
import { DestinationService } from "../../src/main/modules/replication/application/destination-service";
import { PlanService } from "../../src/main/modules/replication/application/plan-service";
import { RunService } from "../../src/main/modules/replication/application/run-service";
import type { RunRunnerDependencies } from "../../src/main/modules/replication/application/run-runner-types";
import { WorkloadCoordinator } from "../../src/main/modules/workloads/application/workload-coordinator";
import { createScanHarness, testLogger, waitForComplete } from "./scan-harness";

const destinationRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    destinationRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

interface Harness {
  runService: RunService;
  setMode: (value: "wait" | "complete") => void;
  dispose: () => Promise<void>;
}

async function createRunHarness(): Promise<Harness> {
  const harness = await createScanHarness();
  const destinationRoot = await mkdtemp(path.join(os.tmpdir(), "memory-lane-run-controls-"));
  destinationRoots.push(destinationRoot);
  await mkdir(path.join(harness.drive.rootPath, "photos"), { recursive: true });
  await writeFile(path.join(harness.drive.rootPath, "photos", "a.jpg"), "AAA");
  await writeFile(path.join(harness.drive.rootPath, "photos", "b.jpg"), "BBB");
  await harness.scanService.startScan(harness.drive.volumeId);
  await waitForComplete(harness.scanService, harness.drive);

  const destinationDrive: DetectedDrive = {
    ...harness.drive,
    volumeId: toVolumeId("control-destination-volume"),
    serialNumber: "CONTROL-SERIAL",
    label: "Backup A",
    letter: "F:",
    rootPath: destinationRoot,
    driveType: "removable",
    isExternal: true,
  };
  const listDetected = async (): Promise<DetectedDrive[]> => [harness.drive, destinationDrive];
  const logger = testLogger();
  await new DestinationService({ db: harness.db, listDetected, logger }).register({
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
  let mode: "wait" | "complete" = "wait";
  const execute = async (dependencies: RunRunnerDependencies) => {
    for (;;) {
      if (dependencies.control.cancelled) return "interrupted" as const;
      if (dependencies.control.stopping) return "stopped" as const;
      if (dependencies.control.paused) return "paused" as const;
      if (mode === "complete") return "completed" as const;
      await dependencies.sleep(10);
    }
  };
  const runService = new RunService({
    db: harness.db,
    listDetected,
    planService,
    workloads: new WorkloadCoordinator(),
    logger,
    execute,
  });
  return {
    runService,
    setMode(value: "wait" | "complete") {
      mode = value;
    },
    async dispose() {
      mode = "complete";
      await runService.shutdown();
      await harness.dispose();
    },
  };
}

async function waitForStatus(
  service: RunService,
  status: string,
  timeoutMs = 5_000,
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const state = await service.getRunState();
    if (state?.status === status) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for ${status}`);
}

describe("backup run controls", () => {
  it("[ML-REPL-055] [ML-REPL-056] [ML-REPL-061] [ML-REPL-062] [ML-REPL-066] pauses, replans, resumes, and blocks source switching while active", async () => {
    const harness = await createRunHarness();
    try {
      const started = await harness.runService.start({
        scope: "partial_only",
        replaceStale: false,
      });
      expect(started.status).toBe("running");
      await expect(harness.runService.assertCanChangeSource()).rejects.toThrow();

      const paused = await harness.runService.pause();
      expect(paused.status).toBe("paused");
      expect(paused.capabilities.canResume).toBe(true);
      expect(paused.capabilities.canEditPlan).toBe(true);
      await expect(harness.runService.assertCanChangeSource()).rejects.toThrow();

      const replanned = await harness.runService.replanIfPaused();
      expect(replanned?.planRevision).toBe(2);
      const events = await harness.runService.getEvents(paused.id, null, 50);
      expect(events.events.map((event) => event.type)).toContain("plan_changed");

      harness.setMode("complete");
      const resumed = await harness.runService.resume();
      expect(resumed.status).toBe("running");
      await waitForStatus(harness.runService, "completed");
      await new Promise((resolve) => setTimeout(resolve, 20));
      await expect(harness.runService.assertCanChangeSource()).resolves.toBeUndefined();
    } finally {
      await harness.dispose();
    }
  });

  it("[ML-REPL-057] stops after the current work and records the event", async () => {
    const harness = await createRunHarness();
    try {
      await harness.runService.start({ scope: "partial_only", replaceStale: false });
      const stopping = await harness.runService.requestStop();
      expect(stopping.status).toBe("stopping");
      await waitForStatus(harness.runService, "stopped");
      const state = await harness.runService.getRunState();
      expect(state?.status).toBe("stopped");
      const events = await harness.runService.getEvents(state?.id ?? 0, null, 50);
      expect(events.events.map((event) => event.type)).toEqual(
        expect.arrayContaining(["stop_requested", "stopped"]),
      );
    } finally {
      await harness.dispose();
    }
  });

  it("[ML-REPL-058] marks an active run interrupted on shutdown", async () => {
    const harness = await createRunHarness();
    try {
      await harness.runService.start({ scope: "partial_only", replaceStale: false });
      await harness.runService.shutdown();
      const state = await harness.runService.getRunState();
      expect(state?.status).toBe("interrupted");
      expect(state?.capabilities.canResume).toBe(true);
    } finally {
      await harness.dispose();
    }
  });

  it("[ML-REPL-053] [ML-REPL-054] validates starts, returns the active run, and stops a paused run", async () => {
    const harness = await createRunHarness();
    try {
      expect(await harness.runService.replanIfPaused()).toBeNull();
      await expect(harness.runService.pause()).rejects.toThrow();
      await expect(harness.runService.resume()).rejects.toThrow();
      await expect(harness.runService.requestStop()).rejects.toThrow();
      await expect(
        harness.runService.start({ scope: "full_copy_only", replaceStale: false }),
      ).rejects.toThrow(/no full-copy destination/);
      await expect(
        harness.runService.start({
          scope: "partial_only",
          planHash: "wrong",
          replaceStale: false,
        }),
      ).rejects.toThrow(/plan changed/);

      const started = await harness.runService.start({
        scope: "partial_only",
        replaceStale: false,
      });
      const again = await harness.runService.start({
        scope: "partial_only",
        replaceStale: false,
      });
      expect(again.id).toBe(started.id);
      await harness.runService.onDestinationAdded();

      const paused = await harness.runService.pause();
      await harness.runService.onDestinationAdded();
      const replanned = await harness.runService.getRunState();
      expect(replanned?.planRevision).toBeGreaterThan(paused.planRevision);
      const stopped = await harness.runService.requestStop();
      expect(stopped.status).toBe("stopped");
      expect(await harness.runService.getRunSummary()).toBeNull();
    } finally {
      await harness.dispose();
    }
  });
});
