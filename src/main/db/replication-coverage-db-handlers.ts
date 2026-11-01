import type {
  ReplicationDbHandlerMap,
  ReplicationDbHandlerOptions,
} from "./replication-db-handler-options";
import {
  getDestinationCoverageMap,
  getDestinationOverlapBytes,
  getDestinationReplicaHealth,
  getOverlapBytes,
  listVerifiedCoverage,
} from "./repositories/replication-coverage-repository";
import { ReplicationDestinationIdParamsSchema } from "./replication-worker-protocol";

export function createReplicationCoverageDbHandlers(
  options: ReplicationDbHandlerOptions,
): ReplicationDbHandlerMap {
  return {
    "replication.listVerifiedCoverage": () =>
      listVerifiedCoverage(options.getCatalog()).map((coverage) => ({
        destinationRowId: coverage.destinationRowId,
        verifiedFileIds: [...coverage.verifiedFileIds],
        verifiedBytes: coverage.verifiedBytes,
        lastVerifiedAt: coverage.lastVerifiedAt,
      })),
    "replication.getDestinationCoverageMap": (params) =>
      getDestinationCoverageMap(
        options.getCatalog(),
        ReplicationDestinationIdParamsSchema.parse(params).destinationId,
      ),
    "replication.getDestinationReplicaHealth": (params) =>
      getDestinationReplicaHealth(
        options.getCatalog(),
        ReplicationDestinationIdParamsSchema.parse(params).destinationId,
      ),
    "replication.getOverlapBytes": () => getOverlapBytes(options.getCatalog()),
    "replication.getDestinationOverlapBytes": (params) =>
      getDestinationOverlapBytes(
        options.getCatalog(),
        ReplicationDestinationIdParamsSchema.parse(params).destinationId,
      ),
  };
}
