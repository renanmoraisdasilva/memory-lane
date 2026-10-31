import fs from "node:fs/promises";
import path from "node:path";
import type { CatalogSummary, DriveInfo, VolumeId } from "@shared/contracts/drives";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { DbClient } from "../../../clients/db-client";
import { CATALOG_SCHEMA_VERSION } from "../../../db/schema-version";
import { assertPathInside } from "../../../platform/path-guard";
import type { Logger } from "../../../logging/types";
import type { DetectedDrive, RegisteredDrive } from "../domain/drive";
import { toDriveIdentity } from "../domain/drive";

export interface CatalogPaths {
  appDirectory: string;
  catalogPath: string;
  cachePath: string;
}

export interface DriveServiceDependencies {
  db: DbClient;
  listDetected: () => Promise<DetectedDrive[]>;
  logger: Logger;
  now?: () => Date;
  onBeforeCatalogChange?: () => Promise<void>;
}

export function getCatalogPaths(rootPath: string): CatalogPaths {
  const root = path.resolve(rootPath);
  const appDirectory = path.join(root, ".memorylane");
  assertPathInside(root, appDirectory);

  return {
    appDirectory,
    catalogPath: path.join(appDirectory, "catalog.db"),
    cachePath: path.join(appDirectory, "cache"),
  };
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function catalogStatusFor(
  hasCatalog: boolean,
  registered: boolean,
): "none" | "registered" | "ready" {
  if (hasCatalog) {
    return "ready";
  }
  return registered ? "registered" : "none";
}

function registrationDefaults(registration: RegisteredDrive | undefined): {
  lastSeenAt: string | null;
  lastLetter: string | null;
  lastScanAt: string | null;
  indexedFiles: number;
} {
  if (registration === undefined) {
    return { lastSeenAt: null, lastLetter: null, lastScanAt: null, indexedFiles: 0 };
  }
  return {
    lastSeenAt: registration.lastSeenAt,
    lastLetter: registration.lastLetter,
    lastScanAt: registration.lastScanAt,
    indexedFiles: registration.indexedFiles,
  };
}

function letterChanged(current: string | null, previous: string | null): boolean {
  return current !== null && previous !== null && current !== previous;
}

async function toConnectedDrive(
  drive: DetectedDrive,
  registration: RegisteredDrive | undefined,
): Promise<DriveInfo> {
  const hasCatalog = await pathExists(getCatalogPaths(drive.rootPath).catalogPath);
  const registered = registrationDefaults(registration);
  return {
    volumeId: drive.volumeId,
    label: drive.label,
    letter: drive.letter,
    rootPath: drive.rootPath,
    fileSystem: drive.fileSystem,
    serialNumber: drive.serialNumber,
    totalBytes: drive.totalBytes,
    freeBytes: drive.freeBytes,
    driveType: drive.driveType,
    isExternal: drive.isExternal,
    catalogStatus: catalogStatusFor(hasCatalog, registration !== undefined),
    lastSeenAt: registered.lastSeenAt,
    isConnected: true,
    lastLetter: registered.lastLetter,
    lastScanAt: registered.lastScanAt,
    indexedFiles: registered.indexedFiles,
    requiresLetterConfirmation: letterChanged(drive.letter, registered.lastLetter),
  };
}

function toOfflineDrive(drive: RegisteredDrive): DriveInfo {
  return {
    volumeId: drive.volumeId,
    label: drive.label,
    letter: drive.lastLetter,
    rootPath: drive.rootPath,
    fileSystem: drive.fileSystem,
    serialNumber: drive.volumeSerial,
    totalBytes: 0,
    freeBytes: 0,
    driveType: "unknown",
    isExternal: true,
    catalogStatus: "registered",
    lastSeenAt: drive.lastSeenAt,
    isConnected: false,
    lastLetter: drive.lastLetter,
    lastScanAt: drive.lastScanAt,
    indexedFiles: drive.indexedFiles,
  };
}

export class DriveService {
  private readonly db: DbClient;
  private readonly listDetected: () => Promise<DetectedDrive[]>;
  private readonly logger: Logger;
  private readonly now: () => Date;
  private readonly onBeforeCatalogChange: (() => Promise<void>) | undefined;

  constructor(dependencies: DriveServiceDependencies) {
    this.db = dependencies.db;
    this.listDetected = dependencies.listDetected;
    this.logger = dependencies.logger;
    this.now = dependencies.now ?? (() => new Date());
    this.onBeforeCatalogChange = dependencies.onBeforeCatalogChange;
  }

  async listDrives(): Promise<DriveInfo[]> {
    const [detected, registered] = await Promise.all([
      this.listDetected(),
      this.db.request<RegisteredDrive[]>("app.listDrives", {}),
    ]);
    const registeredByVolume = new Map(registered.map((drive) => [drive.volumeId, drive]));
    const connectedVolumes = new Set(detected.map((drive) => drive.volumeId));

    const connected = await Promise.all(
      detected.map(async (drive) =>
        toConnectedDrive(drive, registeredByVolume.get(drive.volumeId)),
      ),
    );

    const offline = registered
      .filter((drive) => !connectedVolumes.has(drive.volumeId))
      .map(toOfflineDrive);

    return [...connected, ...offline];
  }

  async initializeCatalog(volumeId: VolumeId): Promise<CatalogSummary> {
    const drive = await this.resolveDrive(volumeId);
    this.assertSupported(drive);
    const paths = getCatalogPaths(drive.rootPath);

    if (await pathExists(paths.catalogPath)) {
      throw new AppError(
        APP_ERROR_CODES.CATALOG_ALREADY_EXISTS,
        "This drive already has a catalog",
        {
          catalogPath: paths.catalogPath,
        },
      );
    }

    await fs.mkdir(paths.appDirectory, { recursive: true });
    await fs.mkdir(paths.cachePath, { recursive: true });
    await this.onBeforeCatalogChange?.();

    const identity = toDriveIdentity(drive);
    const summary = await this.db.request<CatalogSummary>("catalog.create", {
      catalogPath: paths.catalogPath,
      cachePath: paths.cachePath,
      identity,
      catalogSchema: CATALOG_SCHEMA_VERSION,
    });

    await this.registerDrive(drive);
    this.logger.info("Catalog initialized", { volumeId, catalogPath: summary.catalogPath });
    return summary;
  }

  async openCatalog(volumeId: VolumeId): Promise<CatalogSummary> {
    const drive = await this.resolveDrive(volumeId);
    this.assertSupported(drive);
    const paths = getCatalogPaths(drive.rootPath);

    if (!(await pathExists(paths.catalogPath))) {
      throw new AppError(APP_ERROR_CODES.CATALOG_NOT_FOUND, "No catalog was found on this drive", {
        catalogPath: paths.catalogPath,
      });
    }

    await this.onBeforeCatalogChange?.();
    const summary = await this.db.request<CatalogSummary>("catalog.open", {
      catalogPath: paths.catalogPath,
      identity: toDriveIdentity(drive),
    });

    await this.registerDrive(drive);
    this.logger.info("Catalog opened", { volumeId, catalogPath: summary.catalogPath });
    return summary;
  }

  async confirmDriveIdentity(volumeId: VolumeId): Promise<void> {
    const drive = await this.resolveDrive(volumeId);
    this.assertSupported(drive);
    const paths = getCatalogPaths(drive.rootPath);

    if (!(await pathExists(paths.catalogPath))) {
      throw new AppError(APP_ERROR_CODES.CATALOG_NOT_FOUND, "No catalog was found on this drive", {
        catalogPath: paths.catalogPath,
      });
    }

    await this.registerDrive(drive);
    this.logger.info("Drive identity confirmed", { volumeId, rootPath: drive.rootPath });
  }

  private async resolveDrive(volumeId: VolumeId): Promise<DetectedDrive> {
    const drives = await this.listDetected();
    const drive = drives.find((candidate) => candidate.volumeId === volumeId);
    if (drive === undefined) {
      throw new AppError(
        APP_ERROR_CODES.DRIVE_NOT_FOUND,
        "The selected drive is no longer connected",
      );
    }
    return drive;
  }

  private assertSupported(drive: DetectedDrive): void {
    if (drive.driveType === "unknown" || !drive.isExternal) {
      throw new AppError(
        APP_ERROR_CODES.DRIVE_UNSUPPORTED,
        "Select an external drive. The Windows system drive is not supported.",
        { volumeId: drive.volumeId },
      );
    }
  }

  private async registerDrive(drive: DetectedDrive): Promise<void> {
    await this.db.request<RegisteredDrive>("app.registerDrive", {
      identity: toDriveIdentity(drive),
      lastSeenAt: this.now().toISOString(),
      catalogSchema: CATALOG_SCHEMA_VERSION,
    });
  }
}
