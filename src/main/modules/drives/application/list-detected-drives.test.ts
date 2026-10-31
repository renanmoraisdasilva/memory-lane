import { describe, expect, it, vi } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import type { DetectedDrive } from "../domain/drive";

const mocks = vi.hoisted(() => ({
  listWindowsDrives: vi.fn(),
  getDevelopmentDrive: vi.fn(),
}));

vi.mock("../infrastructure/volume-identity", () => ({
  listWindowsDrives: mocks.listWindowsDrives,
}));

vi.mock("../infrastructure/development-drive", () => ({
  getDevelopmentDrive: mocks.getDevelopmentDrive,
}));

import { listDetectedDrives } from "./list-detected-drives";

function drive(label: string, volumeId: string): DetectedDrive {
  return {
    volumeId: toVolumeId(volumeId),
    serialNumber: volumeId,
    label,
    fileSystem: "NTFS",
    letter: "E:",
    rootPath: "E:\\",
    totalBytes: 100,
    freeBytes: 50,
    driveType: "removable",
    isExternal: true,
  };
}

describe("listDetectedDrives", () => {
  it("returns Windows drives", async () => {
    mocks.listWindowsDrives.mockResolvedValue([drive("Windows drive", "v1")]);
    mocks.getDevelopmentDrive.mockReturnValue(null);

    const result = await listDetectedDrives();

    expect(result.map((item) => item.label)).toEqual(["Windows drive"]);
  });

  it("appends a development drive", async () => {
    mocks.listWindowsDrives.mockResolvedValue([drive("Windows drive", "v1")]);
    mocks.getDevelopmentDrive.mockReturnValue(drive("Development drive", "v2"));

    const result = await listDetectedDrives();

    expect(result.map((item) => item.label)).toEqual(["Windows drive", "Development drive"]);
  });
});
