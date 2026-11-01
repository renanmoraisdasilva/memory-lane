import path from "node:path";
import { resolveRelativePath } from "../../../platform/destination-path-policy";
import type { DetectedDrive } from "../../drives/domain/drive";
import { createDestinationWriter } from "../infrastructure/destination-writer";
import type { ExecutionDestination } from "./plan-service";
import { addError, processFile } from "./run-file-copy";
import type { RunOutcome, RunRunnerDependencies, RunRunnerInput } from "./run-runner-types";

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function stopOutcome(control: RunRunnerDependencies["control"]): RunOutcome | null {
  if (control.cancelled) return "interrupted";
  if (control.stopping) return "stopped";
  if (control.paused) return "paused";
  return null;
}

async function runDestination(input: {
  dependencies: RunRunnerDependencies;
  runner: RunRunnerInput;
  assignment: ExecutionDestination;
  drives: Map<string, DetectedDrive>;
}): Promise<"complete" | RunOutcome> {
  const { dependencies, assignment } = input;
  const record = assignment.destination;
  const drive = input.drives.get(record.volumeId);
  dependencies.control.currentDestinationId = record.destinationId;
  dependencies.control.currentDestinationLabel = record.label;
  if (drive === undefined) {
    dependencies.control.order.set(record.destinationId, "offline");
    addError(dependencies.control, {
      code: "DESTINATION_DISCONNECTED",
      message: `${record.label} is offline. Its files wait for reconnect.`,
      retryable: true,
    });
    return "complete";
  }
  const root = record.rootRelative.trim().length
    ? resolveRelativePath(drive.rootPath, record.rootRelative)
    : path.resolve(drive.rootPath);
  const writer = createDestinationWriter(root);
  dependencies.control.order.set(record.destinationId, "active");
  try {
    for (const file of assignment.files) {
      const stop = stopOutcome(dependencies.control);
      if (stop !== null) {
        return stop;
      }
      dependencies.control.currentFile = file.sourceRelativePath;
      const result = await processFile({
        dependencies,
        runId: input.runner.runId,
        assignment,
        file,
        root,
        writer,
        replaceStale: input.runner.replaceStale,
      });
      if (result === "destination_full") {
        dependencies.control.order.set(record.destinationId, "skipped");
        return "complete";
      }
      if (result !== "continue") {
        return result;
      }
      const afterFile = stopOutcome(dependencies.control);
      if (afterFile !== null) {
        return afterFile;
      }
    }
    dependencies.control.order.set(record.destinationId, "complete");
    dependencies.control.currentFile = null;
    return "complete";
  } catch (error) {
    dependencies.control.order.set(record.destinationId, "skipped");
    addError(dependencies.control, {
      code: "REPLICATION_STATE_INVALID",
      message: `${record.label}: ${errorText(error)}`,
      retryable: true,
    });
    dependencies.logger.warn("Destination run failed", {
      destinationId: record.destinationId,
      message: errorText(error),
    });
    return "complete";
  }
}

export async function runPartialBackfill(
  dependencies: RunRunnerDependencies,
  runner: RunRunnerInput,
): Promise<RunOutcome> {
  const drives = new Map<string, DetectedDrive>(
    (await dependencies.listDetected()).map((drive) => [drive.volumeId, drive]),
  );
  for (const assignment of runner.execution.partial) {
    const outcome = await runDestination({ dependencies, runner, assignment, drives });
    if (outcome !== "complete") {
      return outcome;
    }
  }
  dependencies.control.currentDestinationId = null;
  dependencies.control.currentDestinationLabel = null;
  dependencies.control.currentFile = null;
  return "completed";
}
