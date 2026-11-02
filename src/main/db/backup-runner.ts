import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import type Database from "better-sqlite3";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { BackupResultSchema, type BackupResult } from "@shared/contracts/settings";
import { openDatabase } from "./connection";

export interface DatabaseBackupRequest {
  appDbPath: string;
  catalogPath: string;
  backupDir: string;
  now: string;
}

export interface DatabaseBackupRunner {
  run(request: DatabaseBackupRequest): Promise<BackupResult>;
}

const BACKUP_BUSY_TIMEOUT_MS = 30_000;

function backupPaths(backupDir: string): {
  catalog: string;
  catalogTemp: string;
  app: string;
  appTemp: string;
} {
  const catalog = path.join(backupDir, "catalog.db");
  const app = path.join(backupDir, "app.db");
  return {
    catalog,
    catalogTemp: `${catalog}.tmp`,
    app,
    appTemp: `${app}.tmp`,
  };
}

async function removeTemporaryFiles(paths: ReturnType<typeof backupPaths>): Promise<void> {
  await Promise.all([
    rm(paths.catalogTemp, { force: true }).catch(() => undefined),
    rm(paths.appTemp, { force: true }).catch(() => undefined),
  ]);
}

export async function runDatabaseBackup(request: DatabaseBackupRequest): Promise<BackupResult> {
  const paths = backupPaths(request.backupDir);
  let catalog: Database.Database | null = null;
  let appDb: Database.Database | null = null;

  try {
    catalog = openDatabase(request.catalogPath, {
      busyTimeoutMs: BACKUP_BUSY_TIMEOUT_MS,
      readonly: true,
    });
    appDb = openDatabase(request.appDbPath, {
      busyTimeoutMs: BACKUP_BUSY_TIMEOUT_MS,
      readonly: true,
    });

    await mkdir(request.backupDir, { recursive: true });
    await removeTemporaryFiles(paths);

    await catalog.backup(paths.catalogTemp);
    await appDb.backup(paths.appTemp);
    await rename(paths.catalogTemp, paths.catalog);
    await rename(paths.appTemp, paths.app);

    const bytes = (await stat(paths.catalog)).size + (await stat(paths.app)).size;
    return BackupResultSchema.parse({
      path: paths.catalog,
      bytes,
      createdAt: request.now,
      status: "success",
    });
  } catch (error) {
    await removeTemporaryFiles(paths);
    throw new AppError(APP_ERROR_CODES.DB_ERROR, "Database backup failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (catalog !== null && catalog.open) {
      catalog.close();
    }
    if (appDb !== null && appDb.open) {
      appDb.close();
    }
  }
}
