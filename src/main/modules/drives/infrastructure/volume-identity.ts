import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { z } from "zod";
import { toVolumeId, type VolumeId } from "@shared/contracts/drives";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { DetectedDrive } from "../domain/drive";

const PowerShellDiskSchema = z.object({
  DeviceID: z.string(),
  VolumeName: z.string().nullable().optional(),
  FileSystem: z.string().nullable().optional(),
  SerialNumber: z.string().nullable().optional(),
  Size: z.union([z.string(), z.number()]).nullable().optional(),
  FreeSpace: z.union([z.string(), z.number()]).nullable().optional(),
  DriveType: z.union([z.string(), z.number()]),
});

type PowerShellDisk = z.infer<typeof PowerShellDiskSchema>;

export interface VolumeIdInput {
  serialNumber: string | null;
  label: string;
  fileSystem: string;
  totalBytes: number;
}

export function computeVolumeId(input: VolumeIdInput): VolumeId {
  const material = [
    input.serialNumber ?? "",
    input.label.trim(),
    input.fileSystem.trim().toUpperCase(),
    String(input.totalBytes),
  ].join("|");
  return toVolumeId(createHash("sha256").update(material).digest("hex"));
}

function parseNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function toDriveType(value: string | number): DetectedDrive["driveType"] {
  const driveTypeNumber = Number(value);
  if (driveTypeNumber === 2) {
    return "removable";
  }
  if (driveTypeNumber === 3) {
    return "fixed";
  }
  return "unknown";
}

function isExternalDrive(driveType: DetectedDrive["driveType"], isSystemDrive: boolean): boolean {
  return driveType === "removable" || (driveType === "fixed" && !isSystemDrive);
}

function mapDisk(disk: PowerShellDisk, systemDrive: string): DetectedDrive | null {
  const deviceId = disk.DeviceID.trim().toUpperCase();
  if (!/^[A-Z]:$/.test(deviceId)) {
    return null;
  }

  const driveType = toDriveType(disk.DriveType);
  const label = disk.VolumeName?.trim() || `Local Disk (${deviceId})`;
  const fileSystem = disk.FileSystem?.trim() || "unknown";
  const serialNumber = disk.SerialNumber?.trim() || null;
  const totalBytes = parseNumber(disk.Size);
  const freeBytes = parseNumber(disk.FreeSpace);

  return {
    volumeId: computeVolumeId({ serialNumber, label, fileSystem, totalBytes }),
    serialNumber,
    label,
    fileSystem,
    letter: deviceId,
    rootPath: `${deviceId}\\`,
    totalBytes,
    freeBytes,
    driveType,
    isExternal: isExternalDrive(driveType, deviceId === systemDrive),
  };
}

export function parseWindowsVolumes(
  rawJson: string,
  options: { systemDrive?: string | null } = {},
): DetectedDrive[] {
  const trimmed = rawJson.trim();
  if (trimmed.length === 0 || trimmed === "null") {
    return [];
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(trimmed);
  } catch (error) {
    throw new AppError(APP_ERROR_CODES.DRIVE_NOT_FOUND, "Windows returned invalid drive data", {
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  const parsed = z
    .union([PowerShellDiskSchema, z.array(PowerShellDiskSchema)])
    .safeParse(parsedJson);
  if (!parsed.success) {
    throw new AppError(APP_ERROR_CODES.DRIVE_NOT_FOUND, "Windows returned unexpected drive data", {
      issues: parsed.error.issues,
    });
  }

  const disks = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
  const systemDrive = (options.systemDrive ?? process.env.SystemDrive ?? "").toUpperCase();
  return disks
    .map((disk) => mapDisk(disk, systemDrive))
    .filter((drive): drive is DetectedDrive => drive !== null);
}

const DISK_QUERY = [
  "$ErrorActionPreference = 'Stop'",
  "$volumes = Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -in 2,3 } | Select-Object DeviceID,VolumeName,FileSystem,SerialNumber,Size,FreeSpace,DriveType",
  "$volumes | ConvertTo-Json -Compress",
].join("; ");

export async function listWindowsDrives(): Promise<DetectedDrive[]> {
  if (process.platform !== "win32") {
    return [];
  }

  const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", DISK_QUERY],
      { encoding: "utf8", windowsHide: true, timeout: 10_000, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new AppError(APP_ERROR_CODES.DRIVE_NOT_FOUND, "Unable to enumerate Windows drives", {
              cause: error.message,
            }),
          );
          return;
        }
        resolve({ stdout, stderr });
      },
    );
  });

  return parseWindowsVolumes(result.stdout, { systemDrive: process.env.SystemDrive ?? null });
}
