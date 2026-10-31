import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import type { DriveIdentity } from "@shared/contracts/drives";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { openDatabase } from "./connection";
import { appMigrations } from "./migrations/app-migrations";
import { catalogMigrations } from "./migrations/catalog-migrations";
import { getSchemaVersion, runMigrations } from "./migrations/runner";
import { ensureDriveIdentity, getCatalogSummary } from "./repositories/catalog-repository";
import { listRegisteredDrives, registerDrive } from "./repositories/app-repository";
import { recoverInterruptedScans } from "./repositories/scan-session-repository";
import { createScanDbHandlers } from "./scan-db-handlers";
import { SCAN_DB_METHODS, type ScanDbMethod } from "./scan-worker-protocol";
import { createLibraryDbHandlers } from "./library-db-handlers";
import { LIBRARY_DB_METHODS, type LibraryDbMethod } from "./library-worker-protocol";
import { createHealthDbHandlers } from "./health-db-handlers";
import { HEALTH_DB_METHODS, type HealthDbMethod } from "./health-worker-protocol";
import { createSettingsDbHandlers } from "./settings-db-handlers";
import { SETTINGS_DB_METHODS, type SettingsDbMethod } from "./settings-worker-protocol";
import { acquireCatalogLock } from "../platform/catalog-lock";
import { CATALOG_SCHEMA_VERSION } from "./schema-version";
import {
  CatalogCreateParamsSchema,
  CatalogOpenParamsSchema,
  RegisterDriveParamsSchema,
  type CoreDbMethod,
  type DbMethod,
} from "./worker-protocol";

export interface DbWorkerHandler {
  handle(method: DbMethod, params: unknown): unknown;
  dispose(): void;
}

interface HealthResult {
  appDbPath: string;
  schemaVersion: number;
}

interface CatalogSession {
  open(
    filePath: string,
    identity: DriveIdentity,
    schemaVersion: number,
    create: boolean,
  ): Database.Database;
  get(): Database.Database;
  getPath(): string;
  close(): void;
}

function createCatalogSession(): CatalogSession {
  let catalogDb: Database.Database | null = null;
  let catalogFilePath: string | null = null;
  let releaseLock: (() => void) | null = null;

  const close = (): void => {
    if (catalogDb !== null) {
      catalogDb.close();
      catalogDb = null;
    }
    catalogFilePath = null;
    releaseLock?.();
    releaseLock = null;
  };

  const open = (
    filePath: string,
    identity: DriveIdentity,
    schemaVersion: number,
    create: boolean,
  ): Database.Database => {
    if (!path.isAbsolute(filePath)) {
      throw new AppError(APP_ERROR_CODES.INVALID_REQUEST, "Catalog path must be absolute");
    }

    const exists = fs.existsSync(filePath);
    if (create && exists) {
      throw new AppError(APP_ERROR_CODES.CATALOG_ALREADY_EXISTS, "Catalog already exists");
    }
    if (!create && !exists) {
      throw new AppError(APP_ERROR_CODES.CATALOG_NOT_FOUND, "Catalog file was not found", {
        catalogPath: filePath,
      });
    }

    close();
    const release = acquireCatalogLock(path.dirname(filePath));
    const db = openDatabase(filePath);
    try {
      runMigrations(db, catalogMigrations);
      ensureDriveIdentity(db, identity, schemaVersion);
      if (!create) {
        recoverInterruptedScans(db);
      }
    } catch (error) {
      db.close();
      release();
      throw error;
    }

    catalogDb = db;
    catalogFilePath = filePath;
    releaseLock = release;
    return db;
  };

  const get = (): Database.Database => {
    if (catalogDb === null) {
      throw new AppError(APP_ERROR_CODES.CATALOG_NOT_FOUND, "Open a catalog before scanning");
    }
    return catalogDb;
  };

  const getPath = (): string => {
    if (catalogFilePath === null) {
      throw new AppError(APP_ERROR_CODES.CATALOG_NOT_FOUND, "Open a catalog before browsing");
    }
    return catalogFilePath;
  };

  return { open, get, getPath, close };
}

