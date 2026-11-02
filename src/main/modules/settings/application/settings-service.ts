import { rm, stat } from "node:fs/promises";
import path from "node:path";
import type {
  BackupResult,
  BackupState,
  CacheClearResult,
  CacheStats,
  SettingsInfo,
} from "@shared/contracts/settings";
import {
  BackupResultSchema,
  CacheClearResultSchema,
  SettingsInfoSchema,
} from "@shared/contracts/settings";
import { APP_ERROR_CODES, isAppError } from "@shared/domain/errors";
import type { DbClient } from "../../../clients/db-client";
import type { DatabaseBackupRunner } from "../../../db/backup-runner";
import type { Logger } from "../../../logging/types";
import type { AppPaths } from "../../../platform/app-paths";
import type { AppService } from "../../app/application/app-service";

interface CatalogContext {
  volumeId: string;
  catalogPath: string;
  cachePath: string;
}

export interface SettingsServiceDependencies {
  db: DbClient;
  appService: AppService;
  paths: AppPaths;
  backupRunner: DatabaseBackupRunner;
  logger: Logger;
  now?: () => Date;
  backupIntervalMs?: number;
}

const DEFAULT_BACKUP_INTERVAL_MS = 15 * 60 * 1000;

async function fileSize(filePath: string): Promise<number> {
  try {
    return (await stat(filePath)).size;
  } catch {
    return 0;
  }
}

export class SettingsService {
  private readonly nowDate: () => Date;
  private readonly backupIntervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private backupInFlight: Promise<BackupResult> | null = null;

  constructor(private readonly dependencies: SettingsServiceDependencies) {
    this.nowDate = dependencies.now ?? (() => new Date());
    this.backupIntervalMs = dependencies.backupIntervalMs ?? DEFAULT_BACKUP_INTERVAL_MS;
  }

  async getInfo(): Promise<SettingsInfo> {
    const [appInfo, context] = await Promise.all([
      this.dependencies.appService.getInfo(),
      this.context(),
    ]);
    const [cache, catalogBytes, backup] = await Promise.all([
      this.dependencies.db.request<CacheStats>("settings.getCacheStats", {}),
      fileSize(context.catalogPath),
      this.dependencies.db.request<BackupState>("settings.getBackupState", {}),
    ]);
    return SettingsInfoSchema.parse({
      appVersion: appInfo.appVersion,
      electronVersion: appInfo.electronVersion,
      platform: appInfo.platform,
      isPackaged: appInfo.isPackaged,
      offline: true,
      cache: { path: context.cachePath, bytes: cache.bytes, files: cache.files },
      catalog: { path: context.catalogPath, bytes: catalogBytes },
      backup: {
        path: path.join(this.dependencies.paths.backupsPath, context.volumeId),
        lastBackupAt: backup.lastBackupAt,
        lastStatus: backup.lastStatus,
        lastBytes: backup.lastBytes,
      },
    });
  }

  async clearCache(): Promise<CacheClearResult> {
    const context = await this.context();
    const stats = await this.dependencies.db.request<CacheStats>("settings.getCacheStats", {});
    await this.dependencies.db.request("settings.clearCache", {});
    await rm(context.cachePath, { recursive: true, force: true });
    this.dependencies.logger.info("Cleared thumbnail cache", {
      bytes: stats.bytes,
      files: stats.files,
    });
    return CacheClearResultSchema.parse({
      removedFiles: stats.files,
      freedBytes: stats.bytes,
    });
  }

  runBackup(): Promise<BackupResult> {
    if (this.backupInFlight !== null) {
      return this.backupInFlight;
    }
    const run = this.performBackup();
    this.backupInFlight = run;
    void run
      .finally(() => {
        if (this.backupInFlight === run) {
          this.backupInFlight = null;
        }
      })
      .catch(() => undefined);
    return run;
  }

  private async performBackup(): Promise<BackupResult> {
    const context = await this.context();
    const backupDir = path.join(this.dependencies.paths.backupsPath, context.volumeId);
    const now = this.now();
    try {
      const result = BackupResultSchema.parse(
        await this.dependencies.backupRunner.run({
          appDbPath: this.dependencies.paths.appDbPath,
          catalogPath: context.catalogPath,
          backupDir,
          now,
        }),
      );
      await this.recordBackup({
        volumeId: context.volumeId,
        backupPath: result.path,
        bytes: result.bytes,
        now,
        status: "success",
      });
      return result;
    } catch (error) {
      await this.recordBackup({
        volumeId: context.volumeId,
        backupPath: backupDir,
        bytes: 0,
        now,
        status: "failed",
      });
      throw error;
    }
  }

  private async recordBackup(input: {
    volumeId: string;
    backupPath: string;
    bytes: number;
    now: string;
    status: "success" | "failed";
  }): Promise<void> {
    try {
      await this.dependencies.db.request("settings.recordBackup", {
        volumeId: input.volumeId,
        path: input.backupPath,
        bytes: input.bytes,
        now: input.now,
        status: input.status,
      });
    } catch (error) {
      this.dependencies.logger.warn("Could not record database backup", {
        message: error instanceof Error ? error.message : String(error),
        status: input.status,
      });
    }
  }

  startBackupTimer(): void {
    if (this.timer !== null) {
      return;
    }
    this.timer = setInterval(() => {
      void this.backupIfCatalogOpen();
    }, this.backupIntervalMs);
    this.timer.unref();
  }

  async shutdown(): Promise<void> {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.backupIfCatalogOpen();
  }

  private async backupIfCatalogOpen(): Promise<void> {
    try {
      await this.runBackup();
      this.dependencies.logger.info("Scheduled database backup completed");
    } catch (error) {
      if (isAppError(error) && error.code === APP_ERROR_CODES.CATALOG_NOT_FOUND) {
        return;
      }
      this.dependencies.logger.warn("Scheduled database backup failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async context(): Promise<CatalogContext> {
    return this.dependencies.db.request<CatalogContext>("library.getContext", {});
  }

  private now(): string {
    return this.nowDate().toISOString();
  }
}
