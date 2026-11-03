import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { toVolumeId } from "@shared/contracts/drives";
import type { ReplicationRunState } from "@shared/contracts/replication/types";
import { afterEach, describe, expect, it } from "vitest";
import type { DetectedDrive } from "../../src/main/modules/drives/domain/drive";
import { DestinationService } from "../../src/main/modules/replication/application/destination-service";
import { PlanService } from "../../src/main/modules/replication/application/plan-service";
import { RunService } from "../../src/main/modules/replication/application/run-service";
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

describe("replication promotion", () => {
  it("[ML-REPL-083] [ML-REPL-085] [ML-REPL-086] [ML-REPL-087] [ML-REPL-088] merges the source into a complete full copy and rolls back before the first change", async () => {
    const harness = await createScanHarness();
    const destinationRoot = await mkdtemp(path.join(os.tmpdir(), "memory-lane-promotion-"));
    roots.push(destinationRoot);
    await mkdir(path.join(harness.drive.rootPath, "photos"), { recursive: true });
    await writeFile(path.join(harness.drive.rootPath, "photos", "a.jpg"), "DUPLICATE");
    await writeFile(path.join(harness.drive.rootPath, "photos", "b.jpg"), "DUPLICATE");
    await writeFile(path.join(harness.drive.rootPath, "notes.txt"), "NOTES");
    await harness.scanService.startScan(harness.drive.volumeId);
    await waitForComplete(harness.scanService, harness.drive);

    const sourceFiles = await harness.db.request<
      Array<{ id: number; name: string; sourceRelativePath: string }>
    >("replication.listSourceFiles", {});
    const aFile = sourceFiles.find((file) => file.name === "a.jpg");
    expect(aFile).toBeDefined();
    await harness.db.request("library.setDate", {
      fileIds: [aFile?.id],
      year: 1999,
      month: 7,
    });

    const destinationDrive: DetectedDrive = {
      ...harness.drive,
      volumeId: toVolumeId("promotion-destination-volume"),
      serialNumber: "PROMOTION-SERIAL",
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
      goal: "full_copy",
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
      await runService.start({ scope: "full_copy_only", replaceStale: false });
      await waitForRun(runService, (state) => state?.status === "completed");

      await expect(
        harness.handler.handle("promotion.apply", {
          destinationId: "missing",
          destinationRootPath: destinationRoot,
          destinationVolumeId: destinationDrive.volumeId,
          destinationVolumeSerial: destinationDrive.serialNumber,
          destinationLabel: destinationDrive.label,
          destinationFileSystem: destinationDrive.fileSystem,
          oldSourceFate: "full_copy",
          partialFates: [],
          oldSourceFits: true,
          now: new Date().toISOString(),
        }),
      ).rejects.toThrow(/not found/);
      expect(() =>
        harness.handler.handle("promotion.listReplicaFiles", { destinationId: "missing" }),
      ).toThrow(/not found/);
      expect(() =>
        harness.handler.handle("promotion.record", {
          destinationId: "missing",
          verifiedFiles: 0,
          verifiedBytes: 0,
          shortfallFiles: 0,
          shortfallBytes: 0,
          now: new Date().toISOString(),
        }),
      ).toThrow(/not found/);
      expect(
        harness.handler.handle("promotion.getLatest", {
          toVolumeId: destinationDrive.volumeId,
          destinationRootPath: null,
        }),
      ).toEqual({ promotion: null, windowOpen: false });
      expect(
        harness.handler.handle("promotion.closeWindow", { now: new Date().toISOString() }),
      ).toEqual({ closed: true });
      const verified = (await harness.handler.handle("promotion.record", {
        destinationId: destination.destinationId,
        verifiedFiles: 3,
        verifiedBytes: 23,
        shortfallFiles: 0,
        shortfallBytes: 0,
        now: new Date().toISOString(),
      })) as { id: number };
      const sourceIdentity = (await harness.handler.handle(
        "replication.getSourceIdentity",
        {},
      )) as { catalogId: string };
      await mkdir(path.join(destinationRoot, ".memorylane"), { recursive: true });
      await writeFile(
        path.join(destinationRoot, ".memorylane", "promotion-rollback.json"),
        JSON.stringify({
          schemaVersion: 1,
          promotionId: 999,
          catalogId: sourceIdentity.catalogId,
          openedAt: new Date().toISOString(),
          available: true,
        }),
        "utf8",
      );
      const mismatched = (await harness.handler.handle("promotion.getLatest", {
        toVolumeId: destinationDrive.volumeId,
        destinationRootPath: destinationRoot,
      })) as { windowOpen: boolean };
      expect(mismatched.windowOpen).toBe(false);
      expect(() =>
        harness.handler.handle("promotion.rollback", {
          promotionId: verified.id,
          promotionRootPath: null,
          now: new Date().toISOString(),
        }),
      ).toThrow(/completed promotion/);

      expect(() =>
        harness.handler.handle("promotion.rollback", {
          promotionId: 999,
          promotionRootPath: null,
          now: new Date().toISOString(),
        }),
      ).toThrow();

      const applied = (await harness.handler.handle("promotion.apply", {
        destinationId: destination.destinationId,
        destinationRootPath: destinationRoot,
        destinationVolumeId: destinationDrive.volumeId,
        destinationVolumeSerial: destinationDrive.serialNumber,
        destinationLabel: destinationDrive.label,
        destinationFileSystem: destinationDrive.fileSystem,
        oldSourceFate: "full_copy",
        partialFates: [],
        oldSourceFits: true,
        now: new Date().toISOString(),
      })) as { promotion: { id: number } };

      const rollbackMarkerPath = path.join(
        destinationRoot,
        ".memorylane",
        "promotion-rollback.json",
      );
      const rollbackMarkerText = await readFile(rollbackMarkerPath, "utf8");
      await writeFile(
        rollbackMarkerPath,
        JSON.stringify({ ...JSON.parse(rollbackMarkerText), available: false }),
        "utf8",
      );
      expect(() =>
        harness.handler.handle("promotion.rollback", {
          promotionId: applied.promotion.id,
          promotionRootPath: destinationRoot,
          now: new Date().toISOString(),
        }),
      ).toThrow(/before the first change/);
      await writeFile(rollbackMarkerPath, rollbackMarkerText, "utf8");

      const newCatalogPath = path.join(destinationRoot, ".memorylane", "catalog.db");
      await harness.handler.handle("catalog.open", {
        catalogPath: newCatalogPath,
        identity: {
          volumeId: destinationDrive.volumeId,
          serialNumber: destinationDrive.serialNumber,
          label: destinationDrive.label,
          fileSystem: destinationDrive.fileSystem,
          rootPath: destinationRoot,
          letter: "F:",
        },
      });

      const identity = (await harness.handler.handle("replication.getSourceIdentity", {})) as {
        catalogId: string;
        role: string;
        sourceRootRelative: string;
        activeSourceVolumeId: string;
      };
      expect(identity.role).toBe("source");
      expect(identity.sourceRootRelative).toBe(path.join("Memory Lane", "Development drive"));
      expect(identity.activeSourceVolumeId).toBe(destinationDrive.volumeId);

      const promotedFiles = await harness.db.request<
        Array<{
          name: string;
          sourceRelativePath: string;
          absolutePath: string;
          resolvedDate: string;
        }>
      >("replication.listSourceFiles", {});
      expect(promotedFiles).toHaveLength(3);
      expect(promotedFiles.find((file) => file.name === "a.jpg")?.sourceRelativePath).toBe(
        path.join("photos", "a.jpg"),
      );
      expect(promotedFiles.find((file) => file.name === "a.jpg")?.resolvedDate).toBe(
        "1999-07-01T00:00:00",
      );

      const destinations = await harness.db.request<
        Array<{
          label: string;
          goal: string;
          verifiedFiles: number;
          status: string;
        }>
      >("replication.listDestinations", {});
      expect(destinations).toHaveLength(1);
      expect(destinations[0]).toMatchObject({
        label: harness.drive.label,
        goal: "full_copy",
        verifiedFiles: 3,
        status: "active",
      });

      const coverage = await planService.getCoverage();
      expect(coverage.fullCopyFiles).toBe(3);
      expect(coverage.allDestinationPercent).toBe(100);

      const merged = new Database(newCatalogPath, { readonly: true });
      try {
        const rows = merged
          .prepare("SELECT name, path, relative_path, source_membership FROM files ORDER BY name")
          .all() as Array<{
          name: string;
          path: string;
          relative_path: string;
          source_membership: string;
        }>;
        expect(rows).toHaveLength(3);
        const copyA = rows.find((row) => row.name === "a.jpg");
        expect(copyA).toMatchObject({
          relative_path: path.join("photos", "a.jpg"),
          source_membership: "source",
        });
        expect(copyA?.path).toBe(
          path.join(destinationRoot, "Memory Lane", "Development drive", "photos", "a.jpg"),
        );
        expect(merged.prepare("SELECT COUNT(*) AS count FROM duplicate_groups").get()).toEqual({
          count: 1,
        });
        expect(merged.prepare("SELECT COUNT(*) AS count FROM duplicate_members").get()).toEqual({
          count: 2,
        });
        expect(
          merged
            .prepare(
              `SELECT COUNT(*) AS count FROM replica_files rf
               JOIN replica_destinations d ON d.id = rf.replica_id
               WHERE d.label = ? AND rf.status = 'verified'`,
            )
            .get(harness.drive.label),
        ).toEqual({ count: 3 });
      } finally {
        merged.close();
      }

      const oldSourceCatalog = new Database(harness.catalogPath, { readonly: true });
      try {
        expect(
          oldSourceCatalog.prepare("SELECT role FROM archive_identity WHERE id = 1").get(),
        ).toEqual({ role: "demoted_source" });
      } finally {
        oldSourceCatalog.close();
      }

      const latest = (await harness.handler.handle("promotion.getLatest", {
        toVolumeId: destinationDrive.volumeId,
        destinationRootPath: destinationRoot,
      })) as {
        promotion: {
          id: number;
          status: string;
          sourceSnapshotPath: string | null;
          destinationSnapshotPath: string | null;
        } | null;
        windowOpen: boolean;
      };
      expect(latest.promotion).toMatchObject({
        id: applied.promotion.id,
        status: "completed",
      });
      expect(typeof latest.promotion?.sourceSnapshotPath).toBe("string");
      expect(typeof latest.promotion?.destinationSnapshotPath).toBe("string");
      expect(latest.windowOpen).toBe(true);

      const markerPath = path.join(destinationRoot, ".memorylane", "promotion-rollback.json");
      const marker = await readFile(markerPath, "utf8");
      expect(
        harness.handler.handle("promotion.closeWindow", { now: new Date().toISOString() }),
      ).toEqual({ closed: true });
      const closed = (await harness.handler.handle("promotion.getLatest", {
        toVolumeId: destinationDrive.volumeId,
        destinationRootPath: destinationRoot,
      })) as { windowOpen: boolean };
      expect(closed.windowOpen).toBe(false);
      expect(() =>
        harness.handler.handle("promotion.rollback", {
          promotionId: applied.promotion.id,
          promotionRootPath: destinationRoot,
          now: new Date().toISOString(),
        }),
      ).toThrow(/before the first change/);
      await writeFile(markerPath, marker, "utf8");

      const rolled = (await harness.handler.handle("promotion.rollback", {
        promotionId: applied.promotion.id,
        promotionRootPath: destinationRoot,
        now: new Date().toISOString(),
      })) as { restoredSourceVolumeId: string };
      expect(rolled.restoredSourceVolumeId).toBe(harness.drive.volumeId);

      const restoredIdentity = (await harness.handler.handle(
        "replication.getSourceIdentity",
        {},
      )) as { catalogId: string; role: string; sourceRootRelative: string };
      expect(restoredIdentity.role).toBe("source");
      expect(restoredIdentity.sourceRootRelative).toBe("");
      const restoredFiles = await harness.db.request<
        Array<{ name: string; sourceRelativePath: string }>
      >("replication.listSourceFiles", {});
      expect(restoredFiles.find((file) => file.name === "a.jpg")?.sourceRelativePath).toBe(
        path.join("photos", "a.jpg"),
      );

      expect(() =>
        harness.handler.handle("promotion.rollback", {
          promotionId: applied.promotion.id,
          promotionRootPath: destinationRoot,
          now: new Date().toISOString(),
        }),
      ).toThrow(/completed promotion|before the first change/);
    } finally {
      await runService.shutdown();
      await harness.dispose();
    }
  });
});
