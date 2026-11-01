import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AppError } from "@shared/domain/errors";
import {
  createDevelopmentDrive,
  getDevelopmentDrive,
  getDevelopmentDrives,
} from "./development-drive";

const temporaryDirectories: string[] = [];

async function createTempDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "memory-lane-dev-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  delete process.env.MEMORY_LANE_DEV_DRIVE;
  delete process.env.MEMORY_LANE_DEV_DRIVES;
  delete process.env.MEMORY_LANE_DEV_DRIVE_LABEL;
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("development drive", () => {
  it("creates a supported development drive from a directory", async () => {
    const directory = await createTempDirectory();
    const drive = createDevelopmentDrive(directory);

    expect(drive.driveType).toBe("development");
    expect(drive.isExternal).toBe(true);
    expect(drive.rootPath).toBe(path.resolve(directory));
    expect(drive.volumeId).toHaveLength(64);
  });

  it("rejects a missing directory", () => {
    expect(() => createDevelopmentDrive(path.join(os.tmpdir(), "does-not-exist-ml"))).toThrow(
      AppError,
    );
  });

  it("reads the development drive from the environment", async () => {
    const directory = await createTempDirectory();
    process.env.MEMORY_LANE_DEV_DRIVE = directory;

    expect(getDevelopmentDrive()?.rootPath).toBe(path.resolve(directory));
  });

  it("returns null without an environment path", () => {
    expect(getDevelopmentDrive()).toBeNull();
  });

  it("reads multiple development drives and labels", async () => {
    const source = await createTempDirectory();
    const destination = await createTempDirectory();
    process.env.MEMORY_LANE_DEV_DRIVES = JSON.stringify([
      { path: source, label: "Source drive", serial: "source-serial" },
      { path: destination, label: "Backup A", serial: "backup-serial" },
    ]);

    const drives = getDevelopmentDrives();
    expect(drives.map((drive) => drive.label)).toEqual(["Source drive", "Backup A"]);
    expect(drives[0]?.serialNumber).toBe("source-serial");
    expect(drives[0]?.volumeId).not.toBe(drives[1]?.volumeId);
  });
});
