import fs from "node:fs/promises";
import path from "node:path";
import type { VolumeId } from "@shared/contracts/drives";
import type { ScanIntensity, ScanState } from "@shared/contracts/scan";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { DbClient } from "../../../clients/db-client";
import type { Logger } from "../../../logging/types";
import type { DetectedDrive } from "../../drives/domain/drive";
import { getCatalogPaths } from "../../drives/application/drive-service";
import type {
  FileHasher,
  FileMetadataExtractor,
  ThumbnailWorkScheduler,
} from "../domain/scan-files";
import { ScanRunner } from "./scan-runner";
import type { ScanRuntime } from "./scan-runtime";

class ScanStoppedError extends Error {
  constructor() {
    super("Scan stopped");
    this.name = "ScanStoppedError";
  }
}

interface PauseGate {
  promise: Promise<void>;
  resolve: () => void;
}

interface ActiveScan {
  volumeId: VolumeId;
  rootPath: string;
  cachePath: string;
  state: ScanState;
  paused: boolean;
  stopping: boolean;
  gate: PauseGate | null;
  loop: Promise<void> | null;
}

export interface ScanServiceDependencies {
  db: DbClient;
  listDetected: () => Promise<DetectedDrive[]>;
  logger: Logger;
  metadata: FileMetadataExtractor;
  thumbnails: ThumbnailWorkScheduler;
  hasher: FileHasher;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
  batchDelayMs?: number;
}

