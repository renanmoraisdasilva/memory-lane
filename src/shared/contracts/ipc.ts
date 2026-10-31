import { z } from "zod";
import type { AppErrorPayload } from "../domain/errors";
import { VolumeIdSchema } from "./drives";

export { IPC_CHANNELS } from "./channels";

export const AppDatabaseStateSchema = z.object({
  state: z.enum(["ready", "error"]),
  appDbPath: z.string(),
  schemaVersion: z.number().int().nonnegative(),
  message: z.string().optional(),
});
export const AppInfoSchema = z.object({
  appVersion: z.string(),
  electronVersion: z.string(),
  platform: z.string(),
  isPackaged: z.boolean(),
  userDataPath: z.string(),
  logPath: z.string(),
  database: AppDatabaseStateSchema,
});
export type AppInfo = z.infer<typeof AppInfoSchema>;

export const InitializeCatalogParamsSchema = z.object({
  volumeId: VolumeIdSchema,
});
export type InitializeCatalogParams = z.infer<typeof InitializeCatalogParamsSchema>;

export const OpenCatalogParamsSchema = z.object({
  volumeId: VolumeIdSchema,
});
export type OpenCatalogParams = z.infer<typeof OpenCatalogParamsSchema>;

export const ConfirmDriveIdentityParamsSchema = z.object({
  volumeId: VolumeIdSchema,
});
export type ConfirmDriveIdentityParams = z.infer<typeof ConfirmDriveIdentityParamsSchema>;

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: AppErrorPayload };
