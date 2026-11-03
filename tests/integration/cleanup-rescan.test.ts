import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CleanupService } from "../../src/main/modules/health/application/cleanup-service";
import { QuarantineMover } from "../../src/main/modules/health/infrastructure/quarantine-mover";
import { createFileHasher } from "../../src/main/modules/scanning/infrastructure/file-hasher";
import { WorkloadCoordinator } from "../../src/main/modules/workloads/application/workload-coordinator";
import { createScanHarness, testLogger, waitForComplete } from "./scan-harness";

async function waitForCleanup(service: CleanupService, timeoutMs = 10_000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const state = await service.getState();
    if (state.status === "complete" || state.status === "cancelled" || state.status === "failed") {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Timed out waiting for cleanup to finish");
}

async function waitForIdle(workloads: WorkloadCoordinator, timeoutMs = 10_000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (!workloads.isActive()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Timed out waiting for workloads to become idle");
}

describe("cleanup then rescan [ML-QUAR-013]", () => {
  it("[ML-QUAR-013] a rescan does not report a moved duplicate as missing", async () => {
    const workloads = new WorkloadCoordinator();
    const harness = await createScanHarness({ workloads });
    try {
      const keeperPath = path.join(harness.drive.rootPath, "keep", "photo.jpg");
      const candidatePath = path.join(harness.drive.rootPath, "phone", "photo.jpg");
      await mkdir(path.dirname(keeperPath), { recursive: true });
      await mkdir(path.dirname(candidatePath), { recursive: true });
      const content = Buffer.alloc(2048, 7);
      await writeFile(keeperPath, content);
      await writeFile(candidatePath, content);

      await harness.scanService.startScan(harness.drive.volumeId, "max");
      await waitForComplete(harness.scanService, harness.drive);

      const cleanup = new CleanupService({
        db: harness.db,
        hasher: createFileHasher(),
        logger: testLogger(),
        workloads,
        createMover: (hasher) => new QuarantineMover(hasher),
      });

      await cleanup.start();
      await waitForCleanup(cleanup);
      await waitForIdle(workloads);
      const finished = await cleanup.getState();
      expect(finished.errorMessage).toBeNull();
      expect(finished).toMatchObject({ status: "complete", filesMoved: 1 });

      const second = await harness.scanService.startScan(harness.drive.volumeId, "max");
      expect(second.mode).toBe("incremental");
      const complete = await waitForComplete(harness.scanService, harness.drive);
      expect(complete.report?.missingFiles).toBe(0);
    } finally {
      await harness.dispose();
    }
  });
});
