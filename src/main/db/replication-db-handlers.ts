import path from "node:path";
import { randomUUID } from "node:crypto";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { CATALOG_SCHEMA_VERSION } from "./schema-version";
import {
  ensureDestinationIdentity,
  readArchiveIdentity,
} from "./repositories/archive-identity-repository";
import {
  findDestinationByDestinationId,
  findDestinationByVolume,
  getDestination,
  insertDestination,
  listDestinations,
  nextDestinationPriority,
  updateDestination,
  updateFullCopyStatus,
} from "./repositories/replication-destination-repository";
import { createReplicationAdoptionDbHandlers } from "./replication-adoption-db-handlers";
import { setReplicaStatus } from "./repositories/replication-adoption-files-repository";
import { createReplicationCoverageDbHandlers } from "./replication-coverage-db-handlers";
import { createReplicationSourceDbHandlers } from "./replication-source-db-handlers";
import { createReplicationDestinationLibraryDbHandlers } from "./replication-destination-library-db-handlers";
import { createReplicationRunDbHandlers } from "./replication-run-db-handlers";
import { createReplicationPromotionDbHandlers } from "./replication-promotion-db-handlers";
import { createDestinationLibraryMediaDbHandlers } from "./destination-library-media-db-handlers";
import type {
  ReplicationDbHandlerMap,
  ReplicationDbHandlerOptions,
} from "./replication-db-handler-options";
import {
  ReplicationDestinationIdParamsSchema,
  ReplicationDestinationKeyParamsSchema,
  ReplicationRegisterDestinationDbParamsSchema,
  ReplicationUpdateDestinationDbParamsSchema,
  ReplicationUpdateFullCopyStatusDbParamsSchema,
  ReplicationSetReplicaStatusDbParamsSchema,
  ReplicationVolumeParamsSchema,
  type ReplicationDbMethod,
} from "./replication-worker-protocol";

export interface ReplicationDbHandler {
  handle(method: ReplicationDbMethod, params: unknown): unknown;
}

function handleRegisterDestination(options: ReplicationDbHandlerOptions, params: unknown): unknown {
  const parsed = ReplicationRegisterDestinationDbParamsSchema.parse(params);
  if (!path.isAbsolute(parsed.destinationCatalogPath)) {
    throw new AppError(
      APP_ERROR_CODES.INVALID_REQUEST,
      "Destination catalog path must be absolute",
    );
  }
  if (!path.isAbsolute(parsed.mountRootPath)) {
    throw new AppError(APP_ERROR_CODES.INVALID_REQUEST, "Destination mount path must be absolute");
  }

  const source = options.getCatalog();
  const sourceIdentity = readArchiveIdentity(source);
  const localCatalogId = randomUUID();
  const destinationDb = options.getRegistry().openDestination({
    destinationId: parsed.destinationId,
    filePath: parsed.destinationCatalogPath,
    identity: {
      volumeId: parsed.volumeId,
      serialNumber: parsed.volumeSerial,
      label: parsed.label,
      fileSystem: parsed.fileSystem,
      rootPath: parsed.mountRootPath,
      letter: parsed.letter,
    },
    schemaVersion: CATALOG_SCHEMA_VERSION,
    createIfMissing: true,
  });

  ensureDestinationIdentity(destinationDb, {
    catalogId: localCatalogId,
    sourceCatalogId: sourceIdentity.catalogId,
    sourceLabel: sourceIdentity.label,
    label: parsed.label,
    now: parsed.now,
    schemaVersion: CATALOG_SCHEMA_VERSION,
  });

  const copyRootRelative =
    parsed.layout === "dedicated" ? path.join("Memory Lane", parsed.archiveFolderName) : null;
  return insertDestination(source, {
    destinationId: parsed.destinationId,
    volumeId: parsed.volumeId,
    volumeSerial: parsed.volumeSerial,
    label: parsed.label,
    rootRelative: parsed.rootRelative,
    copyRootRelative,
    archiveFolderName: parsed.archiveFolderName,
    goal: parsed.goal,
    layout: parsed.layout,
    localCatalogId,
    localCatalogRelative: path.join(".memorylane", "catalog.db"),
    sourceIndexRelative: null,
    allocationMode: parsed.allocationMode,
    allocationPercent: parsed.allocationPercent,
    allocationBytes: parsed.allocationBytes,
    reserveBytes: parsed.reserveBytes,
    priority: nextDestinationPriority(source),
    identityConfidence: "confirmed",
    now: parsed.now,
  });
}

