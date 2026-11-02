import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import path from "node:path";
import type {
  DuplicateCleanupGroup,
  DuplicateCleanupMove,
  DuplicateCleanupPlan,
  DuplicateCleanupState,
  DuplicateCleanupSummary,
} from "@shared/contracts/health";
import { DuplicateCleanupStateSchema } from "@shared/contracts/health";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { DbClient } from "../../../clients/db-client";
import type { Logger } from "../../../logging/types";
import type { FileHasher } from "../../scanning/domain/scan-files";
import type {
  WorkloadCoordinator,
  WorkloadLease,
} from "../../workloads/application/workload-coordinator";
import { QuarantineMover } from "../infrastructure/quarantine-mover";

const MOVE_BATCH_SIZE = 100;
interface ActiveCleanup {
  plan: DuplicateCleanupPlan;
  state: DuplicateCleanupState;
  mover: QuarantineMover;
  lease: WorkloadLease | null;
  cancelRequested: boolean;
  loop: Promise<void>;
}
export interface CleanupShellActions {
  open(filePath: string): Promise<string>;
}
export interface CleanupServiceDependencies {
  db: DbClient;
  hasher: FileHasher;
  logger: Logger;
  shellActions?: CleanupShellActions;
  workloads?: WorkloadCoordinator;
  now?: () => Date;
  createMover?: (hasher: FileHasher) => QuarantineMover;
}
function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
function runFolderName(startedAt: string): string {
  const stamp = startedAt.replace(/[^0-9]/g, "").slice(0, 17);
  return `run-${stamp}-${randomUUID().slice(0, 8)}`;
}
export class CleanupService {
  private active: ActiveCleanup | null = null;
  private readonly nowDate: () => Date;
  private readonly createMover: (hasher: FileHasher) => QuarantineMover;
  constructor(private readonly dependencies: CleanupServiceDependencies) {
    this.nowDate = dependencies.now ?? (() => new Date());
    this.createMover = dependencies.createMover ?? ((hasher) => new QuarantineMover(hasher));
  }
  async getSummary(): Promise<DuplicateCleanupSummary> {
    return this.dependencies.db.request<DuplicateCleanupSummary>("cleanup.getSummary", {});
  }

  assertCanChangeCatalog(): void {
    if (this.active !== null) {
      throw new AppError(
        APP_ERROR_CODES.WORKLOAD_CONFLICT,
        "A duplicate cleanup is running. Wait for it to finish before changing the catalog.",
      );
    }
  }
  async getState(): Promise<DuplicateCleanupState> {
    const active = this.active;
    if (active !== null) {
      return this.snapshot(active.state);
    }
    return this.dependencies.db.request<DuplicateCleanupState>("cleanup.getState", {
      now: this.now(),
    });
  }
  async start(): Promise<DuplicateCleanupState> {
    if (this.active !== null) {
      throw new AppError(APP_ERROR_CODES.INVALID_REQUEST, "A duplicate cleanup is already running");
    }

    const plan = await this.dependencies.db.request<DuplicateCleanupPlan>("cleanup.getPlan", {});
    if (plan.groups.length === 0) {
      throw new AppError(
        APP_ERROR_CODES.INVALID_REQUEST,
        "There are no eligible duplicate groups to quarantine",
        {
          totalGroups: plan.summary.totalGroups,
          skippedGroups: plan.summary.skippedGroups,
        },
      );
    }

    const lease = this.dependencies.workloads?.acquire("cleanup", "cleanup") ?? null;
    const startedAt = this.now();
    const quarantinePath = path.join(plan.summary.quarantineRoot, runFolderName(startedAt));
    const journalPath = path.join(quarantinePath, "journal.jsonl");

    let state: DuplicateCleanupState;
    try {
      state = await this.dependencies.db.request<DuplicateCleanupState>("cleanup.start", {
        startedAt,
        keeperRule: plan.keeperRule,
        rootPath: plan.rootPath,
        groupsTotal: plan.groups.length,
        groupsWithoutCoverage: plan.summary.groupsWithoutCoverage,
        filesTotal: plan.summary.filesToMove,
        bytesTotal: plan.summary.bytesToMove,
        quarantinePath,
        journalPath,
      });
    } catch (error) {
      lease?.release();
      throw error;
    }
    if (state.runId === null) {
      lease?.release();
      throw new AppError(APP_ERROR_CODES.INTERNAL, "Cleanup run was not created");
    }

    const mover = await this.prepareMoverForRun({
      plan,
      runId: state.runId,
      lease,
      quarantinePath,
      journalPath,
      startedAt,
    });

    const active: ActiveCleanup = {
      plan,
      state: {
        ...state,
        groupsTotal: plan.groups.length,
        groupsWithoutCoverage: plan.summary.groupsWithoutCoverage,
        filesTotal: plan.summary.filesToMove,
        bytesTotal: plan.summary.bytesToMove,
        cancelRequested: false,
      },
      mover,
      lease,
      cancelRequested: false,
      loop: Promise.resolve(),
    };
    this.active = active;
    active.loop = this.run(active).finally(() => {
      lease?.release();
      if (this.active === active) {
        this.active = null;
      }
    });
    return this.snapshot(active.state);
  }

