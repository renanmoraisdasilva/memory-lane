import path from "node:path";
import { toVolumeId } from "@shared/contracts/drives";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { CATALOG_SCHEMA_VERSION } from "./schema-version";
import { getDestination } from "./repositories/replication-destination-repository";
import {
  getDestinationLibraryStats,
  upsertDestinationLibraryFiles,
} from "./repositories/replication-destination-library-repository";
import type {
  ReplicationDbHandlerMap,
  ReplicationDbHandlerOptions,
} from "./replication-db-handler-options";
import {
  ReplicationDestinationLibraryParamsSchema,
  ReplicationUpsertDestinationLibraryDbParamsSchema,
} from "./replication-worker-protocol";

export function openDestinationCatalog(
  options: ReplicationDbHandlerOptions,
  destinationRowId: number,
  root: string,
) {
  if (!path.isAbsolute(root)) {
    throw new AppError(APP_ERROR_CODES.INVALID_REQUEST, "Destination root must be absolute");
  }
  const record = getDestination(options.getCatalog(), destinationRowId);
  const catalogRelative = record.localCatalogRelative ?? path.join(".memorylane", "catalog.db");
  return options.getRegistry().openDestination({
    destinationId: record.destinationId,
    filePath: path.resolve(root, catalogRelative),
    identity: {
      volumeId: toVolumeId(record.volumeId),
      serialNumber: record.volumeSerial,
      label: record.label,
      fileSystem: "unknown",
      rootPath: root,
      letter: null,
    },
    schemaVersion: CATALOG_SCHEMA_VERSION,
    createIfMissing: true,
  });
}

export function createReplicationDestinationLibraryDbHandlers(
  options: ReplicationDbHandlerOptions,
): ReplicationDbHandlerMap {
  return {
    "replication.upsertDestinationLibrary": (params) => {
      const parsed = ReplicationUpsertDestinationLibraryDbParamsSchema.parse(params);
      const destinationDb = openDestinationCatalog(
        options,
        parsed.destinationId,
        parsed.destinationRoot,
      );
      upsertDestinationLibraryFiles(destinationDb, {
        destinationRoot: parsed.destinationRoot,
        files: parsed.files,
        runStartedAt: parsed.runStartedAt,
        now: parsed.now,
      });
      return getDestinationLibraryStats(destinationDb);
    },
    "replication.getDestinationLibraryStats": (params) => {
      const parsed = ReplicationDestinationLibraryParamsSchema.parse(params);
      const destinationDb = openDestinationCatalog(
        options,
        parsed.destinationId,
        parsed.destinationRoot,
      );
      return getDestinationLibraryStats(destinationDb);
    },
    "replication.saveDestinationLibraryFile": (params) => {
      const parsed = ReplicationUpsertDestinationLibraryDbParamsSchema.parse(params);
      const destinationDb = openDestinationCatalog(
        options,
        parsed.destinationId,
        parsed.destinationRoot,
      );
      upsertDestinationLibraryFiles(destinationDb, {
        destinationRoot: parsed.destinationRoot,
        files: parsed.files,
        runStartedAt: parsed.runStartedAt,
        now: parsed.now,
        markMissingBefore: null,
      });
      return getDestinationLibraryStats(destinationDb);
    },
  };
}
