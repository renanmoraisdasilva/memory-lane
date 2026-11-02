import { Worker } from "node:worker_threads";
import { BackupResultSchema, type BackupResult } from "@shared/contracts/settings";
import { APP_ERROR_CODES, AppError, toAppError } from "@shared/domain/errors";
import type { DatabaseBackupRequest, DatabaseBackupRunner } from "../db/backup-runner";
import { isDatabaseBackupWorkerMessage } from "../db/backup-protocol";

const BACKUP_TIMEOUT_MS = 5 * 60 * 1000;

export interface WorkerBackupRunnerOptions {
  workerPath: string;
  timeoutMs?: number;
}

export function createWorkerBackupRunner(options: WorkerBackupRunnerOptions): DatabaseBackupRunner {
  return {
    run(request: DatabaseBackupRequest): Promise<BackupResult> {
      return new Promise((resolve, reject) => {
        const worker = new Worker(options.workerPath, { workerData: request });
        let settled = false;
        let timer: NodeJS.Timeout | null = null;

        const finish = (action: () => void): void => {
          if (settled) {
            return;
          }
          settled = true;
          if (timer !== null) {
            clearTimeout(timer);
          }
          action();
          void worker.terminate();
        };

        timer = setTimeout(() => {
          finish(() => {
            reject(new AppError(APP_ERROR_CODES.WORKER_ERROR, "Database backup timed out"));
          });
        }, options.timeoutMs ?? BACKUP_TIMEOUT_MS);
        timer.unref();

        worker.once("message", (message: unknown) => {
          if (!isDatabaseBackupWorkerMessage(message)) {
            finish(() => {
              reject(
                new AppError(
                  APP_ERROR_CODES.WORKER_ERROR,
                  "Invalid database backup worker response",
                ),
              );
            });
            return;
          }
          if (!message.ok) {
            finish(() => {
              reject(
                new AppError(message.error.code, message.error.message, message.error.details),
              );
            });
            return;
          }
          try {
            const result = BackupResultSchema.parse(message.result);
            finish(() => {
              resolve(result);
            });
          } catch (error) {
            finish(() => {
              reject(toAppError(error));
            });
          }
        });

        worker.once("error", (error) => {
          finish(() => {
            reject(toAppError(error));
          });
        });

        worker.once("exit", (code) => {
          if (!settled) {
            finish(() => {
              reject(
                new AppError(
                  APP_ERROR_CODES.WORKER_ERROR,
                  `Database backup worker exited with code ${String(code)}`,
                ),
              );
            });
          }
        });
      });
    },
  };
}
