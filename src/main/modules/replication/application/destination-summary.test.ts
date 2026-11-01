import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import type { ReplicationDestinationRecord } from "../../../db/repositories/replication-destination-repository";
import type { DetectedDrive } from "../../drives/domain/drive";
import {
  firstPartialPriority,
  toDestinationDetail,
  toDestinationSummary,
} from "./destination-summary";

const record: ReplicationDestinationRecord = {
  id: 1,
  destinationId: "dest-1",
  volumeId: "volume-dest",
  volumeSerial: "SERIAL",
  label: "Backup A",
  rootRelative: "",
  copyRootRelative: null,
  archiveFolderName: null,
  goal: "extend_coverage",
  layout: "dedicated",
  localCatalogId: "local-1",
  localCatalogRelative: ".memorylane/catalog.db",
  sourceIndexRelative: null,
  sourceIndexUpdatedAt: null,
  allocationMode: "all_safe",
  allocationPercent: null,
  allocationBytes: null,
  reserveBytes: 100,
  priority: 0,
  status: "active",
  identityConfidence: "confirmed",
  fullCopyStatus: "not_applicable",
  fullCopyShortfallBytes: 0,
  fullCopyShortfallFiles: 0,
  lastSeenAt: null,
  lastCapacityBytes: 1_000,
  lastFreeBytes: 500,
  createdAt: "2026-11-01T12:00:00.000Z",
  updatedAt: "2026-11-01T12:00:00.000Z",
  verifiedFiles: 2,
  verifiedBytes: 200,
  onlyOnDriveFiles: 1,
  onlyOnDriveBytes: 10,
  sourceMissingFiles: 0,
  sourceMissingBytes: 0,
  lastVerifiedAt: null,
  conflictFiles: 0,
  staleFiles: 0,
  missingFiles: 0,
};

const drive: DetectedDrive = {
  volumeId: toVolumeId("volume-dest"),
  serialNumber: "SERIAL",
  label: "Backup A",
  fileSystem: "NTFS",
  letter: "F:",
  rootPath: "F:\\",
  totalBytes: 2_000,
  freeBytes: 1_000,
  driveType: "removable",
  isExternal: true,
};

describe("destination summary", () => {
  it("computes safe capacity for each allocation mode", () => {
    expect(toDestinationSummary(record, drive, 0)).toMatchObject({
      availableBytes: 900,
      connection: "connected",
    });
    expect(
      toDestinationSummary(
        { ...record, allocationMode: "percent", allocationPercent: 25, verifiedBytes: 100 },
        drive,
        0,
      ).availableBytes,
    ).toBe(400);
    expect(
      toDestinationSummary(
        { ...record, allocationMode: "fixed", allocationBytes: 300, verifiedBytes: 100 },
        drive,
        0,
      ).availableBytes,
    ).toBe(200);
  });

  it("labels offline, retired, and lost destinations", () => {
    expect(toDestinationSummary(record, undefined, 0)).toMatchObject({
      connection: "offline",
      mount: null,
      totalBytes: 1_000,
      freeBytes: 500,
    });
    expect(toDestinationSummary({ ...record, status: "retired" }, drive, 0).connection).toBe(
      "retired",
    );
    expect(toDestinationSummary({ ...record, status: "lost" }, drive, 0).connection).toBe("lost");
    expect(toDestinationSummary({ ...record, priority: 2 }, drive, 2).isFirstInFillOrder).toBe(
      true,
    );
    expect(toDestinationSummary({ ...record, priority: 3 }, drive, 2).isFirstInFillOrder).toBe(
      false,
    );
    expect(firstPartialPriority([record, { ...record, id: 2, priority: 1 }])).toBe(0);
    expect(firstPartialPriority([{ ...record, goal: "full_copy" }])).toBeNull();
  });

  it("builds the detail shape", () => {
    expect(toDestinationDetail(record, drive, 0)).toMatchObject({
      rootRelative: "",
      adoptionRootRelative: "",
      localLibraryFiles: 0,
      adoption: null,
      coverageMap: [],
    });
  });
});
