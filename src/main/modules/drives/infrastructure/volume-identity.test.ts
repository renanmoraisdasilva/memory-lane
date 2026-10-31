import { describe, expect, it } from "vitest";
import { computeVolumeId, parseWindowsVolumes } from "./volume-identity";

const disks = [
  {
    DeviceID: "C:",
    VolumeName: "Windows",
    FileSystem: "NTFS",
    SerialNumber: "SYSTEM",
    Size: 1000,
    FreeSpace: 400,
    DriveType: 3,
  },
  {
    DeviceID: "e:",
    VolumeName: "Archive",
    FileSystem: "NTFS",
    SerialNumber: "SERIAL",
    Size: 2000,
    FreeSpace: 1200,
    DriveType: 3,
  },
  {
    DeviceID: "F:",
    VolumeName: null,
    FileSystem: "exFAT",
    SerialNumber: null,
    Size: "3000",
    FreeSpace: "100",
    DriveType: 2,
  },
];

describe("volume identity", () => {
  it("computes a stable SHA-256 volume id", () => {
    const first = computeVolumeId({
      serialNumber: "SERIAL",
      label: "Archive",
      fileSystem: "NTFS",
      totalBytes: 2000,
    });
    const second = computeVolumeId({
      serialNumber: "SERIAL",
      label: "Archive",
      fileSystem: "NTFS",
      totalBytes: 2000,
    });

    expect(first).toBe(second);
    expect(first).toHaveLength(64);
  });

  it("changes the id when stable volume details change", () => {
    const base = {
      serialNumber: "SERIAL",
      label: "Archive",
      fileSystem: "NTFS",
      totalBytes: 2000,
    };

    expect(computeVolumeId(base)).not.toBe(computeVolumeId({ ...base, totalBytes: 2001 }));
    expect(computeVolumeId(base)).not.toBe(computeVolumeId({ ...base, serialNumber: "OTHER" }));
  });

  it("parses multiple Windows disks and marks the system drive internal", () => {
    const parsed = parseWindowsVolumes(JSON.stringify(disks), { systemDrive: "C:" });

    expect(parsed).toHaveLength(3);
    expect(parsed[0]?.isExternal).toBe(false);
    expect(parsed[1]?.isExternal).toBe(true);
    expect(parsed[2]?.isExternal).toBe(true);
    expect(parsed[2]?.label).toBe("Local Disk (F:)");
    expect(parsed[2]?.totalBytes).toBe(3000);
  });

  it("parses a single disk object", () => {
    const parsed = parseWindowsVolumes(JSON.stringify(disks[1]), { systemDrive: "C:" });
    expect(parsed[0]?.label).toBe("Archive");
  });

  it("handles empty and null PowerShell output", () => {
    expect(parseWindowsVolumes("")).toEqual([]);
    expect(parseWindowsVolumes("null")).toEqual([]);
  });

  it("rejects malformed data", () => {
    expect(() => parseWindowsVolumes("{")).toThrow();
    expect(() => parseWindowsVolumes(JSON.stringify({ nope: true }))).toThrow();
  });

  it("drops invalid device ids", () => {
    const parsed = parseWindowsVolumes(JSON.stringify([{ ...disks[1], DeviceID: "not-a-drive" }]), {
      systemDrive: "C:",
    });
    expect(parsed).toEqual([]);
  });
});
