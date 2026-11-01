import { describe, expect, it, vi } from "vitest";
import type { LibraryItemDetails, LibrarySummary } from "@shared/contracts/library";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { DbClient } from "../../../clients/db-client";
import type { DbMethod } from "../../../db/worker-protocol";
import type { Logger } from "../../../logging/types";
import { LibraryService, type ShellActions } from "./library-service";

const summary: LibrarySummary = {
  totalItems: 1,
  photoCount: 1,
  videoCount: 0,
  indexedBytes: 100,
  undatedCount: 0,
  lastScanAt: "2026-10-31T14:00:00.000Z",
  metadataRefreshCount: 0,
};

const details = {
  item: {
    fileId: 1,
    name: "a.jpg",
    mediaClass: "image",
    format: "JPG",
    sizeBytes: 100,
    width: 10,
    height: 10,
    durationSeconds: null,
    date: { value: "2024-08-18T12:00:00.000Z", precision: "exact", source: "filesystem.created" },
    thumbnailStatus: "ready",
    thumbnailUrl: "ml-media://thumbnail/1",
    isMissing: false,
  },
  path: "C:\\archive\\a.jpg",
  folder: "C:\\archive",
  createdAtFs: "2024-08-18T12:00:00.000Z",
  modifiedAtFs: "2024-08-18T12:00:00.000Z",
  metadata: [],
  position: 1,
  total: 1,
  previousFileId: null,
  nextFileId: null,
  mediaUrl: "ml-media://media/1",
} satisfies LibraryItemDetails;

function logger(): Logger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

function createDb(mediaState: "present" | "missing" = "present"): DbClient {
  return {
    request: async <T>(method: DbMethod, params: unknown): Promise<T> => {
      if (method === "library.getSummary") {
        return summary as T;
      }
      if (method === "library.getTimeline") {
        return { items: [details.item], nextCursor: null, total: 1 } as T;
      }
      if (method === "library.getTimelineIndex") {
        return { months: [{ year: 2024, month: 8, count: 1 }] } as T;
      }
      if (method === "library.getItem") {
        return details as T;
      }
      if (method === "library.resolveFile") {
        return {
          fileId: (params as { fileId: number }).fileId,
          path: details.path,
          mime: "image/jpeg",
          sizeBytes: 100,
          state: mediaState,
          mediaClass: "image",
        } as T;
      }
      throw new Error(`Unexpected method ${method}`);
    },
  };
}

function shellActions(openError = ""): ShellActions {
  return {
    reveal: vi.fn(),
    open: vi.fn(async () => openError),
  };
}

describe("LibraryService", () => {
  it("passes query calls through the DB client", async () => {
    const db = createDb();
    const service = new LibraryService({ db, shellActions: shellActions(), logger: logger() });

    await expect(service.getSummary()).resolves.toEqual(summary);
    await expect(service.getTimeline({ filter: "all", limit: 200 })).resolves.toMatchObject({
      total: 1,
    });
    await expect(service.getTimelineIndex({ filter: "photos" })).resolves.toMatchObject({
      months: [{ year: 2024, month: 8, count: 1 }],
    });
    await expect(service.getItem({ fileId: 1 })).resolves.toMatchObject({
      mediaUrl: details.mediaUrl,
    });
  });

  it("reveals and opens only cataloged, present files", async () => {
    const shell = shellActions();
    const service = new LibraryService({ db: createDb(), shellActions: shell, logger: logger() });

    await service.reveal(1);
    await service.open(1);
    expect(shell.reveal).toHaveBeenCalledWith(details.path);
    expect(shell.open).toHaveBeenCalledWith(details.path);
  });

  it("maps shell failures and missing originals", async () => {
    const failingShell = shellActions("No association");
    const failing = new LibraryService({
      db: createDb(),
      shellActions: failingShell,
      logger: logger(),
    });
    await expect(failing.open(1)).rejects.toMatchObject({
      code: APP_ERROR_CODES.SHELL_ACTION_FAILED,
    });

    const missing = new LibraryService({
      db: createDb("missing"),
      shellActions: shellActions(),
      logger: logger(),
    });
    try {
      await missing.reveal(1);
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(APP_ERROR_CODES.MEDIA_UNAVAILABLE);
    }
  });
});
