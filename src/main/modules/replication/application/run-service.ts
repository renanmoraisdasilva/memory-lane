import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type {
  ReplicationRunState,
  RunEventsPage,
  RunSummary,
  StartRunParams,
} from "@shared/contracts/replication/types";
import type {
  CreateRunInput,
  ReplicationRunRecord,
} from "../../../db/repositories/replication-run-types";
import type { WorkloadLease } from "../../workloads/application/workload-coordinator";
import { controlFor, parseOrderSnapshot, snapshotFor } from "./run-inputs";
import type { ReplicationExecution } from "./plan-service";
import type { ActiveRun, RunControl } from "./run-control";
import { activeRunFor, buildRunState, toRunSummary } from "./run-state";
import { runPartialBackfill } from "./run-runner";
import {
  appendRunEvent,
  runErrorSummary,
  runSession,
  setRunStatus,
  type RunSessionDependencies,
} from "./run-session";
import { defaultSleep, type RunServiceDependencies } from "./run-service-types";

function isBlockingRunStatus(status: ReplicationRunRecord["status"]): boolean {
  return ["running", "paused", "stopping"].includes(status);
}

export class RunService {
  private active: ActiveRun | null = null;
  private readonly nowDate: () => Date;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly executeRunner: typeof runPartialBackfill;

  constructor(private readonly dependencies: RunServiceDependencies) {
    this.nowDate = dependencies.now ?? (() => new Date());
    this.sleep = dependencies.sleep ?? defaultSleep;
    this.executeRunner = dependencies.execute ?? runPartialBackfill;
  }

  async getRunState(): Promise<ReplicationRunState | null> {
    const run = await this.latestRun();
    if (run === null) {
      return null;
    }
    return buildRunState(run, activeRunFor(this.activeFor(run)));
  }

  async getRunSummary(): Promise<RunSummary | null> {
    const state = await this.getRunState();
    if (state === null) {
      return null;
    }
    if (
      state.status !== "running" &&
      state.status !== "paused" &&
      state.status !== "stopping" &&
      state.status !== "interrupted"
    ) {
      return null;
    }
    return toRunSummary(state);
  }

  async getEvents(runId: number, cursor: number | null, limit: number): Promise<RunEventsPage> {
    return this.dependencies.db.request<RunEventsPage>("replication.listRunEvents", {
      runId,
      cursor,
      limit,
    });
  }

  async start(params: StartRunParams): Promise<ReplicationRunState> {
    const latest = await this.latestRun();
    if (latest !== null && latest.status === "interrupted") {
      return buildRunState(latest, null);
    }
    const activeRun = await this.dependencies.db.request<ReplicationRunRecord | null>(
      "replication.getActiveRun",
      {},
    );
    if (activeRun !== null) {
      return buildRunState(activeRun, activeRunFor(this.activeFor(activeRun)));
    }
    const execution = await this.dependencies.planService.getExecutionPlan();
    this.assertRunScope(params, execution);
    const snapshot = snapshotFor(execution);
    this.assertStartable(params, execution, snapshot.files);
    const lease = this.dependencies.workloads.acquire("replication", "run");
    try {
      const now = this.now();
      const run = await this.dependencies.db.request<ReplicationRunRecord>(
        "replication.createRun",
        {
          scope: params.scope,
          goal: "extend_coverage",
          planRevision: 1,
          planHash: execution.plan.planHash,
          destinationSnapshot: snapshot.json,
          plannedFiles: snapshot.files,
          plannedBytes: snapshot.bytes,
          remainderFiles: execution.plan.remainder.files,
          remainderBytes: execution.plan.remainder.bytes,
          now,
        } satisfies CreateRunInput,
      );
      await this.appendEvent(run, "started", "Backup started");
      const control = controlFor(snapshot.entries, this.nowDate());
      this.launch({ run, control, lease, execution, replaceStale: params.replaceStale });
      return buildRunState(run, control);
    } catch (error) {
      lease.release();
      throw error;
    }
  }

  async pause(): Promise<ReplicationRunState> {
    const run = await this.latestRun();
    if (run === null) {
      throw new AppError(APP_ERROR_CODES.REPLICATION_RUN_NOT_FOUND, "There is no backup run");
    }
    if (this.active === null || run.status !== "running") {
      return buildRunState(run, null);
    }
    this.active.control.paused = true;
    const paused = await this.setStatus(run.id, "paused", runErrorSummary(this.active.control));
    await this.appendEvent(paused, "paused", "Backup paused");
    await this.active.loop;
    return (await this.getRunState()) ?? buildRunState(paused, null);
  }

