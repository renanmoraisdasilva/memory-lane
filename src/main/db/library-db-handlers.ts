import type Database from "better-sqlite3";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { LibraryDbMethod } from "./library-worker-protocol";
import {
  LibraryClearDateDbParamsSchema,
  LibraryFileParamsSchema,
  LibraryItemDbParamsSchema,
  LibrarySaveThumbnailParamsSchema,
  LibrarySetDateDbParamsSchema,
  LibraryTimelineDbParamsSchema,
  LibraryTimelineIndexDbParamsSchema,
  LibraryUndatedDbParamsSchema,
} from "./library-worker-protocol";
import {
  clearDateOverride,
  getUndatedItems,
  setDateOverride,
} from "./repositories/library-date-repository";
import {
  getLibrarySummary,
  getLibraryTimeline,
  getLibraryTimelineIndex,
} from "./repositories/library-repository";
import {
  getLibraryContext,
  getLibraryItem,
  resolveMediaFile,
  resolveThumbnail,
  saveThumbnail,
} from "./repositories/library-item-repository";

type Handler = (params: unknown) => unknown;
type HandlerMap = Partial<Record<LibraryDbMethod, Handler>>;

export interface LibraryDbHandlerOptions {
  getCatalog: () => Database.Database;
  getCatalogPath: () => string;
}

export interface LibraryDbHandler {
  handle(method: LibraryDbMethod, params: unknown): unknown;
}

export function createLibraryDbHandlers(options: LibraryDbHandlerOptions): LibraryDbHandler {
  const catalog = (): Database.Database => options.getCatalog();

  const handlers: HandlerMap = {
    "library.getSummary": () => getLibrarySummary(catalog()),
    "library.getTimeline": (params) => {
      const parsed = LibraryTimelineDbParamsSchema.parse(params);
      return getLibraryTimeline(catalog(), {
        filter: parsed.filter,
        cursor: parsed.cursor ?? null,
        year: parsed.year ?? null,
        month: parsed.month ?? null,
        limit: parsed.limit ?? 200,
      });
    },
    "library.getTimelineIndex": (params) => {
      const parsed = LibraryTimelineIndexDbParamsSchema.parse(params);
      return getLibraryTimelineIndex(catalog(), parsed.filter);
    },
    "library.getItem": (params) => {
      const parsed = LibraryItemDbParamsSchema.parse(params);
      return getLibraryItem(catalog(), parsed.fileId, parsed.filter ?? "all");
    },
    "library.getUndated": (params) => {
      const parsed = LibraryUndatedDbParamsSchema.parse(params);
      return getUndatedItems(catalog(), parsed.cursor ?? null, parsed.limit ?? 100);
    },
    "library.setDate": (params) => {
      const parsed = LibrarySetDateDbParamsSchema.parse(params);
      return setDateOverride(catalog(), {
        fileIds: parsed.fileIds,
        year: parsed.year,
        month: parsed.month ?? null,
        now: new Date().toISOString(),
      });
    },
    "library.clearDate": (params) => {
      const parsed = LibraryClearDateDbParamsSchema.parse(params);
      return clearDateOverride(catalog(), parsed.fileIds, new Date().toISOString());
    },
    "library.getContext": () => getLibraryContext(catalog(), options.getCatalogPath()),
    "library.resolveMedia": (params) =>
      resolveMediaFile(catalog(), LibraryFileParamsSchema.parse(params).fileId),
    "library.resolveThumbnail": (params) =>
      resolveThumbnail(catalog(), LibraryFileParamsSchema.parse(params).fileId),
    "library.saveThumbnail": (params) => {
      const parsed = LibrarySaveThumbnailParamsSchema.parse(params);
      saveThumbnail(catalog(), parsed);
      return { saved: true };
    },
  };

  return {
    handle(method: LibraryDbMethod, params: unknown): unknown {
      const handler = handlers[method];
      if (handler === undefined) {
        throw new AppError(
          APP_ERROR_CODES.INVALID_REQUEST,
          `Unknown library database method: ${method}`,
        );
      }
      return handler(params);
    },
  };
}