function createPauseGate(): PauseGate {
  let resolveGate: (() => void) | null = null;
  const promise = new Promise<void>((resolve) => {
    resolveGate = resolve;
  });
  return {
    promise,
    resolve: () => resolveGate?.(),
  };
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export class ScanService {
  private readonly db: DbClient;
  private readonly listDetected: () => Promise<DetectedDrive[]>;
  private readonly logger: Logger;
  private readonly metadata: FileMetadataExtractor;
  private readonly thumbnails: ThumbnailWorkScheduler;
  private readonly hasher: FileHasher;
  private readonly nowDate: () => Date;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly batchDelayMs: number;
  private active: ActiveScan | null = null;

  constructor(dependencies: ScanServiceDependencies) {
    this.db = dependencies.db;
    this.listDetected = dependencies.listDetected;
    this.logger = dependencies.logger;
    this.metadata = dependencies.metadata;
    this.thumbnails = dependencies.thumbnails;
    this.hasher = dependencies.hasher;
    this.nowDate = dependencies.now ?? (() => new Date());
    this.sleep = dependencies.sleep ?? defaultSleep;
    this.batchDelayMs = dependencies.batchDelayMs ?? 0;
  }

  async getState(volumeId: VolumeId): Promise<ScanState> {
    if (this.active !== null && this.active.volumeId === volumeId) {
      return this.active.state;
    }
    return this.db.request<ScanState>("scan.getState", { volumeId });
  }

  async startScan(volumeId: VolumeId, intensity?: ScanIntensity): Promise<ScanState> {
    const drive = await this.resolveDrive(volumeId);
    const paths = getCatalogPaths(drive.rootPath);
    await this.assertCatalog(paths.catalogPath);

    if (this.active !== null) {
      const running =
        this.active.volumeId === volumeId &&
        (this.active.state.status === "active" || this.active.state.status === "paused");
      if (running) {
        throw new AppError(
          APP_ERROR_CODES.SCAN_ALREADY_RUNNING,
          "A scan is already running for this catalog",
        );
      }
      await this.stopActive();
    }

    const current = await this.db.request<ScanState>("scan.getState", { volumeId });
    const chosenIntensity = intensity ?? current.intensity;
    const state = await this.db.request<ScanState>("scan.start", {
      volumeId,
      rootPath: drive.rootPath,
      cachePath: paths.cachePath,
      intensity: chosenIntensity,
      now: this.now(),
    });

    const active = this.createActive(volumeId, drive.rootPath, paths.cachePath, state);
    this.active = active;
    this.launch(active);
    return state;
  }

  async pauseScan(volumeId: VolumeId): Promise<ScanState> {
    const active = this.requireActive(volumeId);
    if (active.state.status !== "active") {
      throw new AppError(APP_ERROR_CODES.SCAN_STATE_INVALID, "The scan is not running");
    }

    active.paused = true;
    active.gate = createPauseGate();
    try {
      const state = await this.db.request<ScanState>("scan.pause", {
        volumeId,
        now: this.now(),
      });
      active.state = state;
      return state;
    } catch (error) {
      active.paused = false;
      active.gate = null;
      throw error;
    }
  }

  async resumeScan(volumeId: VolumeId): Promise<ScanState> {
    if (this.active !== null && this.active.volumeId === volumeId) {
      const active = this.active;
      if (active.state.status !== "paused" && active.state.status !== "error") {
        throw new AppError(APP_ERROR_CODES.SCAN_STATE_INVALID, "The scan is not paused");
      }
      const state = await this.db.request<ScanState>("scan.resume", {
        volumeId,
        now: this.now(),
      });
      active.state = state;
      active.paused = false;
      active.gate?.resolve();
      active.gate = null;
      return state;
    }

    const current = await this.db.request<ScanState>("scan.getState", { volumeId });
    if (
      current.status !== "paused" &&
      current.status !== "interrupted" &&
      current.status !== "error"
    ) {
      throw new AppError(APP_ERROR_CODES.SCAN_STATE_INVALID, "There is no interrupted scan");
    }

    const drive = await this.resolveDrive(volumeId);
    const paths = getCatalogPaths(drive.rootPath);
    await this.assertCatalog(paths.catalogPath);
    const state = await this.db.request<ScanState>("scan.resume", {
      volumeId,
      now: this.now(),
    });

    const active = this.createActive(volumeId, drive.rootPath, paths.cachePath, state);
    this.active = active;
    this.launch(active);
    return state;
  }

  async setIntensity(volumeId: VolumeId, intensity: ScanIntensity): Promise<ScanState> {
    const state = await this.db.request<ScanState>("scan.setIntensity", {
      volumeId,
      intensity,
      now: this.now(),
    });
    if (this.active !== null && this.active.volumeId === volumeId) {
      this.active.state = state;
    }
    return state;
  }

  async interruptActive(): Promise<void> {
    await this.stopActive();
  }

  async shutdown(): Promise<void> {
    await this.stopActive();
  }

  private requireActive(volumeId: VolumeId): ActiveScan {
    if (this.active === null || this.active.volumeId !== volumeId) {
      throw new AppError(APP_ERROR_CODES.SCAN_STATE_INVALID, "No active scan was found");
    }
    return this.active;
  }

  private createActive(
    volumeId: VolumeId,
    rootPath: string,
    cachePath: string,
    state: ScanState,
  ): ActiveScan {
    return {
      volumeId,
      rootPath: path.resolve(rootPath),
      cachePath,
      state,
      paused: false,
      stopping: false,
      gate: null,
      loop: null,
    };
  }

  private launch(active: ActiveScan): void {
    active.loop = this.runActive(active);
    void active.loop.catch((error: unknown) => {
      this.logger.error("Scan loop failed unexpectedly", error);
    });
  }

  private async runActive(active: ActiveScan): Promise<void> {
    const runtime = this.createRuntime(active);
    const runner = new ScanRunner(runtime);

    try {
      active.state = await runner.run(active.state);
      if (active.stopping) {
        return;
      }
      const final = await this.db.request<ScanState>("scan.finalize", {
        volumeId: active.volumeId,
        now: this.now(),
      });
      active.state = final;
    } catch (error) {
      if (error instanceof ScanStoppedError || active.stopping) {
        return;
      }
      const message = error instanceof Error ? error.message : "The scan failed";
      this.logger.error("Scan failed", error);
      try {
        active.state = await this.db.request<ScanState>("scan.fail", {
          volumeId: active.volumeId,
          message,
          now: this.now(),
        });
      } catch (failError) {
        this.logger.error("Failed to persist scan failure", failError);
      }
    } finally {
      if (this.active === active) {
        this.active = null;
      }
    }
  }

  private createRuntime(active: ActiveScan): ScanRuntime {
    return {
      db: this.db,
      volumeId: active.volumeId,
      rootPath: active.rootPath,
      cachePath: active.cachePath,
      logger: this.logger,
      metadata: this.metadata,
      thumbnails: this.thumbnails,
      hasher: this.hasher,
      now: () => this.nowDate(),
      delay: async (milliseconds) => {
        const wait = milliseconds + this.batchDelayMs;
        if (wait > 0) {
          await this.sleep(wait);
        }
      },
      checkpoint: () => this.checkpoint(active),
      publish: (state) => {
        const previous = active.state;
        const preserveStatus = previous.status === "paused" || previous.status === "error";
        active.state = {
          ...state,
          intensity: previous.intensity,
          ...(preserveStatus
            ? {
                status: previous.status,
                errorMessage: previous.errorMessage,
                etaSeconds: previous.etaSeconds,
              }
            : {}),
        };
      },
      getIntensity: () => active.state.intensity,
    };
  }

  private async checkpoint(active: ActiveScan): Promise<void> {
    if (active.stopping) {
      throw new ScanStoppedError();
    }
    while (active.paused) {
      if (active.gate === null) {
        active.gate = createPauseGate();
      }
      await active.gate.promise;
    }
    if (active.stopping) {
      throw new ScanStoppedError();
    }
    try {
      await fs.access(active.rootPath);
    } catch {
      throw new AppError(APP_ERROR_CODES.DRIVE_NOT_FOUND, "The drive disconnected during the scan");
    }
  }

  private async stopActive(): Promise<void> {
    const active = this.active;
    if (active === null) {
      return;
    }

    active.stopping = true;
    active.paused = false;
    active.gate?.resolve();
    active.gate = null;
    await active.loop;

    if (this.active === active) {
      this.active = null;
    }
    if (active.state.status !== "complete") {
      try {
        await this.db.request<ScanState>("scan.interrupt", {
          volumeId: active.volumeId,
          now: this.now(),
        });
      } catch (error) {
        this.logger.warn("Failed to persist scan interruption", error);
      }
    }
  }

  private async resolveDrive(volumeId: VolumeId): Promise<DetectedDrive> {
    const drives = await this.listDetected();
    const drive = drives.find((candidate) => candidate.volumeId === volumeId);
    if (drive === undefined) {
      throw new AppError(APP_ERROR_CODES.DRIVE_NOT_FOUND, "The drive is no longer connected");
    }
    if (drive.driveType === "unknown" || !drive.isExternal) {
      throw new AppError(
        APP_ERROR_CODES.DRIVE_UNSUPPORTED,
        "Select an external drive. The Windows system drive is not supported.",
      );
    }
    return drive;
  }

  private async assertCatalog(catalogPath: string): Promise<void> {
    try {
      await fs.access(catalogPath);
    } catch {
      throw new AppError(APP_ERROR_CODES.CATALOG_NOT_FOUND, "No catalog was found on this drive");
    }
  }

  private now(): string {
    return this.nowDate().toISOString();
  }
}
