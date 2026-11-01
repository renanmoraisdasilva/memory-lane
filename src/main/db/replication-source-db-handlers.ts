import path from "node:path";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { readArchiveIdentity } from "./repositories/archive-identity-repository";
import { listSourceFiles, saveSourceHash } from "./repositories/replication-source-repository";
import { listAdoptionReplicas } from "./repositories/replication-adoption-files-repository";
import { writeSourceIndex } from "./source-index-writer";
import type {
  ReplicationDbHandlerMap,
  ReplicationDbHandlerOptions,
} from "./replication-db-handler-options";
import {
  ReplicationSourceHashDbParamsSchema,
  ReplicationWriteSourceIndexDbParamsSchema,
} from "./replication-worker-protocol";

export function createReplicationSourceDbHandlers(
  options: ReplicationDbHandlerOptions,
): ReplicationDbHandlerMap {
  return {
    "replication.listSourceFiles": () =>
      listSourceFiles(options.getCatalog(), options.getCatalogPath()),
    "replication.saveSourceHash": (params) => {
      const parsed = ReplicationSourceHashDbParamsSchema.parse(params);
      saveSourceHash(options.getCatalog(), parsed);
      return { saved: true };
    },
    "replication.writeSourceIndex": async (params) => {
      const parsed = ReplicationWriteSourceIndexDbParamsSchema.parse(params);
      if (!path.isAbsolute(parsed.destinationRoot)) {
        throw new AppError(APP_ERROR_CODES.INVALID_REQUEST, "Destination root must be absolute");
      }
      const catalog = options.getCatalog();
      const identity = readArchiveIdentity(catalog);
      const sourceCatalogPath = options.getCatalogPath();
      const replicas = new Map(
        listAdoptionReplicas(catalog, parsed.destinationId).map((replica) => [
          replica.fileId,
          replica,
        ]),
      );
      const files = listSourceFiles(catalog, sourceCatalogPath).map((file) => {
        const replica = replicas.get(file.id);
        return {
          fileId: file.id,
          relativePath: file.sourceRelativePath,
          sizeBytes: file.size,
          sha256: file.sha256,
          resolvedDate: file.resolvedDate,
          mediaClass: file.mediaClass,
          replicaStatus: replica?.status ?? null,
          verifiedAt: replica?.verifiedAt ?? null,
        };
      });
      const sourceRoot = path.resolve(
        path.dirname(path.dirname(sourceCatalogPath)),
        identity.sourceRootRelative,
      );
      const relativePath = await writeSourceIndex({
        destinationRoot: parsed.destinationRoot,
        catalogId: identity.catalogId,
        sourceCatalogId: identity.catalogId,
        sourceLabel: identity.label,
        sourceRoot,
        generatedAt: parsed.now,
        files,
      });
      catalog
        .prepare(
          `UPDATE replica_destinations
           SET source_index_relative = ?, source_index_updated_at = ?
           WHERE id = ?`,
        )
        .run(relativePath, parsed.now, parsed.destinationId);
      catalog
        .prepare("UPDATE archive_identity SET last_indexed_at = ? WHERE id = 1")
        .run(parsed.now);
      return { relativePath, updatedAt: parsed.now };
    },
  };
}
