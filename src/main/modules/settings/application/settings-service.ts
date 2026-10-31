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
  private backupInFlight = false;

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

  async runBackup(): Promise<BackupResult> {
    const context = await this.context();
    const result = await this.dependencies.db.request<BackupResult>("settings.backup", {
      backupDir: path.join(this.dependencies.paths.backupsPath, context.volumeId),
      now: this.now(),
    });
    return BackupResultSchema.parse(result);
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
    if (this.backupInFlight) {
      return;
    }
    this.backupInFlight = true;
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
    } finally {
      this.backupInFlight = false;
    }
  }

  private async context(): Promise<CatalogContext> {
    return this.dependencies.db.request<CatalogContext>("library.getContext", {});
  }

  private now(): string {
    return this.nowDate().toISOString();
  }
}
