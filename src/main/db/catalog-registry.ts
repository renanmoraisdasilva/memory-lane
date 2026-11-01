import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import type { DriveIdentity } from "@shared/contracts/drives";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { openDatabase } from "./connection";
import { runMigrations } from "./migrations/runner";
import { catalogMigrations } from "./migrations/catalog-migrations";
import { ensureDriveIdentity } from "./repositories/catalog-repository";
import { recoverInterruptedScans } from "./repositories/scan-session-repository";
import { markInterruptedAdoptions } from "./repositories/replication-adoption-repository";
import { markInterruptedRuns } from "./repositories/replication-run-repository";
import { acquireCatalogLock } from "../platform/catalog-lock";

interface CatalogSession {
  filePath: string;
  db: Database.Database;
  releaseLock: () => void;
}

interface SourceRef {
  current: CatalogSession | null;
}

export interface OpenSourceCatalogInput {
  filePath: string;
  identity: DriveIdentity;
  schemaVersion: number;
  create: boolean;
}

export interface OpenDestinationCatalogInput {
  destinationId: string;
  filePath: string;
  identity: DriveIdentity;
  schemaVersion: number;
  createIfMissing: boolean;
}

export interface CatalogRegistry {
  openSource(input: OpenSourceCatalogInput): Database.Database;
  getSource(): Database.Database;
  getSourcePath(): string;
  openDestination(input: OpenDestinationCatalogInput): Database.Database;
  getDestination(destinationId: string): Database.Database;
  getDestinationPath(destinationId: string): string;
  closeDestination(destinationId: string): void;
  closeAll(): void;
}

function normalizePath(filePath: string): string {
  const resolved = path.resolve(filePath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function openSession(input: {
  filePath: string;
  identity: DriveIdentity;
  schemaVersion: number;
  create: boolean;
}): CatalogSession {
  if (!path.isAbsolute(input.filePath)) {
    throw new AppError(APP_ERROR_CODES.INVALID_REQUEST, "Catalog path must be absolute");
  }
  const exists = fs.existsSync(input.filePath);
  if (input.create && exists) {
    throw new AppError(APP_ERROR_CODES.CATALOG_ALREADY_EXISTS, "Catalog already exists");
  }
  if (!input.create && !exists) {
    throw new AppError(APP_ERROR_CODES.CATALOG_NOT_FOUND, "Catalog file was not found", {
      catalogPath: input.filePath,
    });
  }

  const releaseLock = acquireCatalogLock(path.dirname(input.filePath));
  const db = openDatabase(input.filePath);
  try {
    runMigrations(db, catalogMigrations);
    ensureDriveIdentity(db, input.identity, input.schemaVersion);
    if (!input.create) {
      recoverInterruptedScans(db);
      const now = new Date().toISOString();
      markInterruptedAdoptions(db, now);
      markInterruptedRuns(db, now);
    }
  } catch (error) {
    db.close();
    releaseLock();
    throw error;
  }

  return { filePath: input.filePath, db, releaseLock };
}

function closeSession(session: CatalogSession): void {
  if (session.db.open) {
    session.db.close();
  }
  session.releaseLock();
}

function assertPathAvailable(
  source: SourceRef,
  pathToDestinationId: Map<string, string>,
  filePath: string,
): void {
  const key = normalizePath(filePath);
  if (source.current !== null && normalizePath(source.current.filePath) === key) {
    throw new AppError(
      APP_ERROR_CODES.INVALID_REQUEST,
      "The source catalog cannot also be opened as a destination",
    );
  }
  if (pathToDestinationId.has(key)) {
    throw new AppError(APP_ERROR_CODES.INVALID_REQUEST, "Catalog is already open as a destination");
  }
}

function openSource(
  source: SourceRef,
  pathToDestinationId: Map<string, string>,
  input: OpenSourceCatalogInput,
): Database.Database {
  const key = normalizePath(input.filePath);
  if (source.current !== null) {
    closeSession(source.current);
    source.current = null;
  }
  if (pathToDestinationId.has(key)) {
    throw new AppError(
      APP_ERROR_CODES.INVALID_REQUEST,
      "The catalog is already open as a destination",
    );
  }
  source.current = openSession(input);
  return source.current.db;
}

function openDestination(
  source: SourceRef,
  destinations: Map<string, CatalogSession>,
  pathToDestinationId: Map<string, string>,
  input: OpenDestinationCatalogInput,
): Database.Database {
  const existing = destinations.get(input.destinationId);
  if (
    existing !== undefined &&
    normalizePath(existing.filePath) === normalizePath(input.filePath)
  ) {
    return existing.db;
  }
  assertPathAvailable(source, pathToDestinationId, input.filePath);
  if (existing !== undefined) {
    closeSession(existing);
    pathToDestinationId.delete(normalizePath(existing.filePath));
  }
  const exists = fs.existsSync(input.filePath);
  const session = openSession({
    filePath: input.filePath,
    identity: input.identity,
    schemaVersion: input.schemaVersion,
    create: !exists && input.createIfMissing,
  });
  destinations.set(input.destinationId, session);
  pathToDestinationId.set(normalizePath(input.filePath), input.destinationId);
  return session.db;
}

export function createCatalogRegistry(): CatalogRegistry {
  const source: SourceRef = { current: null };
  const destinations = new Map<string, CatalogSession>();
  const pathToDestinationId = new Map<string, string>();

  const requireSource = (): CatalogSession => {
    if (source.current === null) {
      throw new AppError(APP_ERROR_CODES.CATALOG_NOT_FOUND, "Open a catalog before using it");
    }
    return source.current;
  };

  const requireDestination = (destinationId: string): CatalogSession => {
    const session = destinations.get(destinationId);
    if (session === undefined) {
      throw new AppError(APP_ERROR_CODES.DESTINATION_NOT_FOUND, "Destination catalog is not open", {
        destinationId,
      });
    }
    return session;
  };

  return {
    openSource: (input) => openSource(source, pathToDestinationId, input),
    getSource: () => requireSource().db,
    getSourcePath: () => requireSource().filePath,
    openDestination: (input) => openDestination(source, destinations, pathToDestinationId, input),
    getDestination: (destinationId) => requireDestination(destinationId).db,
    getDestinationPath: (destinationId) => requireDestination(destinationId).filePath,
    closeDestination(destinationId) {
      const session = destinations.get(destinationId);
      if (session === undefined) {
        return;
      }
      destinations.delete(destinationId);
      pathToDestinationId.delete(normalizePath(session.filePath));
      closeSession(session);
    },
    closeAll() {
      if (source.current !== null) {
        closeSession(source.current);
        source.current = null;
      }
      for (const session of destinations.values()) {
        closeSession(session);
      }
      destinations.clear();
      pathToDestinationId.clear();
    },
  };
}
