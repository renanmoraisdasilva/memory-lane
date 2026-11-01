// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import type { IpcResult } from "@shared/contracts/ipc";
import type { MemoryLaneApi } from "@shared/contracts/api";
import type {
  LibraryItemDetails,
  LibrarySummary,
  LibraryTimelineIndex,
  LibraryTimelinePage,
} from "@shared/contracts/library";
import { createLibraryClient } from "./library-client";
import { libraryFixtureItems } from "../../test/library-fixtures";

function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data };
}

const summary: LibrarySummary = {
  totalItems: 0,
  photoCount: 0,
  videoCount: 0,
  indexedBytes: 0,
  undatedCount: 0,
  lastScanAt: null,
  metadataRefreshCount: 0,
};

const timeline: LibraryTimelinePage = { items: [], nextCursor: null, total: 0 };
const index: LibraryTimelineIndex = { months: [] };
const item = libraryFixtureItems[0];
if (item === undefined) {
  throw new Error("The library fixture is missing");
}
const details: LibraryItemDetails = {
  item,
  path: "E:\\Archive\\image.jpg",
  folder: "E:\\Archive",
  createdAtFs: null,
  modifiedAtFs: "2024-08-18T18:42:00.000Z",
  metadata: [],
  position: 1,
  total: 1,
  previousFileId: null,
  nextFileId: null,
  mediaUrl: "ml-media://media/1",
};

function installApi(api: Partial<MemoryLaneApi>): void {
  Object.defineProperty(window, "memoryLane", { value: api, configurable: true });
}

afterEach(() => {
  delete window.memoryLane;
});

describe("createLibraryClient", () => {
  it("maps the library client onto the real preload API", async () => {
    const getLibrarySummary = vi.fn(async () => ok(summary));
    const getLibraryTimeline = vi.fn(async () => ok(timeline));
    const getLibraryTimelineIndex = vi.fn(async () => ok(index));
    const getLibraryItem = vi.fn(async () => ok(details));
    const getLibraryUndated = vi.fn(async () => ok({ items: [], nextCursor: null, total: 0 }));
    const setLibraryDate = vi.fn(async () => ok({ updated: 1 }));
    const clearLibraryDate = vi.fn(async () => ok({ updated: 1 }));
    const revealLibraryItem = vi.fn(async () => ok(undefined));
    const openLibraryItem = vi.fn(async () => ok(undefined));
    installApi({
      getLibrarySummary,
      getLibraryTimeline,
      getLibraryTimelineIndex,
      getLibraryItem,
      getLibraryUndated,
      setLibraryDate,
      clearLibraryDate,
      revealLibraryItem,
      openLibraryItem,
    });
    const client = createLibraryClient();

    await expect(client.getSummary()).resolves.toEqual(summary);
    await expect(client.getTimeline({ filter: "photos", limit: 200 })).resolves.toEqual(timeline);
    await expect(client.getTimelineIndex({ filter: "videos" })).resolves.toEqual(index);
    await expect(client.getItem({ fileId: 1, filter: "all" })).resolves.toEqual(details);
    await expect(client.getUndated({ limit: 25 })).resolves.toMatchObject({ total: 0 });
    await expect(client.setDate({ fileIds: [1], year: 2011, month: 7 })).resolves.toEqual({
      updated: 1,
    });
    await expect(client.clearDate({ fileIds: [1] })).resolves.toEqual({ updated: 1 });
    await expect(client.revealItem({ fileId: 1 })).resolves.toBeUndefined();
    await expect(client.openItem({ fileId: 1 })).resolves.toBeUndefined();

    expect(getLibraryTimeline).toHaveBeenCalledWith({ filter: "photos", limit: 200 });
    expect(getLibraryTimelineIndex).toHaveBeenCalledWith({ filter: "videos" });
    expect(getLibraryItem).toHaveBeenCalledWith({ fileId: 1, filter: "all" });
    expect(getLibraryUndated).toHaveBeenCalledWith({ limit: 25 });
    expect(setLibraryDate).toHaveBeenCalledWith({ fileIds: [1], year: 2011, month: 7 });
    expect(clearLibraryDate).toHaveBeenCalledWith({ fileIds: [1] });
    expect(revealLibraryItem).toHaveBeenCalledWith({ fileId: 1 });
    expect(openLibraryItem).toHaveBeenCalledWith({ fileId: 1 });
  });
});
