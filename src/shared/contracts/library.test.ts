import { describe, expect, it } from "vitest";
import {
  LibraryItemDetailsSchema,
  LibraryItemSchema,
  LibrarySummarySchema,
  LibraryTimelineIndexSchema,
  LibraryTimelineParamsSchema,
  LibraryTimelinePageSchema,
  type LibraryDate,
  type LibraryFilter,
  type LibraryItem,
  type LibraryMetadataEntry,
  type LibraryMonth,
  type ThumbnailStatus,
  type TimelinePrecision,
} from "./library";

const item: LibraryItem = {
  fileId: 42,
  name: "IMG_0001.jpg",
  mediaClass: "image" as const,
  format: "JPG",
  sizeBytes: 2_048,
  width: 1920,
  height: 1080,
  durationSeconds: null,
  date: {
    value: "2024-08-18T12:00:00.000Z",
    precision: "exact" as const,
    source: "filesystem.created",
  },
  thumbnailStatus: "ready" as const,
  thumbnailUrl: "ml-media://thumbnail/42",
  isMissing: false,
};

const filter: LibraryFilter = "all";
const precision: TimelinePrecision = "exact";
const thumbnailStatus: ThumbnailStatus = "ready";
const libraryDate: LibraryDate = item.date;
const month: LibraryMonth = { year: 2024, month: 8, count: 1 };
const metadata: LibraryMetadataEntry[] = [{ key: "media.width", value: "1920", source: "image" }];

const details = {
  item,
  path: "E:\\Archive\\IMG_0001.jpg",
  folder: "E:\\Archive",
  createdAtFs: "2024-08-18T12:00:00.000Z",
  modifiedAtFs: "2024-08-18T12:00:00.000Z",
  metadata,
  position: 1,
  total: 1,
  previousFileId: null,
  nextFileId: null,
  mediaUrl: "ml-media://media/42",
};

describe("library contracts", () => {
  it("parses a library item and details", () => {
    expect(filter).toBe("all");
    expect(precision).toBe("exact");
    expect(thumbnailStatus).toBe("ready");
    expect(libraryDate.source).toBe("filesystem.created");
    expect(month.count).toBe(1);
    expect(LibraryItemSchema.parse(item).fileId).toBe(42);
    expect(LibraryItemDetailsSchema.parse(details).mediaUrl).toBe("ml-media://media/42");
  });

  it("rejects negative sizes and empty names", () => {
    expect(() => LibraryItemSchema.parse({ ...item, sizeBytes: -1 })).toThrow();
    expect(() => LibraryItemSchema.parse({ ...item, name: "" })).toThrow();
  });

  it("parses summary, timeline page, and index", () => {
    expect(
      LibrarySummarySchema.parse({
        totalItems: 1,
        photoCount: 1,
        videoCount: 0,
        indexedBytes: 2_048,
        undatedCount: 0,
        lastScanAt: "2026-10-31T14:00:00.000Z",
        metadataRefreshCount: 0,
      }).totalItems,
    ).toBe(1);

    expect(
      LibraryTimelinePageSchema.parse({
        items: [item],
        nextCursor: null,
        total: 1,
      }).items,
    ).toHaveLength(1);

    expect(
      LibraryTimelineIndexSchema.parse({
        months: [{ year: 2024, month: 8, count: 1 }],
      }).months[0]?.month,
    ).toBe(8);
  });

  it("validates timeline anchors and cursor exclusivity", () => {
    expect(LibraryTimelineParamsSchema.parse({ filter: "all", year: 2024, month: 8 }).month).toBe(
      8,
    );
    expect(() => LibraryTimelineParamsSchema.parse({ filter: "all", month: 8 })).toThrow();
    expect(() =>
      LibraryTimelineParamsSchema.parse({ filter: "all", cursor: "abc", year: 2024 }),
    ).toThrow();
    expect(() => LibraryTimelineParamsSchema.parse({ filter: "audio" })).toThrow();
  });
});
