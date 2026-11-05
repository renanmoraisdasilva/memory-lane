import type {
  ReplicationDbHandlerMap,
  ReplicationDbHandlerOptions,
} from "./replication-db-handler-options";
import {
  getCoverageSummary,
  getDestinationCoverageMap,
  getDestinationOverlapBytes,
  getDestinationReplicaHealth,
  getOverlapBytes,
  listReplicaReplacements,
  listVerifiedCoverage,
} from "./repositories/replication-coverage-repository";
import { ReplicationDestinationIdParamsSchema } from "./replication-worker-protocol";

export function createReplicationCoverageDbHandlers(
  options: ReplicationDbHandlerOptions,
): ReplicationDbHandlerMap {
  return {
    "replication.getCoverageSummary": () => getCoverageSummary(options.getCatalog()),
    "replication.listVerifiedCoverage": () =>
      listVerifiedCoverage(options.getCatalog()).map((coverage) => ({
        destinationRowId: coverage.destinationRowId,
        verifiedFileIds: [...coverage.verifiedFileIds],
        verifiedBytes: coverage.verifiedBytes,
        lastVerifiedAt: coverage.lastVerifiedAt,
      })),
    "replication.listReplicaReplacements": () => listReplicaReplacements(options.getCatalog()),
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
