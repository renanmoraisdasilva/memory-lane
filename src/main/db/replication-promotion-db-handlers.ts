import path from "node:path";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { CATALOG_SCHEMA_VERSION } from "./schema-version";
import { readArchiveIdentity } from "./repositories/archive-identity-repository";
import {
  findDestinationByDestinationId,
  listDestinations,
} from "./repositories/replication-destination-repository";
import {
  getLatestCompletedPromotion,
  getLatestPromotionForDestination,
  getPromotion,
  insertPromotion,
} from "./repositories/replication-promotion-repository";
import type { PromotionRecord } from "./repositories/replication-promotion-types";
import { mergePromotion } from "./repositories/promotion-merge";
import type {
  ReplicationDbHandlerMap,
  ReplicationDbHandlerOptions,
} from "./replication-db-handler-options";
import {
  catalogRoot,
  readIdentityFromCatalog,
  readRollbackMarker,
  removeRollbackMarker,
  replaceCatalog,
  restoreCatalogs,
  snapshotPaths,
  writeRollbackMarker,
  type RollbackMarker,
} from "./promotion-snapshot-files";
import {
  PromotionApplyDbParamsSchema,
  PromotionCloseWindowDbParamsSchema,
  PromotionLatestDbParamsSchema,
  PromotionListReplicaFilesDbParamsSchema,
  PromotionRecordDbParamsSchema,
  PromotionRollbackDbParamsSchema,
} from "./replication-worker-protocol";
function latestHandlers(options: ReplicationDbHandlerOptions): ReplicationDbHandlerMap {
  return {
    "promotion.getLatest": (params) => {
      const parsed = PromotionLatestDbParamsSchema.parse(params);
      const promotion = getLatestPromotionForDestination(options.getCatalog(), parsed.toVolumeId);
      const marker =
        parsed.destinationRootPath === null ? null : readRollbackMarker(parsed.destinationRootPath);
      const windowOpen =
        marker !== null &&
        marker.available &&
        (promotion === null || marker.promotionId === promotion.id);
      return { promotion, windowOpen };
    },
    "promotion.listReplicaFiles": (params) => {
      const parsed = PromotionListReplicaFilesDbParamsSchema.parse(params);
      const record = findDestinationByDestinationId(options.getCatalog(), parsed.destinationId);
      if (record === null) {
        throw new AppError(APP_ERROR_CODES.DESTINATION_NOT_FOUND, "Destination was not found");
      }
      return options
        .getCatalog()
        .prepare(
          `SELECT rf.replica_id AS destination_row_id, rf.file_id, rf.relative_path,
                  rf.source_relative_path, rf.sha256,
                  rf.destination_size_at_verify, rf.destination_modified_at_fs_at_verify,
                  f.size AS source_size, f.modified_at_fs AS source_modified_at_fs, f.state
           FROM replica_files rf
           JOIN files f ON f.id = rf.file_id
           WHERE rf.replica_id = ? AND rf.status = 'verified'`,
        )
        .all(record.id);
    },
  };
}

function recordHandlers(options: ReplicationDbHandlerOptions): ReplicationDbHandlerMap {
  return {
    "promotion.record": (params) => {
      const parsed = PromotionRecordDbParamsSchema.parse(params);
      const record = findDestinationByDestinationId(options.getCatalog(), parsed.destinationId);
      if (record === null) {
        throw new AppError(APP_ERROR_CODES.DESTINATION_NOT_FOUND, "Destination was not found");
      }
      const identity = readArchiveIdentity(options.getCatalog());
      return insertPromotion(options.getCatalog(), {
        catalogId: identity.catalogId,
        fromVolumeId: identity.activeSourceVolumeId,
        toVolumeId: record.volumeId,
        status: "verified",
        startedAt: parsed.now,
        completedAt: null,
        rolledBackAt: null,
        fromSourceRootRelative: identity.sourceRootRelative,
        toSourceRootRelative: record.copyRootRelative ?? "",
        sourceSnapshotPath: "",
        destinationSnapshotPath: "",
        verifiedFiles: parsed.verifiedFiles,
        verifiedBytes: parsed.verifiedBytes,
        shortfallFiles: parsed.shortfallFiles,
        shortfallBytes: parsed.shortfallBytes,
        errorMessage: null,
      });
    },
  };
}