  async resume(): Promise<ReplicationRunState> {
    const run = await this.latestRun();
    if (run === null) {
      throw new AppError(APP_ERROR_CODES.REPLICATION_RUN_NOT_FOUND, "There is no backup run");
    }
    if (run.status !== "paused" && run.status !== "interrupted") {
      throw new AppError(
        APP_ERROR_CODES.REPLICATION_STATE_INVALID,
        "There is no paused backup to resume",
      );
    }
    if (this.active !== null) {
      return buildRunState(run, this.active.control);
    }
    const lease = this.dependencies.workloads.acquire("replication", "run");
    try {
      const execution = await this.dependencies.planService.getExecutionPlan();
      const current = await this.applyResumePlan(run, execution);
      const running = await this.setStatus(current.id, "running", null);
      await this.appendEvent(running, "resumed", "Backup resumed");
      const control = controlFor(parseOrderSnapshot(running.destinationSnapshot), this.nowDate());
      this.launch({ run: running, control, lease, execution, replaceStale: false });
      return buildRunState(running, control);
    } catch (error) {
      lease.release();
      throw error;
    }
  }

  async requestStop(): Promise<ReplicationRunState> {
    const run = await this.latestRun();
    if (run === null) {
      throw new AppError(APP_ERROR_CODES.REPLICATION_RUN_NOT_FOUND, "There is no backup run");
    }
    if (this.active === null) {
      if (run.status === "paused" || run.status === "interrupted") {
        const stopping = await this.setStatus(run.id, "stopping", null);
        await this.appendEvent(stopping, "stop_requested", "Backup stop requested");
        const stopped = await this.setStatus(run.id, "stopped", null);
        await this.appendEvent(stopped, "stopped", "Backup stopped");
        return buildRunState(stopped, null);
      }
      return buildRunState(run, null);
    }
    this.active.control.stopping = true;
    const stopping = await this.setStatus(run.id, "stopping", null);
    await this.appendEvent(stopping, "stop_requested", "Backup stop requested");
    return buildRunState(stopping, this.active.control);
  }

  async replanIfPaused(): Promise<ReplicationRunState | null> {
    const run = await this.latestRun();
    if (run === null || (run.status !== "paused" && run.status !== "interrupted")) {
      return null;
    }
    const execution = await this.dependencies.planService.getExecutionPlan();
    const updated = await this.applyPlan(run, execution, "Plan updated after destination change");
    return buildRunState(updated, null);
  }

  async onDestinationAdded(): Promise<void> {
    const run = await this.latestRun();
    if (
      run === null ||
      (run.status !== "running" && run.status !== "paused" && run.status !== "interrupted")
    ) {
      return;
    }
    await this.appendEvent(run, "destination_added", "Destination added; queued for the next plan");
    if (run.status === "paused" || run.status === "interrupted") {
      await this.replanIfPaused();
    }
  }

  async assertCanChangeSource(): Promise<void> {
    const conflict = (): AppError =>
      new AppError(
        APP_ERROR_CODES.WORKLOAD_CONFLICT,
        "Finish or pause the backup before switching source archives.",
      );
    const adoptionActive = this.dependencies.workloads.current()?.ownerId.startsWith("adoption:");
    if (adoptionActive === true) {
      throw conflict();
    }
    let run = await this.latestRunWhenOpen();
    if (this.active !== null) {
      const activeStatus = run !== null && isBlockingRunStatus(run.status);
      if (activeStatus) {
        throw conflict();
      }
      await this.active.loop;
      run = await this.latestRunWhenOpen();
    }
    if (run !== null && isBlockingRunStatus(run.status)) {
      throw conflict();
    }
  }

  async shutdown(): Promise<void> {
    if (this.active === null) {
      return;
    }
    this.active.control.cancelled = true;
    await this.active.loop;
  }

  private assertRunScope(params: StartRunParams, execution: ReplicationExecution): void {
    if (
      params.scope === "full_copy_only" ||
      (params.scope === "all_connected" && execution.fullCopy !== null)
    ) {
      throw new AppError(
        APP_ERROR_CODES.REPLICATION_STATE_INVALID,
        "Full copy execution is not available in this release slice. Choose partial coverage only.",
      );
    }
  }

