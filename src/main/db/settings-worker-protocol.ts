import type Database from "better-sqlite3";
import { z } from "zod";
import type { BackupState, BackupResult } from "@shared/contracts/settings";

export const SETTINGS_DB_METHODS = [
  "settings.getBackupState",
  "settings.backup",
  "settings.clearCache",
] as const;

export type SettingsDbMethod = (typeof SETTINGS_DB_METHODS)[number];

export const SettingsBackupDbParamsSchema = z.object({
  backupDir: z.string().min(1),
  now: z.string().min(1),
});

export interface SettingsDbHandlerOptions {
  getAppDb: () => Database.Database;
  getCatalog: () => Database.Database;
}

export interface SettingsDbHandler {
  handle(method: SettingsDbMethod, params: unknown): unknown;
}

export type { BackupResult, BackupState };
