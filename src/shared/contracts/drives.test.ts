import { describe, expect, it } from "vitest";
import {
  CatalogSummarySchema,
  DriveIdentitySchema,
  DriveInfoSchema,
  VolumeIdSchema,
  toVolumeId,
} from "./drives";

const volumeId = toVolumeId("volume-1");

describe("drive contracts", () => {
  it("accepts a non-empty volume id", () => {
    expect(VolumeIdSchema.parse("volume-1")).toBe("volume-1");
    expect(() => VolumeIdSchema.parse("")).toThrow();
  });

  it("parses a drive identity", () => {
    const parsed = DriveIdentitySchema.parse({
      volumeId,
      serialNumber: "SERIAL",
      label: "Archive",
      fileSystem: "NTFS",
      rootPath: "E:\\",
      letter: "E:",
    });

    expect(parsed.letter).toBe("E:");
  });

  it("rejects an invalid drive letter", () => {
    expect(() =>
      DriveIdentitySchema.parse({
        volumeId,
        serialNumber: null,
        label: "Archive",
        fileSystem: "NTFS",
        rootPath: "E:\\",
        letter: "EE:",
      }),
    ).toThrow();
  });

  it("parses drive info and rejects negative capacity", () => {
    const drive = DriveInfoSchema.parse({
      volumeId,
      label: "Archive",
      letter: "E:",
      rootPath: "E:\\",
      fileSystem: "NTFS",
      serialNumber: null,
      totalBytes: 1024,
      freeBytes: 512,
      driveType: "removable",
      isExternal: true,
      catalogStatus: "ready",
      lastSeenAt: null,
    });

    expect(drive.catalogStatus).toBe("ready");
    expect(() => DriveInfoSchema.parse({ ...drive, totalBytes: -1 })).toThrow();
  });

  it("parses a catalog summary", () => {
    const summary = CatalogSummarySchema.parse({
      catalogPath: "E:\\.memorylane\\catalog.db",
      driveLabel: "Archive",
      volumeId,
      schemaVersion: 1,
      fileCount: 0,
      openedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(summary.schemaVersion).toBe(1);
  });
});
