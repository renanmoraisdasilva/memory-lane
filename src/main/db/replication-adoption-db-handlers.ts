import type {
  ReplicationDbHandlerMap,
  ReplicationDbHandlerOptions,
} from "./replication-db-handler-options";
import {
  beginAdoption,
  finishAdoption,
  getAdoptionByKey,
  markInterruptedAdoptions,
  setAdoptionStatus,
} from "./repositories/replication-adoption-repository";
import {
  listAdoptionReplicas,
  markUnseenReplicasMissing,
  saveAdoptionBatch,
} from "./repositories/replication-adoption-files-repository";
import {
  ReplicationAdoptionBatchDbParamsSchema,
  ReplicationAdoptionKeyParamsSchema,
  ReplicationAdoptionRowParamsSchema,
  ReplicationAdoptionStatusDbParamsSchema,
  ReplicationBeginAdoptionDbParamsSchema,
  ReplicationMarkUnseenDbParamsSchema,
  ReplicationNowDbParamsSchema,
} from "./replication-worker-protocol";

export function createReplicationAdoptionDbHandlers(
  options: ReplicationDbHandlerOptions,
): ReplicationDbHandlerMap {
  return {
    "replication.getAdoption": (params) => {
      const parsed = ReplicationAdoptionKeyParamsSchema.parse(params);
      return getAdoptionByKey(options.getCatalog(), parsed.destinationId);
    },
    "replication.beginAdoption": (params) => {
      const parsed = ReplicationBeginAdoptionDbParamsSchema.parse(params);
      return beginAdoption(options.getCatalog(), parsed.destinationId, parsed.now);
    },
    "replication.updateAdoptionStatus": (params) => {
      const parsed = ReplicationAdoptionStatusDbParamsSchema.parse(params);
      return setAdoptionStatus(options.getCatalog(), {
        destinationRowId: parsed.destinationId,
        status: parsed.status,
        now: parsed.now,
        errorMessage: parsed.errorMessage,
      });
    },
    "replication.finishAdoption": (params) => {
      const parsed = ReplicationAdoptionStatusDbParamsSchema.parse(params);
      return finishAdoption(options.getCatalog(), {
        destinationRowId: parsed.destinationId,
        status: parsed.status,
        now: parsed.now,
        errorMessage: parsed.errorMessage,
      });
    },
    "replication.listAdoptionReplicas": (params) => {
      const parsed = ReplicationAdoptionRowParamsSchema.parse(params);
      return listAdoptionReplicas(options.getCatalog(), parsed.destinationId);
    },
    "replication.saveAdoptionBatch": (params) => {
      const parsed = ReplicationAdoptionBatchDbParamsSchema.parse(params);
      saveAdoptionBatch(options.getCatalog(), parsed.destinationId, {
        replicas: parsed.replicas,
        orphans: parsed.orphans,
        touchedReplicaFileIds: parsed.touchedReplicaFileIds,
        now: parsed.now,
      });
      return { saved: true };
    },
    "replication.markUnseenReplicasMissing": (params) => {
      const parsed = ReplicationMarkUnseenDbParamsSchema.parse(params);
      markUnseenReplicasMissing(options.getCatalog(), {
        destinationRowId: parsed.destinationId,
        seenFileIds: parsed.seenFileIds,
        seenOrphanPathKeys: parsed.seenOrphanPathKeys,
        now: parsed.now,
      });
      return { saved: true };
    },
    "replication.markInterruptedAdoptions": (params) => {
      const parsed = ReplicationNowDbParamsSchema.parse(params);
      return { interrupted: markInterruptedAdoptions(options.getCatalog(), parsed.now) };
    },
  };
}
