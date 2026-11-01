import { z } from "zod";

export const APP_ERROR_CODES = {
  INVALID_REQUEST: "INVALID_REQUEST",
  FORBIDDEN: "FORBIDDEN",
  DRIVE_NOT_FOUND: "DRIVE_NOT_FOUND",
  DRIVE_UNSUPPORTED: "DRIVE_UNSUPPORTED",
  CATALOG_NOT_FOUND: "CATALOG_NOT_FOUND",
  CATALOG_ALREADY_EXISTS: "CATALOG_ALREADY_EXISTS",
  CATALOG_LOCKED: "CATALOG_LOCKED",
  CATALOG_MISMATCH: "CATALOG_MISMATCH",
  SCAN_ALREADY_RUNNING: "SCAN_ALREADY_RUNNING",
  SCAN_STATE_INVALID: "SCAN_STATE_INVALID",
  SCAN_FAILED: "SCAN_FAILED",
  LIBRARY_ITEM_NOT_FOUND: "LIBRARY_ITEM_NOT_FOUND",
  DESTINATION_NOT_FOUND: "DESTINATION_NOT_FOUND",
  DESTINATION_DISCONNECTED: "DESTINATION_DISCONNECTED",
  DESTINATION_OVERLAP: "DESTINATION_OVERLAP",
  DESTINATION_WRITE_FAILED: "DESTINATION_WRITE_FAILED",
  DESTINATION_FULL: "DESTINATION_FULL",
  SOURCE_CHANGED: "SOURCE_CHANGED",
  SOURCE_DISCONNECTED: "SOURCE_DISCONNECTED",
  REPLICATION_RUN_ACTIVE: "REPLICATION_RUN_ACTIVE",
  REPLICATION_RUN_NOT_FOUND: "REPLICATION_RUN_NOT_FOUND",
  REPLICATION_STATE_INVALID: "REPLICATION_STATE_INVALID",
  CONFLICT_REVIEW_REQUIRED: "CONFLICT_REVIEW_REQUIRED",
  WORKLOAD_CONFLICT: "WORKLOAD_CONFLICT",
  MEDIA_UNAVAILABLE: "MEDIA_UNAVAILABLE",
  SHELL_ACTION_FAILED: "SHELL_ACTION_FAILED",
  DB_ERROR: "DB_ERROR",
  WORKER_ERROR: "WORKER_ERROR",
  INTERNAL: "INTERNAL",
} as const;

export const AppErrorCodeSchema = z.enum([
  "INVALID_REQUEST",
  "FORBIDDEN",
  "DRIVE_NOT_FOUND",
  "DRIVE_UNSUPPORTED",
  "CATALOG_NOT_FOUND",
  "CATALOG_ALREADY_EXISTS",
  "CATALOG_LOCKED",
  "CATALOG_MISMATCH",
  "SCAN_ALREADY_RUNNING",
  "SCAN_STATE_INVALID",
  "SCAN_FAILED",
  "LIBRARY_ITEM_NOT_FOUND",
  "DESTINATION_NOT_FOUND",
  "DESTINATION_DISCONNECTED",
  "DESTINATION_OVERLAP",
  "DESTINATION_WRITE_FAILED",
  "DESTINATION_FULL",
  "SOURCE_CHANGED",
  "SOURCE_DISCONNECTED",
  "REPLICATION_RUN_ACTIVE",
  "REPLICATION_RUN_NOT_FOUND",
  "REPLICATION_STATE_INVALID",
  "CONFLICT_REVIEW_REQUIRED",
  "WORKLOAD_CONFLICT",
  "MEDIA_UNAVAILABLE",
  "SHELL_ACTION_FAILED",
  "DB_ERROR",
  "WORKER_ERROR",
  "INTERNAL",
]);

export type AppErrorCode = z.infer<typeof AppErrorCodeSchema>;

export interface AppErrorPayload {
  code: AppErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: AppErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(APP_ERROR_CODES.INTERNAL, error.message, { name: error.name });
  }

  return new AppError(APP_ERROR_CODES.INTERNAL, "Unexpected application error");
}

export function toAppErrorPayload(error: unknown): AppErrorPayload {
  const appError = toAppError(error);
  if (appError.details === undefined) {
    return { code: appError.code, message: appError.message };
  }
  return { code: appError.code, message: appError.message, details: appError.details };
}
