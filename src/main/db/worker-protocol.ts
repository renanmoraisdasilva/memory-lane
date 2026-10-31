import { z } from "zod";
import { DriveIdentitySchema } from "@shared/contracts/drives";
import type { AppErrorPayload } from "@shared/domain/errors";
import type { HealthDbMethod } from "./health-worker-protocol";
import type { LibraryDbMethod } from "./library-worker-protocol";
import type { ScanDbMethod } from "./scan-worker-protocol";

export const CatalogCreateParamsSchema = z.object({
  catalogPath: z.string().min(1),
  cachePath: z.string().min(1),
  identity: DriveIdentitySchema,
  catalogSchema: z.number().int().positive(),
});

export const CatalogOpenParamsSchema = z.object({
  catalogPath: z.string().min(1),
  identity: DriveIdentitySchema,
});

export const RegisterDriveParamsSchema = z.object({
  identity: DriveIdentitySchema,
  lastSeenAt: z.string().min(1),
  catalogSchema: z.number().int().positive(),
});

export type CoreDbMethod =
  "health" | "app.listDrives" | "app.registerDrive" | "catalog.create" | "catalog.open" | "close";

export type DbMethod = CoreDbMethod | ScanDbMethod | LibraryDbMethod | HealthDbMethod;

export interface DbRequest {
  id: number;
  method: DbMethod;
  params: unknown;
}

export type DbResponse =
  { id: number; ok: true; data: unknown } | { id: number; ok: false; error: AppErrorPayload };

export function dbSuccess(id: number, data: unknown): DbResponse {
  return { id, ok: true, data };
}

export function dbFailure(id: number, error: AppErrorPayload): DbResponse {
  return { id, ok: false, error };
}

export function isDbResponse(value: unknown): value is DbResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as { id?: unknown; ok?: unknown };
  return typeof candidate.id === "number" && typeof candidate.ok === "boolean";
}
