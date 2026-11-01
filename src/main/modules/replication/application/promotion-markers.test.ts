import { describe, expect, it, vi } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import type { ReplicationDestinationRecord } from "../../../db/repositories/replication-destination-repository";
import type { DetectedDrive } from "../../drives/domain/drive";
import type { DestinationWriter } from "../infrastructure/destination-writer";
import { updatePromotionMarkers } from "./promotion-markers";
import { testLogger } from "../../../../../tests/integration/scan-harness";

const record: ReplicationDestinationRecord = {
  id: 1,
  destinationId: "dest-1",
  volumeId: "volume-1",
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
  reserveBytes: 0,
  priority: 0,
  status: "active",
  identityConfidence: "confirmed",
  fullCopyStatus: "not_applicable",
  fullCopyShortfallBytes: 0,
  fullCopyShortfallFiles: 0,
  lastSeenAt: null,
  lastCapacityBytes: null,
  lastFreeBytes: null,
  createdAt: "2026-11-01T12:00:00.000Z",
  updatedAt: "2026-11-01T12:00:00.000Z",
  verifiedFiles: 0,
  verifiedBytes: 0,
  onlyOnDriveFiles: 0,
  onlyOnDriveBytes: 0,
  sourceMissingFiles: 0,
  sourceMissingBytes: 0,
  lastVerifiedAt: null,
  conflictFiles: 0,
  staleFiles: 0,
  missingFiles: 0,
  failedFiles: 0,
};

const drive: DetectedDrive = {
  volumeId: toVolumeId("volume-1"),
  serialNumber: "SERIAL",
  label: "Backup A",
  fileSystem: "NTFS",
  letter: "F:",
  rootPath: "F:\\",
  totalBytes: 100,
  freeBytes: 50,
  driveType: "removable",
  isExternal: true,
};

function writer(texts: Map<string, string>): DestinationWriter {
  return {
    mkdir: async () => undefined,
    writeText: async (relativePath, text) => {
      texts.set(relativePath, text);
    },
    stat: async () => null,
    freeBytes: async () => 1,
    createTemp: async () => {
      throw new Error("not used");
    },
    renameTemp: async () => undefined,
    removeTemp: async () => undefined,
    removeEmptyDirectory: async () => undefined,
  };
}

describe("promotion marker updates", () => {
  it("writes a marker for every connected destination", async () => {
    const texts = new Map<string, string>();
    await updatePromotionMarkers({
      records: [record],
      drives: [drive],
      catalogId: "catalog-1",
      sourceLabel: "4TB Archive",
      sourceVolumeId: "volume-source",
      now: "2026-11-01T12:00:00.000Z",
      logger: testLogger(),
      writerFor: () => writer(texts),
    });
    expect([...texts.keys()]).toEqual([".memorylane\\replicas\\catalog-1.json"]);
    expect(JSON.parse([...texts.values()][0] ?? "{}")).toMatchObject({
      catalogId: "catalog-1",
      sourceVolumeId: "volume-source",
      destinationId: "dest-1",
    });
  });

  it("skips offline destinations and logs marker write failures", async () => {
    const logger = testLogger();
    await updatePromotionMarkers({
      records: [record, { ...record, id: 2, volumeId: "volume-missing" }],
      drives: [drive],
      catalogId: "catalog-1",
      sourceLabel: "4TB Archive",
      sourceVolumeId: "volume-source",
      now: "2026-11-01T12:00:00.000Z",
      logger,
      writerFor: () => ({
        ...writer(new Map()),
        writeText: async () => {
          throw new Error("locked");
        },
      }),
    });
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      "Destination marker update failed after promotion",
      expect.objectContaining({ message: "locked" }),
    );
  });
});
