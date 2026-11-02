import type Database from "better-sqlite3";
import { z } from "zod";

export const SETTINGS_DB_METHODS = [
  "settings.getBackupState",
  "settings.getCacheStats",
  "settings.recordBackup",
  "settings.clearCache",
] as const;

export type SettingsDbMethod = (typeof SETTINGS_DB_METHODS)[number];

export const SettingsRecordBackupDbParamsSchema = z.object({
  volumeId: z.string().min(1),
  path: z.string().min(1),
  bytes: z.number().int().nonnegative(),
  now: z.string().min(1),
  status: z.enum(["success", "failed"]),
});

export interface SettingsDbHandlerOptions {
  getAppDb: () => Database.Database;
  getCatalog: () => Database.Database;
}

export interface SettingsDbHandler {
  handle(method: SettingsDbMethod, params: unknown): unknown;
}