export function createDbWorkerHandler(options: { appDbPath: string }): DbWorkerHandler {
  const appDb = openDatabase(options.appDbPath);
  runMigrations(appDb, appMigrations);
  const catalogs = createCatalogSession();
  const scanHandlers = createScanDbHandlers({
    getCatalog: () => catalogs.get(),
    getAppDb: () => appDb,
  });
  const libraryHandlers = createLibraryDbHandlers({
    getCatalog: () => catalogs.get(),
    getCatalogPath: () => catalogs.getPath(),
  });
  const healthHandlers = createHealthDbHandlers({
    getCatalog: () => catalogs.get(),
  });
  const settingsHandlers = createSettingsDbHandlers({
    getAppDb: () => appDb,
    getCatalog: () => catalogs.get(),
  });
  const domainHandlers = new Map<string, (params: unknown) => unknown>();
  for (const method of SCAN_DB_METHODS as readonly string[]) {
    domainHandlers.set(method, (params) => scanHandlers.handle(method as ScanDbMethod, params));
  }
  for (const method of LIBRARY_DB_METHODS as readonly string[]) {
    domainHandlers.set(method, (params) =>
      libraryHandlers.handle(method as LibraryDbMethod, params),
    );
  }
  for (const method of HEALTH_DB_METHODS as readonly string[]) {
    domainHandlers.set(method, (params) => healthHandlers.handle(method as HealthDbMethod, params));
  }
  for (const method of SETTINGS_DB_METHODS as readonly string[]) {
    domainHandlers.set(method, (params) =>
      settingsHandlers.handle(method as SettingsDbMethod, params),
    );
  }

  const handleCreateCatalog = (params: unknown): unknown => {
    const parsed = CatalogCreateParamsSchema.parse(params);
    if (!path.isAbsolute(parsed.catalogPath) || !path.isAbsolute(parsed.cachePath)) {
      throw new AppError(
        APP_ERROR_CODES.INVALID_REQUEST,
        "Catalog and cache paths must be absolute",
      );
    }

    fs.mkdirSync(path.dirname(parsed.catalogPath), { recursive: true });
    fs.mkdirSync(parsed.cachePath, { recursive: true });

    const db = catalogs.open(parsed.catalogPath, parsed.identity, parsed.catalogSchema, true);
    return getCatalogSummary(db, parsed.catalogPath);
  };

  const handleOpenCatalog = (params: unknown): unknown => {
    const parsed = CatalogOpenParamsSchema.parse(params);
    const db = catalogs.open(parsed.catalogPath, parsed.identity, CATALOG_SCHEMA_VERSION, false);
    return getCatalogSummary(db, parsed.catalogPath);
  };

  const handle = (method: DbMethod, params: unknown): unknown => {
    const domainHandler = domainHandlers.get(method);
    if (domainHandler !== undefined) {
      return domainHandler(params);
    }

    switch (method as CoreDbMethod) {
      case "health":
        return {
          appDbPath: options.appDbPath,
          schemaVersion: getSchemaVersion(appDb),
        } satisfies HealthResult;
      case "app.listDrives":
        return listRegisteredDrives(appDb);
      case "app.registerDrive":
        return registerDrive(appDb, RegisterDriveParamsSchema.parse(params));
      case "catalog.create":
        return handleCreateCatalog(params);
      case "catalog.open":
        return handleOpenCatalog(params);
      case "close":
        catalogs.close();
        appDb.close();
        return { closed: true };
      default:
        throw new AppError(
          APP_ERROR_CODES.INVALID_REQUEST,
          `Unknown database method: ${String(method)}`,
        );
    }
  };

  return {
    handle,
    dispose: () => {
      catalogs.close();
      if (appDb.open) {
        appDb.close();
      }
    },
  };
}