async function applyPromotion(
  options: ReplicationDbHandlerOptions,
  params: unknown,
): Promise<unknown> {
  const parsed = PromotionApplyDbParamsSchema.parse(params);
  const source = options.getCatalog();
  const sourcePath = options.getCatalogPath();
  const record = findDestinationByDestinationId(source, parsed.destinationId);
  if (record === null) {
    throw new AppError(APP_ERROR_CODES.DESTINATION_NOT_FOUND, "Destination was not found");
  }
  const destinationCatalogPath = path.join(
    parsed.destinationRootPath,
    record.localCatalogRelative ?? path.join(".memorylane", "catalog.db"),
  );
  const destination = options.getRegistry().openDestination({
    destinationId: parsed.destinationId,
    filePath: destinationCatalogPath,
    identity: {
      volumeId: parsed.destinationVolumeId,
      serialNumber: parsed.destinationVolumeSerial,
      label: parsed.destinationLabel,
      fileSystem: parsed.destinationFileSystem,
      rootPath: parsed.destinationRootPath,
      letter: null,
    },
    schemaVersion: CATALOG_SCHEMA_VERSION,
    createIfMissing: false,
  });
  const snapshots = snapshotPaths(sourcePath, destinationCatalogPath);
  await source.backup(snapshots.source);
  await destination.backup(snapshots.destination);
  try {
    const result = mergePromotion({
      source,
      destination,
      sourceCatalogPath: sourcePath,
      destinationCatalogPath,
      destinationId: parsed.destinationId,
      oldSourceFate: parsed.oldSourceFate,
      partialFates: parsed.partialFates,
      oldSourceFits: parsed.oldSourceFits,
      sourceSnapshotPath: snapshots.source,
      destinationSnapshotPath: snapshots.destination,
      now: parsed.now,
      schemaVersion: CATALOG_SCHEMA_VERSION,
    });
    const destinations = listDestinations(destination);
    writeRollbackMarker(parsed.destinationRootPath, {
      schemaVersion: 1,
      promotionId: result.promotion.id,
      catalogId: result.catalogId,
      openedAt: parsed.now,
      available: true,
    });
    options.getRegistry().closeDestination(parsed.destinationId);
    return { ...result, destinations };
  } catch (error) {
    restoreCatalogs(options, {
      sourcePath,
      destinationPath: destinationCatalogPath,
      sourceSnapshot: snapshots.source,
      destinationSnapshot: snapshots.destination,
    });
    throw new AppError(
      APP_ERROR_CODES.PROMOTION_FAILED,
      error instanceof Error ? error.message : "Promotion failed",
    );
  }
}

function isCompletedPromotion(promotion: PromotionRecord | null): promotion is PromotionRecord & {
  sourceSnapshotPath: string;
  destinationSnapshotPath: string;
} {
  return (
    promotion !== null &&
    promotion.status === "completed" &&
    promotion.sourceSnapshotPath !== null &&
    promotion.destinationSnapshotPath !== null
  );
}

function resolveRollbackPromotion(
  options: ReplicationDbHandlerOptions,
  promotionId: number,
): PromotionRecord & { sourceSnapshotPath: string; destinationSnapshotPath: string } {
  let promotion: PromotionRecord | null = null;
  try {
    promotion = getPromotion(options.getCatalog(), promotionId);
  } catch {
    promotion = null;
  }
  const resolved = isCompletedPromotion(promotion)
    ? promotion
    : getLatestCompletedPromotion(options.getCatalog());
  if (!isCompletedPromotion(resolved)) {
    throw new AppError(
      APP_ERROR_CODES.PROMOTION_BLOCKED,
      "Only a completed promotion can be rolled back",
    );
  }
  return resolved;
}

function resolveRollbackTarget(
  options: ReplicationDbHandlerOptions,
  promotion: PromotionRecord,
  promotionRootPath: string | null,
): { newCatalogPath: string; marker: RollbackMarker } {
  const sourcePath = options.getCatalogPath();
  const sourceRoot = catalogRoot(sourcePath);
  let marker = readRollbackMarker(sourceRoot);
  let newCatalogPath = sourcePath;
  if (
    (marker === null || !marker.available) &&
    promotionRootPath !== null &&
    promotionRootPath !== sourceRoot
  ) {
    const candidate = readRollbackMarker(promotionRootPath);
    if (candidate !== null && candidate.available) {
      marker = candidate;
      newCatalogPath = path.join(promotionRootPath, ".memorylane", "catalog.db");
    }
  }
  if (marker === null || !marker.available || marker.catalogId !== promotion.catalogId) {
    throw new AppError(
      APP_ERROR_CODES.PROMOTION_BLOCKED,
      "Rollback is available only before the first change to the new source archive.",
    );
  }
  return { newCatalogPath, marker };
}

