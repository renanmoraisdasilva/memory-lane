import { access, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { AppError } from "@shared/domain/errors";
import type { ArchiveIdentity } from "../../../db/repositories/archive-identity-repository";
import { createScanHarness } from "../../../../../tests/integration/scan-harness";
import type { DetectedDrive } from "../../drives/domain/drive";
import { DestinationService } from "./destination-service";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function destinationDrive(rootPath: string): DetectedDrive {
  return {
    volumeId: toVolumeId("destination-volume"),
    serialNumber: "DEST-SERIAL",
    label: "Backup A",
    fileSystem: "NTFS",
    letter: "F:",
    rootPath,
    totalBytes: 1_000_000,
    freeBytes: 900_000,
    driveType: "removable",
    isExternal: true,
  };
}

describe("destination service", () => {
  it("[ML-REPL-011] [ML-REPL-012] [ML-REPL-014] registers a dedicated destination, writes a marker, and lists it", async () => {
    const harness = await createScanHarness();
    const destinationRoot = await mkdtemp(path.join(os.tmpdir(), "memory-lane-destination-"));
    roots.push(destinationRoot);
    const drive = destinationDrive(destinationRoot);
    const service = new DestinationService({
      db: harness.db,
      listDetected: async () => [harness.drive, drive],
      logger: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
        debug: () => undefined,
      },
    });

    try {
      const detail = await service.register({
        volumeId: drive.volumeId,
        rootRelative: "",
        goal: "extend_coverage",
        layout: "dedicated",
        allocationMode: "all_safe",
        allocationPercent: null,
        allocationBytes: null,
        reserveBytes: 1024,
      });
      expect(detail).toMatchObject({
        label: "Backup A",
        goal: "extend_coverage",
        connection: "connected",
        priority: 0,
        isFirstInFillOrder: true,
      });
      await expect(
        access(path.join(destinationRoot, ".memorylane", "catalog.db")),
      ).resolves.toBeUndefined();
      const source = await harness.db.request<ArchiveIdentity>("replication.getSourceIdentity", {});
      await expect(
        access(path.join(destinationRoot, ".memorylane", "replicas", `${source.catalogId}.json`)),
      ).resolves.toBeUndefined();

      const listed = await service.list();
      expect(listed).toHaveLength(1);
      expect(listed[0]?.mount).toBe(destinationRoot);

      const again = await service.register({
        volumeId: drive.volumeId,
        rootRelative: "",
        goal: "extend_coverage",
        layout: "dedicated",
        allocationMode: "all_safe",
        allocationPercent: null,
        allocationBytes: null,
        reserveBytes: 1024,
      });
      expect(again.id).toBe(detail.id);
    } finally {
      await harness.dispose();
    }
  });

  it("[ML-REPL-009] rejects the source volume as a destination", async () => {
    const harness = await createScanHarness();
    const service = new DestinationService({
      db: harness.db,
      listDetected: async () => [harness.drive],
      logger: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
        debug: () => undefined,
      },
    });
    try {
      await expect(
        service.register({
          volumeId: harness.drive.volumeId,
          rootRelative: "",
          goal: "extend_coverage",
          layout: "dedicated",
          allocationMode: "all_safe",
          allocationPercent: null,
          allocationBytes: null,
          reserveBytes: 1024,
        }),
      ).rejects.toBeInstanceOf(AppError);
    } finally {
      await harness.dispose();
    }
  });

  it("[ML-REPL-089] lists candidates and updates destination settings", async () => {
    const harness = await createScanHarness();
    const destinationRoot = await mkdtemp(path.join(os.tmpdir(), "memory-lane-destination-"));
    roots.push(destinationRoot);
    const drive = destinationDrive(destinationRoot);
    let detected = [harness.drive, drive];
    const service = new DestinationService({
      db: harness.db,
      listDetected: async () => detected,
      logger: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
        debug: () => undefined,
      },
    });
    try {
      const detail = await service.register({
        volumeId: drive.volumeId,
        rootRelative: "",
        goal: "extend_coverage",
        layout: "dedicated",
        allocationMode: "percent",
        allocationPercent: 50,
        allocationBytes: null,
        reserveBytes: 1024,
      });
      const candidates = await service.listCandidates();
      expect(candidates.find((candidate) => candidate.isActiveSource)?.blockedReason).toContain(
        "active source",
      );
      const destinationCandidate = candidates.find(
        (candidate) => candidate.volumeId === drive.volumeId,
      );
      expect(destinationCandidate?.hasMarker).toBe(true);
      expect(destinationCandidate?.markerCatalogId).not.toBeNull();

      const updated = await service.update({
        destinationId: detail.destinationId,
        goal: "full_copy",
        allocationMode: "fixed",
        allocationBytes: 4096,
        reserveBytes: 2048,
        layout: "mirror_source",
      });
      expect(updated).toMatchObject({
        goal: "full_copy",
        allocationMode: "fixed",
        allocationBytes: 4096,
        reserveBytes: 2048,
        layout: "mirror_source",
      });

      detected = [harness.drive];
      const offline = await service.list();
      expect(offline[0]).toMatchObject({ connection: "offline", mount: null });
      expect((await service.get(detail.id)).adoption?.status).toBe("idle");
      expect((await service.getByDestinationId(detail.destinationId)).id).toBe(detail.id);
      await expect(service.getByDestinationId("missing")).rejects.toBeInstanceOf(AppError);
      await expect(
        service.update({ destinationId: "missing", goal: "extend_coverage" }),
      ).rejects.toBeInstanceOf(AppError);
      await expect(
        service.register({
          volumeId: toVolumeId("missing-volume"),
          rootRelative: "",
          goal: "extend_coverage",
          layout: "dedicated",
          allocationMode: "all_safe",
          allocationPercent: null,
          allocationBytes: null,
          reserveBytes: 0,
        }),
      ).rejects.toBeInstanceOf(AppError);
    } finally {
      await harness.dispose();
    }
  });
});
