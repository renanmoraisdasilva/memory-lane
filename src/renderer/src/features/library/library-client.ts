import type {
  LibraryFilter,
  LibraryItemDetails,
  LibrarySummary,
  LibraryTimelineIndex,
  LibraryTimelinePage,
  LibraryTimelineParams,
} from "./types";
import { api } from "../../lib/ipc-client";

export interface LibraryClient {
  getSummary(): Promise<LibrarySummary>;
  getTimeline(params: LibraryTimelineParams): Promise<LibraryTimelinePage>;
  getTimelineIndex(params: { filter: LibraryFilter }): Promise<LibraryTimelineIndex>;
  getItem(params: { fileId: number; filter?: LibraryFilter }): Promise<LibraryItemDetails>;
  revealItem(params: { fileId: number }): Promise<void>;
  openItem(params: { fileId: number }): Promise<void>;
}

/**
 * Real renderer default backed by the frozen Phase 2 preload API.
 */
export function createLibraryClient(): LibraryClient {
  return {
    getSummary: () => api.getLibrarySummary(),
    getTimeline: (params) => api.getLibraryTimeline(params),
    getTimelineIndex: (params) => api.getLibraryTimelineIndex(params.filter),
    getItem: (params) => api.getLibraryItem(params.fileId, params.filter),
    revealItem: (params) => api.revealLibraryItem(params.fileId),
    openItem: (params) => api.openLibraryItem(params.fileId),
  };
}
