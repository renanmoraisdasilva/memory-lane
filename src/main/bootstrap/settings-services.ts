import path from "node:path";
import { createWorkerBackupRunner } from "../clients/backup-client";
import type { DbClient } from "../clients/db-client";
import type { Logger } from "../logging/types";
import type { AppService } from "../modules/app/application/app-service";
import { SettingsService } from "../modules/settings/application/settings-service";
import type { AppPaths } from "../platform/app-paths";

export interface SettingsServiceDependencies {
  db: DbClient;
  appService: AppService;
  paths: AppPaths;
  logger: Logger;
}

export function createSettingsService(dependencies: SettingsServiceDependencies): SettingsService {
  return new SettingsService({
    ...dependencies,
    backupRunner: createWorkerBackupRunner({
      workerPath: path.join(__dirname, "backup-worker.js"),
    }),
  });
}
