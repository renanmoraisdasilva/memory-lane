import type {
  ReplicationDbHandlerMap,
  ReplicationDbHandlerOptions,
} from "./replication-db-handler-options";
import {
  createRun,
  getActiveRun,
  getLatestRun,
  getRun,
  markInterruptedRuns,
  setRunStatus,
  updateRunPlan,
} from "./repositories/replication-run-repository";
import {
  getExistingReplica,
  saveRunFileResult,
} from "./repositories/replication-run-file-repository";
import { appendRunEvent, listRunEvents } from "./repositories/replication-run-event-repository";
import {
  ReplicationAppendRunEventDbParamsSchema,
  ReplicationCreateRunDbParamsSchema,
  ReplicationExistingReplicaParamsSchema,
  ReplicationListRunEventsDbParamsSchema,
  ReplicationMarkInterruptedRunsDbParamsSchema,
  ReplicationRunFileResultDbParamsSchema,
  ReplicationRunIdParamsSchema,
  ReplicationRunStatusDbParamsSchema,
  ReplicationUpdateRunPlanDbParamsSchema,
} from "./replication-worker-protocol";

export function createReplicationRunDbHandlers(
  options: ReplicationDbHandlerOptions,
): ReplicationDbHandlerMap {
  return {
    "replication.getLatestRun": () => getLatestRun(options.getCatalog()),
    "replication.getActiveRun": () => getActiveRun(options.getCatalog()),
    "replication.getRun": (params) =>
      getRun(options.getCatalog(), ReplicationRunIdParamsSchema.parse(params).runId),
    "replication.createRun": (params) => {
      const parsed = ReplicationCreateRunDbParamsSchema.parse(params);
      return createRun(options.getCatalog(), parsed);
    },
    "replication.setRunStatus": (params) => {
      const parsed = ReplicationRunStatusDbParamsSchema.parse(params);
      return setRunStatus(options.getCatalog(), {
        runId: parsed.runId,
        status: parsed.status,
        now: parsed.now,
        errorMessage: parsed.errorMessage,
      });
    },
    "replication.updateRunPlan": (params) => {
      const parsed = ReplicationUpdateRunPlanDbParamsSchema.parse(params);
      return updateRunPlan(options.getCatalog(), parsed.runId, parsed);
    },
    "replication.saveRunFileResult": (params) => {
      const parsed = ReplicationRunFileResultDbParamsSchema.parse(params);
      saveRunFileResult(options.getCatalog(), parsed);
      return { saved: true };
    },
    "replication.getExistingReplica": (params) => {
      const parsed = ReplicationExistingReplicaParamsSchema.parse(params);
      return getExistingReplica(options.getCatalog(), parsed.destinationRowId, parsed.fileId);
    },
    "replication.appendRunEvent": (params) => {
      const parsed = ReplicationAppendRunEventDbParamsSchema.parse(params);
      return appendRunEvent(options.getCatalog(), parsed);
    },
    "replication.listRunEvents": (params) => {
      const parsed = ReplicationListRunEventsDbParamsSchema.parse(params);
      return listRunEvents(options.getCatalog(), parsed.runId, parsed.cursor, parsed.limit);
    },
    "replication.markInterruptedRuns": (params) => {
      const parsed = ReplicationMarkInterruptedRunsDbParamsSchema.parse(params);
      return { interrupted: markInterruptedRuns(options.getCatalog(), parsed.now) };
    },
  };
}
