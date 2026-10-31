import type { CatalogSummary } from "@shared/contracts/drives";
import { toVolumeId } from "@shared/contracts/drives";
import type { AppInfo } from "@shared/contracts/ipc";
import type { DriveSelectionItem } from "../features/drives/types";
import { catalogPathForRoot } from "./drive-paths";

const GIGABYTE = 1024 ** 3;
const TERABYTE = 1024 ** 4;

export type MockDriveScenario = "mixed" | "empty" | "catalog" | "letter-change";

export const mockAppInfo: AppInfo = {
  appVersion: "0.1.0",
  electronVersion: "42.11.18",
  platform: "win32",
  isPackaged: false,
  userDataPath: "C:\\Users\\Ada\\AppData\\Local\\MemoryLane-dev",
  logPath: "C:\\Users\\Ada\\AppData\\Local\\MemoryLane-dev\\logs\\main.log",
  database: {
    state: "ready",
    appDbPath: "C:\\Users\\Ada\\AppData\\Local\\MemoryLane-dev\\app.db",
    schemaVersion: 1,
  },
};

export const mockVolumeIds = {
  ready: toVolumeId("mock-passport"),
  fresh: toVolumeId("mock-samsung"),
  offline: toVolumeId("mock-seagate"),
  system: toVolumeId("mock-windows"),
  letterChange: toVolumeId("mock-letter-change"),
} as const;

const READY_DRIVE: DriveSelectionItem = {
  volumeId: mockVolumeIds.ready,
  label: "WD My Passport 2TB",
  letter: "E:",
  rootPath: "E:\\",
  fileSystem: "NTFS",
  serialNumber: "WDBYFT0020BBK-0A",
  totalBytes: 2 * TERABYTE,
  freeBytes: 0.58 * TERABYTE,
  driveType: "removable",
  isExternal: true,
  catalogStatus: "ready",
  lastSeenAt: "2026-10-31T14:32:00.000Z",
  connection: "connected",
  indexedItemCount: 97_902,
  lastScanAt: "2026-10-31T14:32:00.000Z",
  pendingLetterChange: null,
};

const FRESH_DRIVE: DriveSelectionItem = {
  volumeId: mockVolumeIds.fresh,
  label: "Samsung T7 Shield 1TB",
  letter: "F:",
  rootPath: "F:\\",
  fileSystem: "exFAT",
  serialNumber: "S6P9NS0T312345A",
  totalBytes: 1 * TERABYTE,
  freeBytes: 360 * GIGABYTE,
  driveType: "removable",
  isExternal: true,
  catalogStatus: "none",
  lastSeenAt: null,
  connection: "connected",
  indexedItemCount: null,
  lastScanAt: null,
  pendingLetterChange: null,
};

const OFFLINE_DRIVE: DriveSelectionItem = {
  volumeId: mockVolumeIds.offline,
  label: "Seagate Backup Plus 4TB",
  letter: "G:",
  rootPath: "G:\\",
  fileSystem: "NTFS",
  serialNumber: "NA9K2Y4T",
  totalBytes: 4 * TERABYTE,
  freeBytes: 1.1 * TERABYTE,
  driveType: "removable",
  isExternal: true,
  catalogStatus: "ready",
  lastSeenAt: "2026-10-30T19:42:00.000Z",
  connection: "offline",
  indexedItemCount: 94_310,
  lastScanAt: "2026-10-30T19:42:00.000Z",
  pendingLetterChange: null,
};

const SYSTEM_DRIVE: DriveSelectionItem = {
  volumeId: mockVolumeIds.system,
  label: "Windows",
  letter: "C:",
  rootPath: "C:\\",
  fileSystem: "NTFS",
  serialNumber: "9C4A1B7D",
  totalBytes: 512 * GIGABYTE,
  freeBytes: 84 * GIGABYTE,
  driveType: "fixed",
  isExternal: false,
  catalogStatus: "none",
  lastSeenAt: null,
  connection: "connected",
  indexedItemCount: null,
  lastScanAt: null,
  pendingLetterChange: null,
};

const LETTER_CHANGE_DRIVE: DriveSelectionItem = {
  ...READY_DRIVE,
  volumeId: mockVolumeIds.letterChange,
  label: "Archive Passport 2TB",
  letter: "H:",
  rootPath: "H:\\",
  pendingLetterChange: {
    previousLetter: "G:",
    newLetter: "H:",
    previousRootPath: "G:\\.memorylane\\catalog.db",
    newRootPath: "H:\\.memorylane\\catalog.db",
  },
};

function cloneDrive(drive: DriveSelectionItem): DriveSelectionItem {
  return {
    ...drive,
    pendingLetterChange:
      drive.pendingLetterChange === null ? null : { ...drive.pendingLetterChange },
  };
}

export function createMockDrives(scenario: MockDriveScenario = "mixed"): DriveSelectionItem[] {
  switch (scenario) {
    case "empty":
      return [];
    case "catalog":
      return [cloneDrive(READY_DRIVE), cloneDrive(SYSTEM_DRIVE)];
    case "letter-change":
      return [cloneDrive(LETTER_CHANGE_DRIVE), cloneDrive(SYSTEM_DRIVE)];
    case "mixed":
      return [
        cloneDrive(READY_DRIVE),
        cloneDrive(FRESH_DRIVE),
        cloneDrive(OFFLINE_DRIVE),
        cloneDrive(SYSTEM_DRIVE),
      ];
  }
}

export function mockCatalogSummary(drive: DriveSelectionItem): CatalogSummary {
  return {
    catalogPath: catalogPathForRoot(drive.rootPath),
    driveLabel: drive.label,
    volumeId: drive.volumeId,
    schemaVersion: 1,
    fileCount: drive.catalogStatus === "ready" ? (drive.indexedItemCount ?? 0) : 0,
    openedAt: "2026-10-31T14:32:00.000Z",
  };
}