  cancel(): Promise<DuplicateCleanupState> {
    const active = this.active;
    if (active === null) {
      throw new AppError(APP_ERROR_CODES.INVALID_REQUEST, "No cleanup run is active");
    }
    active.cancelRequested = true;
    active.state = { ...active.state, cancelRequested: true };
    return Promise.resolve(this.snapshot(active.state));
  }

  async revealQuarantine(): Promise<void> {
    const shellActions = this.dependencies.shellActions;
    if (shellActions === undefined) {
      throw new AppError(APP_ERROR_CODES.INTERNAL, "Folder actions are unavailable");
    }
    const quarantinePath = await this.dependencies.db.request<string | null>(
      "cleanup.getQuarantinePath",
      {},
    );
    if (quarantinePath === null) {
      throw new AppError(APP_ERROR_CODES.INVALID_REQUEST, "No quarantine folder is available");
    }
    try {
      await access(quarantinePath);
    } catch {
      throw new AppError(APP_ERROR_CODES.INVALID_REQUEST, "The quarantine folder is unavailable");
    }
    const error = await shellActions.open(quarantinePath);
    if (error.length > 0) {
      throw new AppError(APP_ERROR_CODES.SHELL_ACTION_FAILED, error, { quarantinePath });
    }
  }

  async shutdown(): Promise<void> {
    const active = this.active;
    if (active === null) {
      return;
    }
    active.cancelRequested = true;
    active.state = { ...active.state, cancelRequested: true };
    await active.loop;
  }

  private async prepareMoverForRun(input: {
    plan: DuplicateCleanupPlan;
    runId: number;
    lease: WorkloadLease | null;
    quarantinePath: string;
    journalPath: string;
    startedAt: string;
  }): Promise<QuarantineMover> {
    const mover = this.createMover(this.dependencies.hasher);
    try {
      await mover.prepare({
        plan: input.plan,
        runId: input.runId,
        quarantinePath: input.quarantinePath,
        journalPath: input.journalPath,
        startedAt: input.startedAt,
      });
      return mover;
    } catch (error) {
      input.lease?.release();
      await this.finishRun(input.runId, {
        status: "failed",
        groupsProcessed: 0,
        groupsSkipped: 0,
        filesMoved: 0,
        filesSkipped: 0,
        bytesMoved: 0,
        errorMessage: errorText(error),
      }).catch((finishError: unknown) => {
        this.dependencies.logger.error("Could not record a failed cleanup start", finishError);
      });
      throw error;
    }
  }

  private async run(active: ActiveCleanup): Promise<void> {
    const pendingMoves: DuplicateCleanupMove[] = [];
    try {
      for (const group of active.plan.groups) {
        if (active.cancelRequested) {
          break;
        }
        await this.processGroup(active, group, pendingMoves);
        if (pendingMoves.length >= MOVE_BATCH_SIZE) {
          await this.flushMoves(active, pendingMoves);
        }
      }
      if (pendingMoves.length > 0) {
        await this.flushMoves(active, pendingMoves);
      }
      if (active.state.runId === null) {
        throw new AppError(APP_ERROR_CODES.INTERNAL, "Cleanup run has no identifier");
      }
      const status = active.cancelRequested ? "cancelled" : "complete";
      active.state = await this.finishRun(active.state.runId, {
        status,
        groupsProcessed: active.state.groupsProcessed,
        groupsSkipped: active.state.groupsSkipped,
        filesMoved: active.state.filesMoved,
        filesSkipped: active.state.filesSkipped,
        bytesMoved: active.state.bytesMoved,
        errorMessage: null,
      });
      active.state = { ...active.state, cancelRequested: active.cancelRequested };
      await active.mover.finish(status, this.now());
    } catch (error) {
      this.dependencies.logger.error("Duplicate cleanup failed", error);
      const message = errorText(error);
      if (active.state.runId !== null) {
        try {
          active.state = await this.finishRun(active.state.runId, {
            status: "failed",
            groupsProcessed: active.state.groupsProcessed,
            groupsSkipped: active.state.groupsSkipped,
            filesMoved: active.state.filesMoved,
            filesSkipped: active.state.filesSkipped,
            bytesMoved: active.state.bytesMoved,
            errorMessage: message,
          });
          active.state = { ...active.state, cancelRequested: active.cancelRequested };
        } catch (finishError) {
          this.dependencies.logger.error("Could not record a failed cleanup run", finishError);
          active.state = { ...active.state, status: "failed", errorMessage: message };
        }
        await active.mover.finish("failed", this.now(), message).catch((journalError: unknown) => {
          this.dependencies.logger.error("Could not write the cleanup journal", journalError);
        });
      }
    }
  }