  private assertStartable(
    params: StartRunParams,
    execution: ReplicationExecution,
    plannedFiles: number,
  ): void {
    if (plannedFiles === 0) {
      throw new AppError(
        APP_ERROR_CODES.REPLICATION_STATE_INVALID,
        "There are no partial-coverage files to copy.",
      );
    }
    if (params.planHash !== undefined && params.planHash !== execution.plan.planHash) {
      throw new AppError(
        APP_ERROR_CODES.REPLICATION_STATE_INVALID,
        "The backup plan changed after review. Refresh the plan and start again.",
      );
    }
    const blocking = execution.plan.warnings.some((warning) => warning.severity === "blocking");
    if (blocking) {
      throw new AppError(
        APP_ERROR_CODES.REPLICATION_STATE_INVALID,
        execution.plan.blockedReason ?? "The backup plan is blocked.",
      );
    }
  }

  private async applyResumePlan(
    run: ReplicationRunRecord,
    execution: ReplicationExecution,
  ): Promise<ReplicationRunRecord> {
    if (execution.plan.planHash === run.planHash) {
      return run;
    }
    return this.applyPlan(run, execution, "Plan refreshed on resume");
  }

  private async applyPlan(
    run: ReplicationRunRecord,
    execution: ReplicationExecution,
    note: string,
  ): Promise<ReplicationRunRecord> {
    const snapshot = snapshotFor(execution);
    const updated = await this.dependencies.db.request<ReplicationRunRecord>(
      "replication.updateRunPlan",
      {
        runId: run.id,
        planRevision: run.planRevision + 1,
        planHash: execution.plan.planHash,
        destinationSnapshot: snapshot.json,
        plannedFiles: snapshot.files,
        plannedBytes: snapshot.bytes,
        remainderFiles: execution.plan.remainder.files,
        remainderBytes: execution.plan.remainder.bytes,
        now: this.now(),
      },
    );
    await this.appendEvent(updated, "plan_changed", note);
    return updated;
  }

  private launch(input: {
    run: ReplicationRunRecord;
    control: RunControl;
    lease: WorkloadLease;
    execution: ReplicationExecution;
    replaceStale: boolean;
  }): void {
    const active: ActiveRun = {
      runId: input.run.id,
      control: input.control,
      lease: input.lease,
      loop: Promise.resolve(),
    };
    this.active = active;
    active.loop = runSession(this.sessionDependencies(), {
      active,
      execution: input.execution,
      replaceStale: input.replaceStale,
      onFinished: (finished) => {
        if (this.active === finished) {
          this.active = null;
        }
      },
    });
  }

  private sessionDependencies(): RunSessionDependencies {
    return {
      db: this.dependencies.db,
      listDetected: this.dependencies.listDetected,
      logger: this.dependencies.logger,
      now: () => this.nowDate(),
      sleep: this.sleep,
      executeRunner: this.executeRunner,
    };
  }

  private activeFor(run: ReplicationRunRecord): ActiveRun | null {
    return this.active !== null && this.active.runId === run.id ? this.active : null;
  }

  private async latestRun(): Promise<ReplicationRunRecord | null> {
    return this.dependencies.db.request<ReplicationRunRecord | null>(
      "replication.getLatestRun",
      {},
    );
  }

  private async latestRunWhenOpen(): Promise<ReplicationRunRecord | null> {
    try {
      return await this.latestRun();
    } catch (error) {
      if (error instanceof AppError && error.code === APP_ERROR_CODES.CATALOG_NOT_FOUND) {
        return null;
      }
      throw error;
    }
  }

  private async setStatus(
    runId: number,
    status: ReplicationRunRecord["status"],
    errorMessage: string | null,
  ): Promise<ReplicationRunRecord> {
    return setRunStatus(this.sessionDependencies(), runId, status, errorMessage);
  }

  private async appendEvent(
    run: ReplicationRunRecord,
    type: Parameters<typeof appendRunEvent>[2],
    note: string | null,
  ): Promise<void> {
    await appendRunEvent(this.sessionDependencies(), run, type, note);
  }

  private now(): string {
    return this.nowDate().toISOString();
  }
}