function restoreAndReopen(
  options: ReplicationDbHandlerOptions,
  promotion: PromotionRecord & { sourceSnapshotPath: string; destinationSnapshotPath: string },
  newCatalogPath: string,
): { oldCatalogPath: string; restoredSourceVolumeId: string; restoredSourceLabel: string } {
  const oldCatalogPath = path.join(
    path.dirname(path.dirname(promotion.sourceSnapshotPath)),
    "catalog.db",
  );
  const currentRoot = catalogRoot(options.getCatalogPath());
  options.getRegistry().closeAll();
  replaceCatalog(promotion.sourceSnapshotPath, oldCatalogPath);
  replaceCatalog(promotion.destinationSnapshotPath, newCatalogPath);
  removeRollbackMarker(catalogRoot(newCatalogPath));
  removeRollbackMarker(currentRoot);
  const identity = readIdentityFromCatalog(oldCatalogPath);
  options.getRegistry().openSource({
    filePath: oldCatalogPath,
    identity,
    schemaVersion: CATALOG_SCHEMA_VERSION,
    create: false,
  });
  return {
    oldCatalogPath,
    restoredSourceVolumeId: identity.volumeId,
    restoredSourceLabel: identity.label,
  };
}

function rollbackHandler(options: ReplicationDbHandlerOptions, params: unknown): unknown {
  const parsed = PromotionRollbackDbParamsSchema.parse(params);
  const promotion = resolveRollbackPromotion(options, parsed.promotionId);
  const target = resolveRollbackTarget(options, promotion, parsed.promotionRootPath);
  const restored = restoreAndReopen(options, promotion, target.newCatalogPath);
  const rolled = insertPromotion(options.getCatalog(), {
    catalogId: promotion.catalogId,
    fromVolumeId: promotion.fromVolumeId,
    toVolumeId: promotion.toVolumeId,
    status: "rolled_back",
    startedAt: promotion.startedAt ?? parsed.now,
    completedAt: promotion.completedAt,
    rolledBackAt: parsed.now,
    fromSourceRootRelative: promotion.fromSourceRootRelative ?? "",
    toSourceRootRelative: promotion.toSourceRootRelative ?? "",
    sourceSnapshotPath: promotion.sourceSnapshotPath,
    destinationSnapshotPath: promotion.destinationSnapshotPath,
    verifiedFiles: promotion.verifiedFiles,
    verifiedBytes: promotion.verifiedBytes,
    shortfallFiles: promotion.shortfallFiles,
    shortfallBytes: promotion.shortfallBytes,
    errorMessage: null,
  });
  return {
    promotion: rolled,
    restoredSourceVolumeId: restored.restoredSourceVolumeId,
    restoredSourceLabel: restored.restoredSourceLabel,
  };
}

function windowHandlers(options: ReplicationDbHandlerOptions): ReplicationDbHandlerMap {
  return {
    "promotion.closeWindow": (params) => {
      PromotionCloseWindowDbParamsSchema.parse(params);
      const root = catalogRoot(options.getCatalogPath());
      const marker = readRollbackMarker(root);
      if (marker !== null && marker.available) {
        writeRollbackMarker(root, { ...marker, available: false });
      }
      return { closed: true };
    },
  };
}

function promotionHandlers(options: ReplicationDbHandlerOptions): ReplicationDbHandlerMap {
  return {
    ...latestHandlers(options),
    ...recordHandlers(options),
    "promotion.apply": (params) => applyPromotion(options, params),
    "promotion.rollback": (params) => rollbackHandler(options, params),
    ...windowHandlers(options),
  };
}

export function createReplicationPromotionDbHandlers(
  options: ReplicationDbHandlerOptions,
): ReplicationDbHandlerMap {
  return promotionHandlers(options);
}
