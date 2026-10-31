import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import type Database from "better-sqlite3";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import {
  BackupResultSchema,
  BackupStateSchema,
  type BackupResult,
  type BackupState,
} from "@shared/contracts/settings";
import type { SettingsDbHandler, SettingsDbHandlerOptions } from "./settings-worker-protocol";
import { SettingsBackupDbParamsSchema } from "./settings-worker-protocol";
import { readDriveIdentity } from "./repositories/catalog-repository";

interface DriveBackupRow {
  last_backup_at: string | null;
}

interface HistoryRow {
  path: string;
  bytes: number;
  status: "success" | "failed";
}

function readBackupState(appDb: Database.Database, catalog: Database.Database): BackupState {
  const volumeId = readDriveIdentity(catalog).volumeId;
  const drive = appDb
    .prepare("SELECT last_backup_at FROM registered_drives WHERE volume_id = ?")
    .get(volumeId) as DriveBackupRow | undefined;
  const history = appDb
    .prepare(
      `SELECT path, bytes, status FROM backup_history
       WHERE drive_volume_id = ?
       ORDER BY id DESC LIMIT 1`,
    )
    .get(volumeId) as HistoryRow | undefined;
  return BackupStateSchema.parse({
    lastBackupAt: drive?.last_backup_at ?? null,
    lastStatus: history?.status ?? null,
    lastPath: history?.path ?? null,
    lastBytes: history?.bytes ?? null,
  });
}

async function runBackup(
  appDb: Database.Database,
  catalog: Database.Database,
  backupDir: string,
  now: string,
): Promise<BackupResult> {
  const volumeId = readDriveIdentity(catalog).volumeId;
  const catalogBackup = path.join(backupDir, "catalog.db");
  const appBackup = path.join(backupDir, "app.db");
  try {
    await mkdir(backupDir, { recursive: true });
    await catalog.backup(catalogBackup);
    await appDb.backup(appBackup);
    const bytes = (await stat(catalogBackup)).size + (await stat(appBackup)).size;
    appDb
      .prepare(
        `INSERT INTO backup_history
           (drive_volume_id, path, bytes, created_at, status)
         VALUES (?, ?, ?, ?, 'success')`,
      )
      .run(volumeId, catalogBackup, bytes, now);
    appDb
      .prepare("UPDATE registered_drives SET last_backup_at = ? WHERE volume_id = ?")
      .run(now, volumeId);
    return BackupResultSchema.parse({
      path: catalogBackup,
      bytes,
      createdAt: now,
      status: "success",
    });
  } catch (error) {
    try {
      appDb
        .prepare(
          `INSERT INTO backup_history
             (drive_volume_id, path, bytes, created_at, status)
           VALUES (?, ?, 0, ?, 'failed')`,
        )
        .run(volumeId, backupDir, now);
    } catch {
      // Keep the original backup error.
    }
    throw new AppError(APP_ERROR_CODES.DB_ERROR, "Database backup failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export function createSettingsDbHandlers(options: SettingsDbHandlerOptions): SettingsDbHandler {
  return {
    handle(method, params) {
      switch (method) {
        case "settings.getBackupState":
          return readBackupState(options.getAppDb(), options.getCatalog());
        case "settings.backup": {
          const parsed = SettingsBackupDbParamsSchema.parse(params);
          return runBackup(options.getAppDb(), options.getCatalog(), parsed.backupDir, parsed.now);
        }
        case "settings.clearCache":
          return {
            removed: options.getCatalog().prepare("DELETE FROM cache_entries").run().changes,
          };
      }
    },
  };
}

export type { SettingsDbHandler };
