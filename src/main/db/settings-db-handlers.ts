import type Database from "better-sqlite3";
import {
  BackupStateSchema,
  CacheStatsSchema,
  type BackupState,
  type CacheStats,
} from "@shared/contracts/settings";
import type { SettingsDbHandler, SettingsDbHandlerOptions } from "./settings-worker-protocol";
import { SettingsRecordBackupDbParamsSchema } from "./settings-worker-protocol";
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

function readCacheStats(catalog: Database.Database): CacheStats {
  const row = catalog
    .prepare(
      `SELECT COUNT(*) AS files, COALESCE(SUM(bytes), 0) AS bytes
       FROM cache_entries`,
    )
    .get() as CacheStats;
  return CacheStatsSchema.parse(row);
}

function recordBackup(
  appDb: Database.Database,
  input: {
    volumeId: string;
    path: string;
    bytes: number;
    now: string;
    status: "success" | "failed";
  },
): void {
  appDb.transaction(() => {
    appDb
      .prepare(
        `INSERT INTO backup_history
           (drive_volume_id, path, bytes, created_at, status)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(input.volumeId, input.path, input.bytes, input.now, input.status);
    if (input.status === "success") {
      appDb
        .prepare("UPDATE registered_drives SET last_backup_at = ? WHERE volume_id = ?")
        .run(input.now, input.volumeId);
    }
  })();
}

export function createSettingsDbHandlers(options: SettingsDbHandlerOptions): SettingsDbHandler {
  return {
    handle(method, params) {
      switch (method) {
        case "settings.getBackupState":
          return readBackupState(options.getAppDb(), options.getCatalog());
        case "settings.getCacheStats":
          return readCacheStats(options.getCatalog());
        case "settings.recordBackup": {
          const parsed = SettingsRecordBackupDbParamsSchema.parse(params);
          recordBackup(options.getAppDb(), parsed);
          return { saved: true };
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
