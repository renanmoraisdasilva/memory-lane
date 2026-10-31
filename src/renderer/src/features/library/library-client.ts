import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type {
  LibraryFilter,
  LibraryItemDetails,
  LibrarySummary,
  LibraryTimelineIndex,
  LibraryTimelinePage,
  LibraryTimelineParams,
} from "./types";

/**
 * Renderer seam for the Phase 2 library API. Platform/Core will replace the
 * unavailable default with calls through the preload bridge once
 * `src/shared/contracts/library.ts` is frozen.
 */
export interface LibraryClient {
  getSummary(): Promise<LibrarySummary>;
  getTimeline(params: LibraryTimelineParams): Promise<LibraryTimelinePage>;
  getTimelineIndex(params: { filter: LibraryFilter }): Promise<LibraryTimelineIndex>;
  getItem(params: { fileId: number; filter?: LibraryFilter }): Promise<LibraryItemDetails>;
  revealItem(params: { fileId: number }): Promise<void>;
  openItem(params: { fileId: number }): Promise<void>;
}

function unavailable<T>(): Promise<T> {
  return Promise.reject(
    new AppError(
      APP_ERROR_CODES.INTERNAL,
      "The Phase 2 library IPC contract is not available in this build. Agent A must add src/shared/contracts/library.ts and preload methods.",
    ),
  );
}

/**
 * Production default until the shared contract lands. It intentionally
 * contains no fixture data and is not a mock client.
 */
export function createUnavailableLibraryClient(): LibraryClient {
  return {
    getSummary: () => unavailable(),
    getTimeline: () => unavailable(),
    getTimelineIndex: () => unavailable(),
    getItem: () => unavailable(),
    revealItem: () => unavailable(),
    openItem: () => unavailable(),
  };
}
