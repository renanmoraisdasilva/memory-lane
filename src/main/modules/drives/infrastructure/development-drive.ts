import fs from "node:fs";
import path from "node:path";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { DetectedDrive } from "../domain/drive";
import { computeVolumeId } from "../infrastructure/volume-identity";

export function createDevelopmentDrive(rootPath: string): DetectedDrive {
  const resolved = path.resolve(rootPath);
  let stats: fs.Stats;
  try {
    stats = fs.statSync(resolved);
  } catch {
    throw new AppError(APP_ERROR_CODES.DRIVE_NOT_FOUND, "Development drive path does not exist", {
      rootPath: resolved,
    });
  }

  if (!stats.isDirectory()) {
    throw new AppError(
      APP_ERROR_CODES.DRIVE_NOT_FOUND,
      "Development drive path is not a directory",
      { rootPath: resolved },
    );
  }

  let totalBytes = 0;
  let freeBytes = 0;
  try {
    const fsStats = fs.statfsSync(resolved);
    totalBytes = Number(fsStats.bsize) * Number(fsStats.blocks);
    freeBytes = Number(fsStats.bsize) * Number(fsStats.bfree);
  } catch {
    // Capacity is optional for a development drive.
  }

  const label = "Development drive";
  const fileSystem = "local";

  return {
    volumeId: computeVolumeId({
      serialNumber: "development",
      label,
      fileSystem,
      totalBytes,
    }),
    serialNumber: "development",
    label,
    fileSystem,
    letter: null,
    rootPath: resolved,
    totalBytes,
    freeBytes,
    driveType: "development",
    isExternal: true,
  };
}

export function getDevelopmentDrive(): DetectedDrive | null {
  const configuredPath = process.env.MEMORY_LANE_DEV_DRIVE?.trim();
  if (!configuredPath) {
    return null;
  }
  return createDevelopmentDrive(configuredPath);
}
