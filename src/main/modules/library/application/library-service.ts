import type {
  LibraryClearDateParams,
  LibraryDateMutationResult,
  LibraryItemDetails,
  LibraryItemParams,
  LibrarySetDateParams,
  LibrarySummary,
  LibraryTimelineIndex,
  LibraryTimelineIndexParams,
  LibraryTimelinePage,
  LibraryTimelineParams,
  LibraryUndatedPage,
  LibraryUndatedParams,
} from "@shared/contracts/library";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { DbClient } from "../../../clients/db-client";
import type { Logger } from "../../../logging/types";

export interface ShellActions {
  reveal(filePath: string): void;
  open(filePath: string): Promise<string>;
}

export interface ResolvedLibraryMedia {
  fileId: number;
  path: string;
  mime: string | null;
  sizeBytes: number;
  state: "present" | "missing";
  mediaClass: "image" | "video";
}

export interface LibraryServiceDependencies {
  db: DbClient;
  shellActions: ShellActions;
  logger: Logger;
}

export class LibraryService {
  constructor(private readonly dependencies: LibraryServiceDependencies) {}

  async getSummary(): Promise<LibrarySummary> {
    return this.dependencies.db.request<LibrarySummary>("library.getSummary", {});
  }

  async getTimeline(params: LibraryTimelineParams): Promise<LibraryTimelinePage> {
    return this.dependencies.db.request<LibraryTimelinePage>("library.getTimeline", params);
  }

  async getTimelineIndex(params: LibraryTimelineIndexParams): Promise<LibraryTimelineIndex> {
    return this.dependencies.db.request<LibraryTimelineIndex>("library.getTimelineIndex", params);
  }

  async getItem(params: LibraryItemParams): Promise<LibraryItemDetails> {
    return this.dependencies.db.request<LibraryItemDetails>("library.getItem", params);
  }

  async getUndated(params: LibraryUndatedParams): Promise<LibraryUndatedPage> {
    return this.dependencies.db.request<LibraryUndatedPage>("library.getUndated", params);
  }

  async setDate(params: LibrarySetDateParams): Promise<LibraryDateMutationResult> {
    return this.dependencies.db.request<LibraryDateMutationResult>("library.setDate", params);
  }

  async clearDate(params: LibraryClearDateParams): Promise<LibraryDateMutationResult> {
    return this.dependencies.db.request<LibraryDateMutationResult>("library.clearDate", params);
  }

  async reveal(fileId: number): Promise<void> {
    const media = await this.resolveMedia(fileId);
    this.dependencies.shellActions.reveal(media.path);
    this.dependencies.logger.info("Revealed library item", { fileId });
  }

  async open(fileId: number): Promise<void> {
    const media = await this.resolveMedia(fileId);
    const error = await this.dependencies.shellActions.open(media.path);
    if (error.length > 0) {
      throw new AppError(APP_ERROR_CODES.SHELL_ACTION_FAILED, error, { fileId });
    }
    this.dependencies.logger.info("Opened library item externally", { fileId });
  }

  private async resolveMedia(fileId: number): Promise<ResolvedLibraryMedia> {
    const media = await this.dependencies.db.request<ResolvedLibraryMedia | null>(
      "library.resolveMedia",
      { fileId },
    );
    if (media === null) {
      throw new AppError(APP_ERROR_CODES.LIBRARY_ITEM_NOT_FOUND, "Catalog item was not found");
    }
    if (media.state === "missing") {
      throw new AppError(APP_ERROR_CODES.MEDIA_UNAVAILABLE, "The original file is missing");
    }
    return media;
  }
}
