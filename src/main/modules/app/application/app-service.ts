import type { AppInfo } from "@shared/contracts/ipc";
import { toAppError } from "@shared/domain/errors";
import type { DbClient } from "../../../clients/db-client";

interface HealthResult {
  appDbPath: string;
  schemaVersion: number;
}

export interface AppServiceDependencies {
  db: DbClient;
  appDbPath: string;
  userDataPath: string;
  logPath: string;
  appVersion: string;
  electronVersion: string;
  platform: string;
  isPackaged: boolean;
}

export class AppService {
  constructor(private readonly dependencies: AppServiceDependencies) {}

  async getInfo(): Promise<AppInfo> {
    try {
      const health = await this.dependencies.db.request<HealthResult>("health", {});
      return {
        appVersion: this.dependencies.appVersion,
        electronVersion: this.dependencies.electronVersion,
        platform: this.dependencies.platform,
        isPackaged: this.dependencies.isPackaged,
        userDataPath: this.dependencies.userDataPath,
        logPath: this.dependencies.logPath,
        database: {
          state: "ready",
          appDbPath: health.appDbPath,
          schemaVersion: health.schemaVersion,
        },
      };
    } catch (error) {
      const appError = toAppError(error);
      return {
        appVersion: this.dependencies.appVersion,
        electronVersion: this.dependencies.electronVersion,
        platform: this.dependencies.platform,
        isPackaged: this.dependencies.isPackaged,
        userDataPath: this.dependencies.userDataPath,
        logPath: this.dependencies.logPath,
        database: {
          state: "error",
          appDbPath: this.dependencies.appDbPath,
          schemaVersion: 0,
          message: appError.message,
        },
      };
    }
  }
}