function destinationHandlers(options: ReplicationDbHandlerOptions): ReplicationDbHandlerMap {
  return {
    "replication.listDestinations": () => listDestinations(options.getCatalog()),
    "replication.getDestination": (params) =>
      getDestination(
        options.getCatalog(),
        ReplicationDestinationIdParamsSchema.parse(params).destinationId,
      ),
    "replication.findDestinationByDestinationId": (params) =>
      findDestinationByDestinationId(
        options.getCatalog(),
        ReplicationDestinationKeyParamsSchema.parse(params).destinationId,
      ),
    "replication.findDestinationByVolume": (params) =>
      findDestinationByVolume(
        options.getCatalog(),
        ReplicationVolumeParamsSchema.parse(params).volumeId,
      ),
    "replication.getSourceIdentity": () => readArchiveIdentity(options.getCatalog()),
    "replication.updateDestination": (params) => {
      const parsed = ReplicationUpdateDestinationDbParamsSchema.parse(params);
      const update: Parameters<typeof updateDestination>[2] = {};
      if (parsed.goal !== undefined) update.goal = parsed.goal;
      if (parsed.allocationMode !== undefined) update.allocationMode = parsed.allocationMode;
      if (parsed.allocationPercent !== undefined) {
        update.allocationPercent = parsed.allocationPercent;
      }
      if (parsed.allocationBytes !== undefined) update.allocationBytes = parsed.allocationBytes;
      if (parsed.reserveBytes !== undefined) update.reserveBytes = parsed.reserveBytes;
      if (parsed.priority !== undefined) update.priority = parsed.priority;
      if (parsed.layout !== undefined) update.layout = parsed.layout;
      if (parsed.status !== undefined) update.status = parsed.status;
      return updateDestination(options.getCatalog(), parsed.destinationId, update);
    },
    "replication.registerDestination": (params) => handleRegisterDestination(options, params),
    "replication.updateFullCopyStatus": (params) => {
      const parsed = ReplicationUpdateFullCopyStatusDbParamsSchema.parse(params);
      updateFullCopyStatus(options.getCatalog(), parsed.destinationId, {
        status: parsed.status,
        shortfallFiles: parsed.shortfallFiles,
        shortfallBytes: parsed.shortfallBytes,
        now: parsed.now,
      });
      return { updated: true };
    },
    "replication.setReplicaStatus": (params) => {
      const parsed = ReplicationSetReplicaStatusDbParamsSchema.parse(params);
      setReplicaStatus(options.getCatalog(), {
        destinationRowId: parsed.destinationId,
        fileId: parsed.fileId,
        status: parsed.status,
        now: parsed.now,
        errorMessage: parsed.errorMessage,
      });
      return { updated: true };
    },
  };
}

export function createReplicationDbHandlers(
  options: ReplicationDbHandlerOptions,
): ReplicationDbHandler {
  const handlers: ReplicationDbHandlerMap = {
    ...destinationHandlers(options),
    ...createReplicationAdoptionDbHandlers(options),
    ...createReplicationSourceDbHandlers(options),
    ...createReplicationDestinationLibraryDbHandlers(options),
    ...createReplicationCoverageDbHandlers(options),
    ...createReplicationRunDbHandlers(options),
    ...createReplicationPromotionDbHandlers(options),
    ...createDestinationLibraryMediaDbHandlers(options),
  };

  return {
    handle(method: ReplicationDbMethod, params: unknown): unknown {
      const handler = handlers[method];
      if (handler === undefined) {
        throw new AppError(
          APP_ERROR_CODES.INVALID_REQUEST,
          `Unknown replication database method: ${method}`,
        );
      }
      return handler(params);
    },
  };
}