  private async processGroup(
    active: ActiveCleanup,
    group: DuplicateCleanupGroup,
    pendingMoves: DuplicateCleanupMove[],
  ): Promise<void> {
    const quarantinePath = active.state.quarantinePath;
    if (quarantinePath === null) {
      throw new AppError(APP_ERROR_CODES.INTERNAL, "Cleanup run has no quarantine folder");
    }
    active.state = { ...active.state, currentPath: group.keeper.path };
    const keeperState = await active.mover.inspectSource(group.keeper, group.sha256);
    if (keeperState !== "ok") {
      await active.mover.recordGroupSkip(
        group,
        `keeper-${keeperState}`,
        this.now(),
        group.keeper.path,
      );
      active.state = {
        ...active.state,
        groupsProcessed: active.state.groupsProcessed + 1,
        groupsSkipped: active.state.groupsSkipped + 1,
        filesSkipped: active.state.filesSkipped + group.candidates.length,
        currentPath: null,
      };
      return;
    }

    let movedInGroup = 0;
    for (const candidate of group.candidates) {
      if (active.cancelRequested) {
        break;
      }
      active.state = { ...active.state, currentPath: candidate.path };
      const result = await active.mover.move({
        group,
        candidate,
        runRootPath: active.plan.rootPath,
        quarantinePath,
        movedAt: this.now(),
      });
      if (result.move === null) {
        active.state = { ...active.state, filesSkipped: active.state.filesSkipped + 1 };
        continue;
      }
      movedInGroup += 1;
      pendingMoves.push(result.move);
      active.state = {
        ...active.state,
        filesMoved: active.state.filesMoved + 1,
        bytesMoved: active.state.bytesMoved + result.move.sizeBytes,
      };
    }

    active.state = {
      ...active.state,
      groupsProcessed: active.state.groupsProcessed + 1,
      groupsSkipped:
        active.state.groupsSkipped + (!active.cancelRequested && movedInGroup === 0 ? 1 : 0),
      currentPath: null,
    };
  }

  private async flushMoves(
    active: ActiveCleanup,
    pendingMoves: DuplicateCleanupMove[],
  ): Promise<void> {
    if (pendingMoves.length === 0 || active.state.runId === null) {
      return;
    }
    const moves = pendingMoves.splice(0, pendingMoves.length);
    await this.dependencies.db.request("cleanup.applyMoves", {
      runId: active.state.runId,
      moves,
    });
  }

  private async finishRun(
    runId: number,
    input: {
      status: "complete" | "cancelled" | "failed";
      groupsProcessed: number;
      groupsSkipped: number;
      filesMoved: number;
      filesSkipped: number;
      bytesMoved: number;
      errorMessage: string | null;
    },
  ): Promise<DuplicateCleanupState> {
    return this.dependencies.db.request<DuplicateCleanupState>("cleanup.finish", {
      runId,
      status: input.status,
      groupsProcessed: input.groupsProcessed,
      groupsSkipped: input.groupsSkipped,
      filesMoved: input.filesMoved,
      filesSkipped: input.filesSkipped,
      bytesMoved: input.bytesMoved,
      finishedAt: this.now(),
      errorMessage: input.errorMessage,
    });
  }

  private snapshot(state: DuplicateCleanupState): DuplicateCleanupState {
    return DuplicateCleanupStateSchema.parse(state);
  }

  private now(): string {
    return this.nowDate().toISOString();
  }
}
