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
import { acquireCatalogLock } from "../platform/catalog-lock";
import { CATALOG_SCHEMA_VERSION } from "./schema-version";
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

interface CatalogSession {
  open(
    filePath: string,
    identity: DriveIdentity,
    schemaVersion: number,
    create: boolean,
  ): Database.Database;
  close(): void;
}

function createCatalogSession(): CatalogSession {
  let catalogDb: Database.Database | null = null;
  let releaseLock: (() => void) | null = null;

  const close = (): void => {
    if (catalogDb !== null) {
      catalogDb.close();
      catalogDb = null;
    }
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
    } catch (error) {
      db.close();
      release();
      throw error;
    }

    catalogDb = db;
    releaseLock = release;
    return db;
  };

  return { open, close };
}

export function createDbWorkerHandler(options: { appDbPath: string }): DbWorkerHandler {
  const appDb = openDatabase(options.appDbPath);
  runMigrations(appDb, appMigrations);
  const catalogs = createCatalogSession();

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
    switch (method) {
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
