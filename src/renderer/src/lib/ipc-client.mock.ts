import type { VolumeId } from "@shared/contracts/drives";
import type { AppInfo } from "@shared/contracts/ipc";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { DriveSelectionItem } from "../features/drives/types";
import { isSupportedDrive } from "../features/drives/types";
import type { ScanState } from "../features/scan/types";
import type { PhaseOneClient } from "./phase-one-client";
import { createMockScanController } from "./mock-scan-controller";
import {
  createMockDrives,
  mockAppInfo,
  mockCatalogSummary,
  type MockDriveScenario,
} from "./mock-fixtures";

export interface MockPhaseOneClientOptions {
  drives?: DriveSelectionItem[];
  scenario?: MockDriveScenario;
  scanStates?: Record<string, ScanState>;
  autoAdvance?: boolean;
  appInfo?: AppInfo;
  overrides?: Partial<PhaseOneClient>;
}

function cloneDrive(drive: DriveSelectionItem): DriveSelectionItem {
  return {
    ...drive,
    pendingLetterChange:
      drive.pendingLetterChange === null ? null : { ...drive.pendingLetterChange },
  };
}

function cloneDrives(drives: DriveSelectionItem[]): DriveSelectionItem[] {
  return drives.map(cloneDrive);
}

function findDrive(drives: DriveSelectionItem[], volumeId: VolumeId): DriveSelectionItem {
  const drive = drives.find((candidate) => candidate.volumeId === volumeId);
  if (drive === undefined) {
    throw new AppError(
      APP_ERROR_CODES.DRIVE_NOT_FOUND,
      "The selected drive is no longer connected",
    );
  }
  if (drive.connection === "offline") {
    throw new AppError(APP_ERROR_CODES.DRIVE_NOT_FOUND, "Reconnect the drive before continuing");
  }
  return drive;
}

function assertSupported(drive: DriveSelectionItem): void {
  if (!isSupportedDrive(drive)) {
    throw new AppError(
      APP_ERROR_CODES.DRIVE_UNSUPPORTED,
      "Select an external drive. The Windows system drive is not supported.",
    );
  }
}

export function createMockPhaseOneClient(options: MockPhaseOneClientOptions = {}): PhaseOneClient {
  const drives = cloneDrives(options.drives ?? createMockDrives(options.scenario ?? "mixed"));
  const scans = createMockScanController({
    states: options.scanStates ?? {},
    autoAdvance: options.autoAdvance ?? false,
  });

  const client: PhaseOneClient = {
    getAppInfo: () => Promise.resolve(options.appInfo ?? mockAppInfo),
    listDrives: () => Promise.resolve(cloneDrives(drives)),
    initializeCatalog: (volumeId) =>
      Promise.resolve().then(() => {
        const drive = findDrive(drives, volumeId);
        assertSupported(drive);
        if (drive.catalogStatus === "ready") {
          throw new AppError(
            APP_ERROR_CODES.CATALOG_ALREADY_EXISTS,
            "This drive already has a catalog",
          );
        }
        drive.catalogStatus = "ready";
        drive.indexedItemCount = 0;
        drive.lastScanAt = "2026-10-31T14:40:00.000Z";
        return mockCatalogSummary(drive);
      }),
    openCatalog: (volumeId) =>
      Promise.resolve().then(() => {
        const drive = findDrive(drives, volumeId);
        assertSupported(drive);
        if (drive.catalogStatus !== "ready") {
          throw new AppError(
            APP_ERROR_CODES.CATALOG_NOT_FOUND,
            "No catalog was found on this drive",
          );
        }
        return mockCatalogSummary(drive);
      }),
    confirmDriveLetter: (volumeId) =>
      Promise.resolve().then(() => {
        const drive = findDrive(drives, volumeId);
        drive.pendingLetterChange = null;
        drive.rootPath = `${drive.letter ?? drive.rootPath}\\`;
        drive.lastSeenAt = "2026-10-31T14:41:00.000Z";
      }),
    ...scans,
  };

  return { ...client, ...options.overrides };
}
