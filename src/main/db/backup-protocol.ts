import { z } from "zod";
import { AppErrorCodeSchema } from "@shared/domain/errors";
import type { BackupResult } from "@shared/contracts/settings";

export const DatabaseBackupWorkerDataSchema = z.object({
  appDbPath: z.string().min(1),
  catalogPath: z.string().min(1),
  backupDir: z.string().min(1),
  now: z.string().min(1),
});

const WorkerErrorSchema = z.object({
  code: AppErrorCodeSchema,
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const DatabaseBackupWorkerMessageSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), result: z.unknown() }),
  z.object({ ok: z.literal(false), error: WorkerErrorSchema }),
]);

export type DatabaseBackupWorkerMessage =
  { ok: true; result: BackupResult } | { ok: false; error: z.infer<typeof WorkerErrorSchema> };

export function isDatabaseBackupWorkerMessage(
  value: unknown,
): value is DatabaseBackupWorkerMessage {
  return DatabaseBackupWorkerMessageSchema.safeParse(value).success;
}
