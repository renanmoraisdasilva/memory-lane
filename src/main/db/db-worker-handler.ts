import fs from "node:fs";
import path from "node:path";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { createCatalogRegistry } from "./catalog-registry";
import { openDatabase } from "./connection";
import { appMigrations } from "./migrations/app-migrations";
import { getSchemaVersion, runMigrations } from "./migrations/runner";
import { getCatalogSummary } from "./repositories/catalog-repository";
import { listRegisteredDrives, registerDrive } from "./repositories/app-repository";
import { createScanDbHandlers } from "./scan-db-handlers";
import { SCAN_DB_METHODS, type ScanDbMethod } from "./scan-worker-protocol";
import { createLibraryDbHandlers } from "./library-db-handlers";
import { LIBRARY_DB_METHODS, type LibraryDbMethod } from "./library-worker-protocol";
import { createHealthDbHandlers } from "./health-db-handlers";
import { HEALTH_DB_METHODS, type HealthDbMethod } from "./health-worker-protocol";
import { createSettingsDbHandlers } from "./settings-db-handlers";
import { SETTINGS_DB_METHODS, type SettingsDbMethod } from "./settings-worker-protocol";
import { createReplicationDbHandlers } from "./replication-db-handlers";
import { REPLICATION_DB_METHODS, type ReplicationDbMethod } from "./replication-worker-protocol";
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

function createDomainHandlerMap(handlers: {
  scan: ReturnType<typeof createScanDbHandlers>;
  library: ReturnType<typeof createLibraryDbHandlers>;
  health: ReturnType<typeof createHealthDbHandlers>;
  settings: ReturnType<typeof createSettingsDbHandlers>;
  replication: ReturnType<typeof createReplicationDbHandlers>;
}): Map<string, (params: unknown) => unknown> {
  const map = new Map<string, (params: unknown) => unknown>();
  for (const method of SCAN_DB_METHODS as readonly string[]) {
    map.set(method, (params) => handlers.scan.handle(method as ScanDbMethod, params));
  }
  for (const method of LIBRARY_DB_METHODS as readonly string[]) {
    map.set(method, (params) => handlers.library.handle(method as LibraryDbMethod, params));
  }
  for (const method of HEALTH_DB_METHODS as readonly string[]) {
    map.set(method, (params) => handlers.health.handle(method as HealthDbMethod, params));
  }
  for (const method of SETTINGS_DB_METHODS as readonly string[]) {
    map.set(method, (params) => handlers.settings.handle(method as SettingsDbMethod, params));
  }
  for (const method of REPLICATION_DB_METHODS as readonly string[]) {
    map.set(method, (params) => handlers.replication.handle(method as ReplicationDbMethod, params));
  }
  return map;
}

export function createDbWorkerHandler(options: { appDbPath: string }): DbWorkerHandler {
  const appDb = openDatabase(options.appDbPath);
  runMigrations(appDb, appMigrations);
  const catalogs = createCatalogRegistry();
  const scanHandlers = createScanDbHandlers({
    getCatalog: () => catalogs.getSource(),
    getAppDb: () => appDb,
  });
  const libraryHandlers = createLibraryDbHandlers({
    getCatalog: () => catalogs.getSource(),
    getCatalogPath: () => catalogs.getSourcePath(),
  });
  const healthHandlers = createHealthDbHandlers({
    getCatalog: () => catalogs.getSource(),
  });
  const settingsHandlers = createSettingsDbHandlers({
    getAppDb: () => appDb,
    getCatalog: () => catalogs.getSource(),
  });
  const replicationHandlers = createReplicationDbHandlers({
    getCatalog: () => catalogs.getSource(),
    getCatalogPath: () => catalogs.getSourcePath(),
    getRegistry: () => catalogs,
  });
  const domainHandlers = createDomainHandlerMap({
    scan: scanHandlers,
    library: libraryHandlers,
    health: healthHandlers,
    settings: settingsHandlers,
    replication: replicationHandlers,
  });

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

    const db = catalogs.openSource({
      filePath: parsed.catalogPath,
      identity: parsed.identity,
      schemaVersion: parsed.catalogSchema,
      create: true,
    });
    return getCatalogSummary(db, parsed.catalogPath);
  };

  const handleOpenCatalog = (params: unknown): unknown => {
    const parsed = CatalogOpenParamsSchema.parse(params);
    const db = catalogs.openSource({
      filePath: parsed.catalogPath,
      identity: parsed.identity,
      schemaVersion: CATALOG_SCHEMA_VERSION,
      create: false,
    });
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
        catalogs.closeAll();
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
      catalogs.closeAll();
      if (appDb.open) {
        appDb.close();
      }
    },
  };
}
