import type { RunEventType } from "@shared/contracts/replication/types";
import type { DbClient } from "../../../clients/db-client";
import type { Logger } from "../../../logging/types";
import type { ReplicationRunRecord } from "../../../db/repositories/replication-run-types";
import { resolveRelativePath } from "../../../platform/destination-path-policy";
import type { DetectedDrive } from "../../drives/domain/drive";
import type { ActiveRun } from "./run-control";
import type { ReplicationExecution } from "./plan-service";
import type { runPartialBackfill } from "./run-runner";

export interface RunSessionDependencies {
  db: DbClient;
  listDetected: () => Promise<DetectedDrive[]>;
  logger: Logger;
  now: () => Date;
  sleep: (milliseconds: number) => Promise<void>;
  executeRunner: typeof runPartialBackfill;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function runErrorSummary(control: {
  errors: Array<{ code: string; message: string }>;
}): string | null {
  const last = control.errors[control.errors.length - 1];
  return last === undefined ? null : `${last.code}: ${last.message}`;
}

export async function setRunStatus(
  dependencies: RunSessionDependencies,
  runId: number,
  status: ReplicationRunRecord["status"],
  errorMessage: string | null,
): Promise<ReplicationRunRecord> {
  return dependencies.db.request<ReplicationRunRecord>("replication.setRunStatus", {
    runId,
    status,
    now: dependencies.now().toISOString(),
    errorMessage,
  });
}

export async function appendRunEvent(
  dependencies: RunSessionDependencies,
  run: ReplicationRunRecord,
  type: RunEventType,
  note: string | null,
): Promise<void> {
  await dependencies.db.request("replication.appendRunEvent", {
    runId: run.id,
    type,
    at: dependencies.now().toISOString(),
    planRevision: run.planRevision,
    note,
  });
}

async function refreshSourceIndexes(
  dependencies: RunSessionDependencies,
  execution: ReplicationExecution,
): Promise<void> {
  const drives = new Map<string, DetectedDrive>(
    (await dependencies.listDetected()).map((drive) => [drive.volumeId, drive]),
  );
  for (const assignment of execution.partial) {
    const drive = drives.get(assignment.destination.volumeId);
    if (drive === undefined) {
      continue;
    }
    const root = assignment.destination.rootRelative.trim().length
      ? resolveRelativePath(drive.rootPath, assignment.destination.rootRelative)
      : drive.rootPath;
    try {
      await dependencies.db.request("replication.writeSourceIndex", {
        destinationId: assignment.destination.id,
        destinationRoot: root,
        now: dependencies.now().toISOString(),
      });
    } catch (error) {
      dependencies.logger.warn("Source index refresh failed after run", {
        destinationId: assignment.destination.destinationId,
        message: errorText(error),
      });
    }
  }
}

async function finishOutcome(
  dependencies: RunSessionDependencies,
  active: ActiveRun,
  execution: ReplicationExecution,
  outcome: string,
): Promise<void> {
  if (outcome === "paused") {
    return;
  }
  const runId = active.runId;
  const summary = runErrorSummary(active.control);
  if (outcome === "interrupted") {
    const run = await setRunStatus(dependencies, runId, "interrupted", summary);
    await appendRunEvent(dependencies, run, "interrupted", "Backup interrupted");
    return;
  }
  if (outcome === "stopped") {
    const run = await setRunStatus(dependencies, runId, "stopped", summary);
    await appendRunEvent(dependencies, run, "stopped", "Backup stopped");
    await refreshSourceIndexes(dependencies, execution);
    return;
  }
  if (outcome === "failed") {
    const run = await setRunStatus(dependencies, runId, "failed", "Backup execution failed");
    await appendRunEvent(dependencies, run, "failed", "Backup failed");
    return;
  }
  const run = await setRunStatus(dependencies, runId, "completed", summary);
  await appendRunEvent(dependencies, run, "completed", "Backup completed");
  await refreshSourceIndexes(dependencies, execution);
}

export interface RunSessionInput {
  active: ActiveRun;
  execution: ReplicationExecution;
  replaceStale: boolean;
  onFinished: (active: ActiveRun) => void;
}

export async function runSession(
  dependencies: RunSessionDependencies,
  input: RunSessionInput,
): Promise<void> {
  const { active } = input;
  try {
    const outcome = await dependencies.executeRunner(
      {
        db: dependencies.db,
        listDetected: dependencies.listDetected,
        logger: dependencies.logger,
        now: dependencies.now,
        sleep: dependencies.sleep,
        control: active.control,
      },
      { runId: active.runId, execution: input.execution, replaceStale: input.replaceStale },
    );
    await finishOutcome(dependencies, active, input.execution, outcome);
  } catch (error) {
    dependencies.logger.error("Backup run failed", error);
    const failed = await setRunStatus(dependencies, active.runId, "failed", errorText(error));
    await appendRunEvent(dependencies, failed, "failed", errorText(error));
  } finally {
    active.lease.release();
    input.onFinished(active);
  }
}
