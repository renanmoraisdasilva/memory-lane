import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { toVolumeId } from "@shared/contracts/drives";
import type { AdoptionState } from "@shared/contracts/replication/types";
import { afterEach, describe, expect, it } from "vitest";
import type { DetectedDrive } from "../../src/main/modules/drives/domain/drive";
import { createDestinationReader } from "../../src/main/modules/replication/infrastructure/destination-reader";
import { createFileHasher } from "../../src/main/modules/scanning/infrastructure/file-hasher";
import { AdoptionService } from "../../src/main/modules/replication/application/adoption-service";
import { DestinationService } from "../../src/main/modules/replication/application/destination-service";
import { PlanService } from "../../src/main/modules/replication/application/plan-service";
import { WorkloadCoordinator } from "../../src/main/modules/workloads/application/workload-coordinator";
import { createScanHarness, testLogger, waitForComplete } from "./scan-harness";

const destinationRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    destinationRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function waitForAdoption(
  service: AdoptionService,
  destinationId: string,
  timeoutMs = 15_000,
): Promise<AdoptionState> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const state = await service.getState(destinationId);
    if (state.status === "complete" || state.status === "failed") {
      return state;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Timed out waiting for adoption to complete");
}

describe("replication adoption", () => {
  it("[ML-REPL-016] adopts reorganized destination files, records extras, and writes the source index", async () => {
    const harness = await createScanHarness();
    const destinationRoot = await mkdtemp(
      path.join(os.tmpdir(), "memory-lane-adoption-destination-"),
    );
    destinationRoots.push(destinationRoot);
    await mkdir(path.join(destinationRoot, "manual"), { recursive: true });
    await mkdir(path.join(destinationRoot, "photos", "2011"), { recursive: true });
    await mkdir(path.join(harness.drive.rootPath, "photos", "2011"), { recursive: true });
    await writeFile(path.join(harness.drive.rootPath, "photos", "2011", "a.jpg"), "AAA");
    await writeFile(path.join(harness.drive.rootPath, "photos", "2011", "b.jpg"), "BBB");
    await writeFile(path.join(harness.drive.rootPath, "notes.txt"), "NOTES");
    await harness.scanService.startScan(harness.drive.volumeId);
    await waitForComplete(harness.scanService, harness.drive);

    await writeFile(path.join(destinationRoot, "manual", "renamed-a.jpg"), "AAA");
    await writeFile(path.join(destinationRoot, "photos", "2011", "b.jpg"), "BBB");
    await writeFile(path.join(destinationRoot, "extra.bin"), "EXTRA");

    const destinationDrive: DetectedDrive = {
      ...harness.drive,
      volumeId: toVolumeId("destination-volume"),
      serialNumber: "DEST-SERIAL",
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
    const adoption = new AdoptionService({
      db: harness.db,
      listDetected,
      reader: createDestinationReader(),
      hasher: createFileHasher(),
      workloads: new WorkloadCoordinator(),
      logger,
    });

    try {
      await adoption.start(destination.destinationId);
      const state = await waitForAdoption(adoption, destination.destinationId);
      expect(state.status).toBe("complete");
      expect(state.verifiedFiles).toBe(2);
      expect(state.extraFiles).toBe(1);
      expect(state.matchedFiles).toBe(2);

      const detail = await destinationService.get(destination.id);
      expect(detail.adoption?.status).toBe("complete");
      expect(detail.localLibraryFiles).toBe(3);
      expect(detail.conflictFiles).toBe(0);
      expect(detail.coverageMap.length).toBeGreaterThan(0);

      const plan = await new PlanService({ db: harness.db, listDetected }).getPlan();
      expect(plan.sourceFiles).toBe(3);
      expect(plan.partial?.rows[0]).toMatchObject({
        adoptedFiles: 2,
        adoptedBytes: 6,
        newFiles: 1,
        newBytes: 5,
      });

      const identity = await harness.db.request<{ catalogId: string }>(
        "replication.getSourceIdentity",
        {},
      );
      await expect(
        access(
          path.join(destinationRoot, ".memorylane", "replicas", identity.catalogId, "index.db"),
        ),
      ).resolves.toBeUndefined();
      await expect(
        access(path.join(destinationRoot, ".memorylane", "replicas", `${identity.catalogId}.json`)),
      ).resolves.toBeUndefined();
      const marker = JSON.parse(
        await readFile(
          path.join(destinationRoot, ".memorylane", "replicas", `${identity.catalogId}.json`),
          "utf8",
        ),
      ) as { sourceIndexRelative: string | null };
      expect(marker.sourceIndexRelative).not.toBeNull();

      await adoption.start(destination.destinationId);
      const second = await waitForAdoption(adoption, destination.destinationId);
      expect(second.status).toBe("complete");
      expect(second.verifiedFiles).toBe(2);
    } finally {
      await adoption.shutdown();
      await harness.dispose();
    }
  });
});
