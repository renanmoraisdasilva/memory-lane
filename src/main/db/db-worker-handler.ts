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
import type { RegisteredDrive } from "../modules/drives/domain/drive";
import {
  CatalogCreateParamsSchema,
  CatalogOpenParamsSchema,
  RegisterDriveParamsSchema,
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

export function createDbWorkerHandler(options: { appDbPath: string }): DbWorkerHandler {
  const appDb = openDatabase(options.appDbPath);
  runMigrations(appDb, appMigrations);

  let catalogDb: Database.Database | null = null;

  const closeCatalog = (): void => {
    if (catalogDb !== null) {
      catalogDb.close();
      catalogDb = null;
    }
  };

  const openCatalog = (filePath: string, identity: DriveIdentity): Database.Database => {
    if (!path.isAbsolute(filePath)) {
      throw new AppError(APP_ERROR_CODES.INVALID_REQUEST, "Catalog path must be absolute");
    }
    if (!fs.existsSync(filePath)) {
      throw new AppError(APP_ERROR_CODES.CATALOG_NOT_FOUND, "Catalog file was not found", {
        catalogPath: filePath,
      });
    }

    const db = openDatabase(filePath);
    try {
      runMigrations(db, catalogMigrations);
      ensureDriveIdentity(db, identity, 1);
    } catch (error) {
      db.close();
      throw error;
    }

    closeCatalog();
    catalogDb = db;
    return db;
  };

  const handleHealth = (): HealthResult => ({
    appDbPath: options.appDbPath,
    schemaVersion: getSchemaVersion(appDb),
  });

  const handleListDrives = (): RegisteredDrive[] => listRegisteredDrives(appDb);

  const handleRegisterDrive = (params: unknown): RegisteredDrive => {
    const parsed = RegisterDriveParamsSchema.parse(params);
    return registerDrive(appDb, parsed);
  };

  const handleCreateCatalog = (params: unknown): unknown => {
    const parsed = CatalogCreateParamsSchema.parse(params);
    if (!path.isAbsolute(parsed.catalogPath)) {
      throw new AppError(APP_ERROR_CODES.INVALID_REQUEST, "Catalog path must be absolute");
    }
    if (fs.existsSync(parsed.catalogPath)) {
      throw new AppError(APP_ERROR_CODES.CATALOG_ALREADY_EXISTS, "Catalog already exists");
    }

    fs.mkdirSync(path.dirname(parsed.catalogPath), { recursive: true });
    fs.mkdirSync(parsed.cachePath, { recursive: true });

    const db = openDatabase(parsed.catalogPath);
    try {
      runMigrations(db, catalogMigrations);
      ensureDriveIdentity(db, parsed.identity, parsed.catalogSchema);
    } catch (error) {
      db.close();
      throw error;
    }

    closeCatalog();
    catalogDb = db;
    return getCatalogSummary(db, parsed.catalogPath);
  };

  const handleOpenCatalog = (params: unknown): unknown => {
    const parsed = CatalogOpenParamsSchema.parse(params);
    const db = openCatalog(parsed.catalogPath, parsed.identity);
    return getCatalogSummary(db, parsed.catalogPath);
  };

  const handle = (method: DbMethod, params: unknown): unknown => {
    switch (method) {
      case "health":
        return handleHealth();
      case "app.listDrives":
        return handleListDrives();
      case "app.registerDrive":
        return handleRegisterDrive(params);
      case "catalog.create":
        return handleCreateCatalog(params);
      case "catalog.open":
        return handleOpenCatalog(params);
      case "close":
        closeCatalog();
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
      closeCatalog();
      if (appDb.open) {
        appDb.close();
      }
    },
  };
}
