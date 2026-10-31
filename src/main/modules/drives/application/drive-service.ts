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

export class DriveService {
  private readonly db: DbClient;
  private readonly listDetected: () => Promise<DetectedDrive[]>;
  private readonly logger: Logger;
  private readonly now: () => Date;

  constructor(dependencies: DriveServiceDependencies) {
    this.db = dependencies.db;
    this.listDetected = dependencies.listDetected;
    this.logger = dependencies.logger;
    this.now = dependencies.now ?? (() => new Date());
  }

  async listDrives(): Promise<DriveInfo[]> {
    const [detected, registered] = await Promise.all([
      this.listDetected(),
      this.db.request<RegisteredDrive[]>("app.listDrives", {}),
    ]);
    const registeredByVolume = new Map(registered.map((drive) => [drive.volumeId, drive]));

    return Promise.all(
      detected.map(async (drive) => {
        const registration = registeredByVolume.get(drive.volumeId);
        const hasCatalog = await pathExists(getCatalogPaths(drive.rootPath).catalogPath);
        const catalogStatus = hasCatalog ? "ready" : registration ? "registered" : "none";

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
          catalogStatus,
          lastSeenAt: registration?.lastSeenAt ?? null,
        };
      }),
    );
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

    const summary = await this.db.request<CatalogSummary>("catalog.open", {
      catalogPath: paths.catalogPath,
      identity: toDriveIdentity(drive),
    });

    await this.registerDrive(drive);
    this.logger.info("Catalog opened", { volumeId, catalogPath: summary.catalogPath });
    return summary;
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
