import { z } from "zod";

export const BackupStatusSchema = z.enum(["success", "failed"]);

export const BackupStateSchema = z.object({
  lastBackupAt: z.string().min(1).nullable(),
  lastStatus: BackupStatusSchema.nullable(),
  lastPath: z.string().min(1).nullable(),
  lastBytes: z.number().int().nonnegative().nullable(),
});
export type BackupState = z.infer<typeof BackupStateSchema>;

export const SettingsInfoSchema = z.object({
  appVersion: z.string().min(1),
  electronVersion: z.string().min(1),
  platform: z.string().min(1),
  isPackaged: z.boolean(),
  offline: z.literal(true),
  cache: z.object({
    path: z.string().min(1),
    bytes: z.number().int().nonnegative(),
    files: z.number().int().nonnegative(),
  }),
  catalog: z.object({
    path: z.string().min(1),
    bytes: z.number().int().nonnegative(),
  }),
  backup: z.object({
    path: z.string().min(1),
    lastBackupAt: z.string().min(1).nullable(),
    lastStatus: BackupStatusSchema.nullable(),
    lastBytes: z.number().int().nonnegative().nullable(),
  }),
});
export type SettingsInfo = z.infer<typeof SettingsInfoSchema>;

export const CacheClearResultSchema = z.object({
  removedFiles: z.number().int().nonnegative(),
  freedBytes: z.number().int().nonnegative(),
});
export type CacheClearResult = z.infer<typeof CacheClearResultSchema>;

export const BackupResultSchema = z.object({
  path: z.string().min(1),
  bytes: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
  status: BackupStatusSchema,
});
export type BackupResult = z.infer<typeof BackupResultSchema>;
