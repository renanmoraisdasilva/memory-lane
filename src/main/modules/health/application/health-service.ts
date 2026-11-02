import { access } from "node:fs/promises";
import type {
  DuplicateGroupsPage,
  HealthSummary,
  MissingDuplicatesPage,
  MissingFilesPage,
  MovedActionResult,
  MovedCandidatesPage,
  PurgeMissingDuplicatesResult,
  ValidationLevel,
  ValidationState,
} from "@shared/contracts/health";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { DbClient } from "../../../clients/db-client";
import type { Logger } from "../../../logging/types";
import type { FileHasher, FileMetadataExtractor } from "../../scanning/domain/scan-files";
import type {
  WorkloadCoordinator,
  WorkloadLease,
} from "../../workloads/application/workload-coordinator";
import { ValidationChecker, type ValidationFile } from "./validation-checker";

interface ActiveValidation {
  sessionId: number;
  levels: ValidationLevel[];
  paused: boolean;
  stopped: boolean;
  waitResolve: (() => void) | null;
  loop: Promise<void>;
}

export interface HealthServiceDependencies {
  db: DbClient;
  hasher: FileHasher;
  metadata: FileMetadataExtractor;
  logger: Logger;
  workloads?: WorkloadCoordinator;
  now?: () => Date;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class HealthService {
  private readonly nowDate: () => Date;
  private readonly checker: ValidationChecker;
  private active: ActiveValidation | null = null;
  private workloadLease: WorkloadLease | null = null;

  constructor(private readonly dependencies: HealthServiceDependencies) {
    this.nowDate = dependencies.now ?? (() => new Date());
    this.checker = new ValidationChecker(
      dependencies.db,
      dependencies.hasher,
      dependencies.metadata,
      () => this.now(),
    );
  }

  async getSummary(): Promise<HealthSummary> {
    return this.dependencies.db.request<HealthSummary>("health.getSummary", {});
  }

  async getDuplicates(offset = 0, limit = 25): Promise<DuplicateGroupsPage> {
    return this.dependencies.db.request<DuplicateGroupsPage>("health.getDuplicates", {
      offset,
      limit,
    });
  }

  async getMissing(offset = 0, limit = 50): Promise<MissingFilesPage> {
    return this.dependencies.db.request<MissingFilesPage>("health.getMissing", {
      offset,
      limit,
    });
  }

  async getMissingDuplicates(offset = 0, limit = 50): Promise<MissingDuplicatesPage> {
    return this.dependencies.db.request<MissingDuplicatesPage>("health.getMissingDuplicates", {
      offset,
      limit,
    });
  }

  async purgeMissingDuplicates(
    fileIds: number[],
    includePendingMoves = false,
  ): Promise<PurgeMissingDuplicatesResult> {
    const active = this.dependencies.workloads?.current();
    if (active !== undefined && active !== null) {
      throw new AppError(
        APP_ERROR_CODES.WORKLOAD_CONFLICT,
        `A ${active.kind === "replication" ? "backup" : active.kind} is running. Wait for it to finish before cleaning up missing duplicates.`,
        { activeKind: active.kind, activeOwnerId: active.ownerId },
      );
    }
    return this.dependencies.db.request<PurgeMissingDuplicatesResult>(
      "health.purgeMissingDuplicates",
      { fileIds, includePendingMoves },
    );
  }

  async getMoved(offset = 0, limit = 50): Promise<MovedCandidatesPage> {
    return this.dependencies.db.request<MovedCandidatesPage>("health.getMoved", {
      offset,
      limit,
    });
  }

  async confirmMoved(candidateIds: number[]): Promise<MovedActionResult> {
    const pending = await this.dependencies.db.request<MovedCandidatesPage>(
      "health.getMovedByIds",
      { candidateIds },
    );
    const byId = new Map(pending.items.map((candidate) => [candidate.id, candidate]));
    const valid: number[] = [];
    let skipped = 0;
    for (const id of candidateIds) {
      const candidate = byId.get(id);
      if (candidate === undefined) {
        skipped += 1;
        continue;
      }
      try {
        await access(candidate.newPath);
        const actual = await this.dependencies.hasher.hash(candidate.newPath);
        if (actual !== candidate.sha256) {
          skipped += 1;
          continue;
        }
        valid.push(id);
      } catch {
        skipped += 1;
      }
    }
    const result = await this.dependencies.db.request<MovedActionResult>("health.confirmMoved", {
      candidateIds: valid,
      now: this.now(),
    });
    return { updated: result.updated, skipped: skipped + result.skipped };
  }

  async dismissMoved(candidateIds: number[]): Promise<MovedActionResult> {
    return this.dependencies.db.request<MovedActionResult>("health.dismissMoved", {
      candidateIds,
    });
  }

  async getValidationState(): Promise<ValidationState> {
    const state = await this.dependencies.db.request<ValidationState>(
      "health.getValidationState",
      {},
    );
    if (state.status === "running" && state.sessionId !== null && this.active === null) {
      return this.dependencies.db.request<ValidationState>("health.pauseValidation", {
        sessionId: state.sessionId,
        now: this.now(),
      });
    }
    return state;
  }

  async startValidation(levels: ValidationLevel[]): Promise<ValidationState> {
    if (this.active !== null) {
      throw new AppError(APP_ERROR_CODES.INVALID_REQUEST, "A validation run is already active");
    }
    const lease = this.dependencies.workloads?.acquire("validation", "validation") ?? null;
    let state: ValidationState;
    try {
      state = await this.dependencies.db.request<ValidationState>("health.createValidation", {
        levels,
        now: this.now(),
      });
      if (state.sessionId === null) {
        throw new AppError(APP_ERROR_CODES.INTERNAL, "Validation session was not created");
      }
    } catch (error) {
      lease?.release();
      throw error;
    }
    this.begin(state, state.sessionId, lease);
    return state;
  }

  async pauseValidation(): Promise<ValidationState> {
    if (this.active === null) {
      throw new AppError(APP_ERROR_CODES.INVALID_REQUEST, "No validation run is active");
    }
    this.active.paused = true;
    const state = await this.dependencies.db.request<ValidationState>("health.pauseValidation", {
      sessionId: this.active.sessionId,
      now: this.now(),
    });
    return state;
  }

  async resumeValidation(): Promise<ValidationState> {
    if (this.active !== null) {
      this.active.paused = false;
      this.active.waitResolve?.();
      this.active.waitResolve = null;
      return this.dependencies.db.request<ValidationState>("health.resumeValidation", {
        sessionId: this.active.sessionId,
        now: this.now(),
      });
    }

    const state = await this.getValidationState();
    if (state.status !== "paused" || state.sessionId === null) {
      throw new AppError(
        APP_ERROR_CODES.INVALID_REQUEST,
        "There is no paused validation to resume",
      );
    }
    const lease = this.dependencies.workloads?.acquire("validation", "validation") ?? null;
    let resumed: ValidationState;
    try {
      resumed = await this.dependencies.db.request<ValidationState>("health.resumeValidation", {
        sessionId: state.sessionId,
        now: this.now(),
      });
    } catch (error) {
      lease?.release();
      throw error;
    }
    this.begin(resumed, state.sessionId, lease);
    return resumed;
  }

  async shutdown(): Promise<void> {
    const active = this.active;
    if (active === null) {
      return;
    }
    active.stopped = true;
    active.paused = false;
    active.waitResolve?.();
    active.waitResolve = null;
    await active.loop;
    const state = await this.getValidationState();
    if (state.status === "running") {
      await this.dependencies.db.request("health.pauseValidation", {
        sessionId: active.sessionId,
        now: this.now(),
      });
    }
  }

  private begin(
    state: ValidationState,
    sessionId: number,
    workloadLease: WorkloadLease | null,
  ): void {
    const active: ActiveValidation = {
      sessionId,
      levels: state.levels,
      paused: false,
      stopped: false,
      waitResolve: null,
      loop: Promise.resolve(),
    };
    this.active = active;
    this.workloadLease = workloadLease;
    active.loop = this.run(active)
      .catch(async (error: unknown) => {
        this.dependencies.logger.error("Validation run failed", error);
        await this.dependencies.db.request("health.failValidation", {
          sessionId,
          message: errorText(error),
          now: this.now(),
        });
      })
      .finally(() => {
        this.workloadLease?.release();
        this.workloadLease = null;
        if (this.active === active) {
          this.active = null;
        }
      });
  }

  private async run(active: ActiveValidation): Promise<void> {
    for (const level of active.levels) {
      if (active.stopped) {
        return;
      }
      await this.runLevel(active, level);
    }
    if (!active.stopped) {
      await this.dependencies.db.request("health.finishValidation", {
        sessionId: active.sessionId,
        now: this.now(),
      });
    }
  }

  private async runLevel(active: ActiveValidation, level: ValidationLevel): Promise<void> {
    await this.dependencies.db.request("health.setValidationLevel", {
      sessionId: active.sessionId,
      level,
      now: this.now(),
    });
    while (!active.stopped) {
      await this.waitIfPaused(active);
      if (active.stopped) {
        return;
      }
      const batch = await this.dependencies.db.request<ValidationFile[]>(
        "health.listPendingValidation",
        { sessionId: active.sessionId, level, limit: 25 },
      );
      if (batch.length === 0) {
        return;
      }
      await this.processBatch(active, level, batch);
    }
  }

  private async processBatch(
    active: ActiveValidation,
    level: ValidationLevel,
    batch: ValidationFile[],
  ): Promise<void> {
    for (const file of batch) {
      await this.waitIfPaused(active);
      if (active.stopped) {
        return;
      }
      const result = await this.checker.check(level, file);
      await this.dependencies.db.request("health.saveValidationResults", {
        sessionId: active.sessionId,
        items: [result],
        now: this.now(),
      });
    }
  }

  private async waitIfPaused(active: ActiveValidation): Promise<void> {
    if (!active.paused) {
      return;
    }
    await new Promise<void>((resolve) => {
      active.waitResolve = resolve;
    });
  }

  private now(): string {
    return this.nowDate().toISOString();
  }
}
