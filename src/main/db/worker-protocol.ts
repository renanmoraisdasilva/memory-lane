import { z } from "zod";
import { DriveIdentitySchema } from "@shared/contracts/drives";
import type { AppErrorPayload } from "@shared/domain/errors";

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

export type DbMethod =
  "health" | "app.listDrives" | "app.registerDrive" | "catalog.create" | "catalog.open" | "close";

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
