import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { DetectedDrive } from "../domain/drive";
import { computeVolumeId } from "../infrastructure/volume-identity";

const DevelopmentDriveConfigSchema = z.object({
  path: z.string().min(1),
  label: z.string().min(1).optional(),
  serial: z.string().min(1).optional(),
});

export type DevelopmentDriveConfig = z.infer<typeof DevelopmentDriveConfigSchema>;

export function createDevelopmentDrive(
  rootPath: string,
  config: Partial<DevelopmentDriveConfig> = {},
): DetectedDrive {
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

  const label =
    config.label ?? process.env.MEMORY_LANE_DEV_DRIVE_LABEL?.trim() ?? "Development drive";
  const serial = config.serial ?? "development";
  const fileSystem = "local";

  return {
    volumeId: computeVolumeId({
      serialNumber: serial,
      label,
      fileSystem,
      totalBytes,
    }),
    serialNumber: serial,
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

export function getDevelopmentDrives(): DetectedDrive[] {
  const drives: DetectedDrive[] = [];
  const multi = process.env.MEMORY_LANE_DEV_DRIVES?.trim();
  if (multi) {
    try {
      const parsed = z.array(DevelopmentDriveConfigSchema).safeParse(JSON.parse(multi));
      if (parsed.success) {
        for (const config of parsed.data) {
          drives.push(createDevelopmentDrive(config.path, config));
        }
      }
    } catch {
      // Invalid multi-drive configuration falls back to the single drive.
    }
  }
  if (drives.length > 0) {
    return drives;
  }
  const single = getDevelopmentDrive();
  return single === null ? [] : [single];
}
