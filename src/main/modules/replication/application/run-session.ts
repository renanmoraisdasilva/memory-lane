import type { RunEventType } from "@shared/contracts/replication/types";
import type { DbClient } from "../../../clients/db-client";
import type { Logger } from "../../../logging/types";
import type { ReplicationRunRecord } from "../../../db/repositories/replication-run-types";
import { resolveRelativePath } from "../../../platform/destination-path-policy";
import type { DetectedDrive } from "../../drives/domain/drive";
import type { ActiveRun } from "./run-control";
import type { runReplicationBackfill } from "./run-runner";
import type { SelectedRunWork } from "./run-selection";

export interface RunSessionDependencies {
  db: DbClient;
  listDetected: () => Promise<DetectedDrive[]>;
  logger: Logger;
  now: () => Date;
  sleep: (milliseconds: number) => Promise<void>;
  executeRunner: typeof runReplicationBackfill;
  refreshStatuses: () => Promise<void>;
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
  work: SelectedRunWork,
): Promise<void> {
  const drives = new Map<string, DetectedDrive>(
    (await dependencies.listDetected()).map((drive) => [drive.volumeId, drive]),
  );
  const assignments = [...(work.fullCopy === null ? [] : [work.fullCopy]), ...work.partial];
  for (const assignment of assignments) {
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
  work: SelectedRunWork,
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
    await refreshSourceIndexes(dependencies, work);
    return;
  }
  if (outcome === "failed") {
    const run = await setRunStatus(dependencies, runId, "failed", "Backup execution failed");
    await appendRunEvent(dependencies, run, "failed", "Backup failed");
    return;
  }
  const run = await setRunStatus(dependencies, runId, "completed", summary);
  await appendRunEvent(dependencies, run, "completed", "Backup completed");
  await refreshSourceIndexes(dependencies, work);
}

export interface RunSessionInput {
  active: ActiveRun;
  work: SelectedRunWork;
  replaceStale: boolean;
  onFinished: (active: ActiveRun) => void;
}

async function refreshDestinations(dependencies: RunSessionDependencies): Promise<void> {
  try {
    await dependencies.refreshStatuses();
  } catch (error) {
    dependencies.logger.warn("Destination status refresh failed after run", {
      message: errorText(error),
    });
  }
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
      {
        runId: active.runId,
        fullCopy: input.work.fullCopy,
        partial: input.work.partial,
        replaceStale: input.replaceStale,
      },
    );
    await finishOutcome(dependencies, active, input.work, outcome);
  } catch (error) {
    dependencies.logger.error("Backup run failed", error);
    const failed = await setRunStatus(dependencies, active.runId, "failed", errorText(error));
    await appendRunEvent(dependencies, failed, "failed", errorText(error));
  } finally {
    await refreshDestinations(dependencies);
    active.lease.release();
    input.onFinished(active);
  }
}
