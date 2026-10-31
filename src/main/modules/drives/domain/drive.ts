import type { DriveIdentity, DriveType, VolumeId } from "@shared/contracts/drives";

export interface DetectedDrive {
  volumeId: VolumeId;
  serialNumber: string | null;
  label: string;
  fileSystem: string;
  letter: string | null;
  rootPath: string;
  totalBytes: number;
  freeBytes: number;
  driveType: DriveType;
  isExternal: boolean;
}

export interface RegisteredDrive {
  id: number;
  volumeId: VolumeId;
  volumeSerial: string | null;
  label: string;
  fileSystem: string;
  rootPath: string;
  lastLetter: string | null;
  lastSeenAt: string;
  catalogSchema: number;
  lastBackupAt: string | null;
}

export function toDriveIdentity(drive: DetectedDrive): DriveIdentity {
  return {
    volumeId: drive.volumeId,
    serialNumber: drive.serialNumber,
    label: drive.label,
    fileSystem: drive.fileSystem,
    rootPath: drive.rootPath,
    letter: drive.letter,
  };
}
