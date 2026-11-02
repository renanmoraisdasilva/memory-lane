import path from "node:path";
import type Database from "better-sqlite3";
import { DUPLICATE_QUARANTINE_DIR } from "@shared/domain/duplicate-cleanup";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { CleanupDbMethod } from "./cleanup-worker-protocol";
import {
  CleanupFinishDbParamsSchema,
  CleanupMovesDbParamsSchema,
  CleanupStartDbParamsSchema,
  CleanupStateDbParamsSchema,
} from "./cleanup-worker-protocol";
import {
  applyCleanupMoves,
  finishCleanupRun,
  getCleanupPlan,
  getCleanupSummary,
  getLatestCleanupState,
  getLatestQuarantinePath,
  startCleanupRun,
} from "./repositories/health-cleanup-repository";

type Handler = (params: unknown) => unknown;
type HandlerMap = Record<CleanupDbMethod, Handler>;

export interface CleanupDbHandlerOptions {
  getCatalog: () => Database.Database;
  getCatalogPath: () => string;
}

export interface CleanupDbHandler {
  handle(method: CleanupDbMethod, params: unknown): unknown;
}

export function catalogRoot(catalogPath: string): string {
  return path.dirname(path.dirname(path.resolve(catalogPath)));
}

export function quarantineRootFor(catalogPath: string): string {
  return path.join(catalogRoot(catalogPath), DUPLICATE_QUARANTINE_DIR);
}

export function createCleanupDbHandlers(options: CleanupDbHandlerOptions): CleanupDbHandler {
  const handlers: HandlerMap = {
    "cleanup.getSummary": () =>
      getCleanupSummary(
        options.getCatalog(),
        catalogRoot(options.getCatalogPath()),
        quarantineRootFor(options.getCatalogPath()),
      ),
    "cleanup.getPlan": () =>
      getCleanupPlan(
        options.getCatalog(),
        catalogRoot(options.getCatalogPath()),
        quarantineRootFor(options.getCatalogPath()),
      ),
    "cleanup.getState": (params) => {
      const parsed = CleanupStateDbParamsSchema.parse(params);
      return getLatestCleanupState(options.getCatalog(), parsed.now);
    },
    "cleanup.start": (params) =>
      startCleanupRun(options.getCatalog(), CleanupStartDbParamsSchema.parse(params)),
    "cleanup.applyMoves": (params) => {
      const parsed = CleanupMovesDbParamsSchema.parse(params);
      return applyCleanupMoves(options.getCatalog(), parsed.runId, parsed.moves);
    },
    "cleanup.finish": (params) =>
      finishCleanupRun(options.getCatalog(), CleanupFinishDbParamsSchema.parse(params)),
    "cleanup.getQuarantinePath": () => getLatestQuarantinePath(options.getCatalog()),
  };

  return {
    handle(method: CleanupDbMethod, params: unknown): unknown {
      const handler = handlers[method];
      if (handler === undefined) {
        throw new AppError(
          APP_ERROR_CODES.INVALID_REQUEST,
          `Unknown cleanup database method: ${method}`,
        );
      }
      return handler(params);
    },
  };
}
