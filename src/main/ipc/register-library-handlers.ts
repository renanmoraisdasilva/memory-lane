import { ipcMain } from "electron";
import { IPC_CHANNELS } from "@shared/contracts/ipc";
import {
  LibraryClearDateParamsSchema,
  LibraryItemParamsSchema,
  LibrarySetDateParamsSchema,
  LibraryTimelineIndexParamsSchema,
  LibraryTimelineParamsSchema,
  LibraryUndatedParamsSchema,
  type LibraryDateMutationResult,
  type LibraryItemDetails,
  type LibrarySummary,
  type LibraryTimelineIndex,
  type LibraryTimelinePage,
  type LibraryUndatedPage,
} from "@shared/contracts/library";
import type { Logger } from "../logging/types";
import type { LibraryService } from "../modules/library/application/library-service";
import { respond } from "./respond";

export function registerLibraryHandlers(libraryService: LibraryService, logger: Logger): void {
  ipcMain.handle(IPC_CHANNELS.getLibrarySummary, (event) =>
    respond<LibrarySummary>(event, IPC_CHANNELS.getLibrarySummary, logger, () =>
      libraryService.getSummary(),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.getLibraryTimeline, (event, params: unknown) =>
    respond<LibraryTimelinePage>(event, IPC_CHANNELS.getLibraryTimeline, logger, () =>
      libraryService.getTimeline(LibraryTimelineParamsSchema.parse(params)),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.getLibraryTimelineIndex, (event, params: unknown) =>
    respond<LibraryTimelineIndex>(event, IPC_CHANNELS.getLibraryTimelineIndex, logger, () =>
      libraryService.getTimelineIndex(LibraryTimelineIndexParamsSchema.parse(params)),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.getLibraryItem, (event, params: unknown) =>
    respond<LibraryItemDetails>(event, IPC_CHANNELS.getLibraryItem, logger, () =>
      libraryService.getItem(LibraryItemParamsSchema.parse(params)),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.getLibraryUndated, (event, params: unknown) =>
    respond<LibraryUndatedPage>(event, IPC_CHANNELS.getLibraryUndated, logger, () =>
      libraryService.getUndated(LibraryUndatedParamsSchema.parse(params)),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.setLibraryDate, (event, params: unknown) =>
    respond<LibraryDateMutationResult>(event, IPC_CHANNELS.setLibraryDate, logger, () =>
      libraryService.setDate(LibrarySetDateParamsSchema.parse(params)),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.clearLibraryDate, (event, params: unknown) =>
    respond<LibraryDateMutationResult>(event, IPC_CHANNELS.clearLibraryDate, logger, () =>
      libraryService.clearDate(LibraryClearDateParamsSchema.parse(params)),
    ),
  );
}
