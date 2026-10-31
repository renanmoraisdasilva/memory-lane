import type { LibraryClient } from "../features/library/library-client";
import type {
  LibraryClearDateParams,
  LibraryFilter,
  LibraryItem,
  LibraryItemDetails,
  LibraryMonth,
  LibrarySetDateParams,
  LibrarySummary,
  LibraryTimelineParams,
  LibraryUndatedItem,
} from "../features/library/types";

const MB = 1024 ** 2;
const GB = 1024 ** 3;

export const libraryFixtureItems: LibraryItem[] = [
  {
    fileId: 1,
    name: "DSC_4910.JPG",
    mediaClass: "image",
    format: "JPEG",
    sizeBytes: 18.4 * MB,
    width: 6000,
    height: 4000,
    durationSeconds: null,
    date: {
      value: "2024-08-18T18:42:00.000Z",
      precision: "exact",
      source: "EXIF DateTimeOriginal",
    },
    thumbnailStatus: "ready",
    thumbnailUrl: "ml-media://thumbnail/1",
    isMissing: false,
  },
  {
    fileId: 2,
    name: "MOV_0428.MP4",
    mediaClass: "video",
    format: "MP4",
    sizeBytes: 648 * MB,
    width: 3840,
    height: 2160,
    durationSeconds: 204,
    date: {
      value: "2024-08-18T18:45:00.000Z",
      precision: "exact",
      source: "Container creation time",
    },
    thumbnailStatus: "ready",
    thumbnailUrl: "ml-media://thumbnail/2",
    isMissing: false,
  },
  {
    fileId: 3,
    name: "DSCF1042.RAF",
    mediaClass: "image",
    format: "RAF",
    sizeBytes: 28.7 * MB,
    width: 6240,
    height: 4160,
    durationSeconds: null,
    date: {
      value: "2024-06-04T10:00:00.000Z",
      precision: "exact",
      source: "EXIF DateTimeOriginal",
    },
    thumbnailStatus: "ready",
    thumbnailUrl: "ml-media://thumbnail/3",
    isMissing: false,
  },
  {
    fileId: 4,
    name: "SCAN_0084.TIFF",
    mediaClass: "image",
    format: "TIFF",
    sizeBytes: 52.4 * MB,
    width: 4800,
    height: 3200,
    durationSeconds: null,
    date: { value: "2008-07-15T12:00:00.000Z", precision: "month", source: "File system" },
    thumbnailStatus: "ready",
    thumbnailUrl: "ml-media://thumbnail/4",
    isMissing: false,
  },
  {
    fileId: 5,
    name: "SCAN_0142_KODAK.TIFF",
    mediaClass: "image",
    format: "TIFF",
    sizeBytes: 24.1 * MB,
    width: 4800,
    height: 3200,
    durationSeconds: null,
    date: { value: "1998-06-15T12:00:00.000Z", precision: "year", source: "Manual date" },
    thumbnailStatus: "ready",
    thumbnailUrl: "ml-media://thumbnail/5",
    isMissing: false,
  },
  {
    fileId: 6,
    name: "UNDATED_001.JPG",
    mediaClass: "image",
    format: "JPEG",
    sizeBytes: 8.2 * MB,
    width: 3000,
    height: 2000,
    durationSeconds: null,
    date: { value: null, precision: null, source: null },
    thumbnailStatus: "ready",
    thumbnailUrl: "ml-media://thumbnail/6",
    isMissing: false,
  },
  {
    fileId: 7,
    name: "MISSING_001.JPG",
    mediaClass: "image",
    format: "JPEG",
    sizeBytes: 4.1 * MB,
    width: 2000,
    height: 1500,
    durationSeconds: null,
    date: { value: "2024-08-17T09:00:00.000Z", precision: "exact", source: "File system" },
    thumbnailStatus: "failed",
    thumbnailUrl: null,
    isMissing: true,
  },
  {
    fileId: 8,
    name: "PENDING_001.JPG",
    mediaClass: "image",
    format: "JPEG",
    sizeBytes: 6.3 * MB,
    width: 3000,
    height: 2000,
    durationSeconds: null,
    date: { value: "2024-08-16T09:00:00.000Z", precision: "exact", source: "File system" },
    thumbnailStatus: "pending",
    thumbnailUrl: null,
    isMissing: false,
  },
  {
    fileId: 9,
    name: "FAILED_001.JPG",
    mediaClass: "image",
    format: "JPEG",
    sizeBytes: 7.3 * MB,
    width: 3000,
    height: 2000,
    durationSeconds: null,
    date: { value: "2024-08-15T09:00:00.000Z", precision: "exact", source: "File system" },
    thumbnailStatus: "failed",
    thumbnailUrl: null,
    isMissing: false,
  },
  {
    fileId: 10,
    name: "CLIP_NO_THUMB.MP4",
    mediaClass: "video",
    format: "MP4",
    sizeBytes: 120 * MB,
    width: 1920,
    height: 1080,
    durationSeconds: 75,
    date: {
      value: "2024-06-04T11:00:00.000Z",
      precision: "exact",
      source: "Container creation time",
    },
    thumbnailStatus: "failed",
    thumbnailUrl: null,
    isMissing: false,
  },
];

function filteredItems(items: LibraryItem[], filter: LibraryFilter): LibraryItem[] {
  if (filter === "photos") {
    return items.filter((item) => item.mediaClass === "image");
  }
  if (filter === "videos") {
    return items.filter((item) => item.mediaClass === "video");
  }
  return items;
}

function sortItems(items: LibraryItem[]): LibraryItem[] {
  return [...items].sort((left, right) => {
    const leftDate = left.date.value === null ? 0 : Date.parse(left.date.value);
    const rightDate = right.date.value === null ? 0 : Date.parse(right.date.value);
    if (leftDate !== rightDate) {
      return rightDate - leftDate;
    }
    return right.fileId - left.fileId;
  });
}

function anchorItems(items: LibraryItem[], params: LibraryTimelineParams): LibraryItem[] {
  const year = params.year;
  if (year === undefined) {
    return items;
  }
  const month = params.month;
  return items.filter((item) => {
    if (item.date.value === null) {
      return true;
    }
    const date = new Date(item.date.value);
    if (month !== undefined) {
      return (
        date.getFullYear() < year || (date.getFullYear() === year && date.getMonth() + 1 <= month)
      );
    }
    return date.getFullYear() <= year;
  });
}

function summaryFromItems(items: LibraryItem[]): LibrarySummary {
  return {
    totalItems: items.length,
    photoCount: items.filter((item) => item.mediaClass === "image").length,
    videoCount: items.filter((item) => item.mediaClass === "video").length,
    indexedBytes: items.reduce((total, item) => total + item.sizeBytes, 0) + GB,
    undatedCount: items.filter((item) => item.date.value === null).length,
    lastScanAt: "2026-10-31T14:32:00.000Z",
  };
}

function monthsFromItems(items: LibraryItem[]): LibraryMonth[] {
  const counts = new Map<string, LibraryMonth>();
  for (const item of items) {
    if (item.date.value === null) {
      continue;
    }
    const date = new Date(item.date.value);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const key = `${String(year)}-${String(month)}`;
    const existing = counts.get(key);
    if (existing === undefined) {
      counts.set(key, { year, month, count: 1 });
    } else {
      existing.count += 1;
    }
  }
  return Array.from(counts.values()).sort((left, right) =>
    left.year === right.year ? right.month - left.month : right.year - left.year,
  );
}

function detailsForItem(item: LibraryItem, items: LibraryItem[]): LibraryItemDetails {
  const index = items.findIndex((candidate) => candidate.fileId === item.fileId);
  return {
    item,
    path: `E:\\Archive\\${item.name}`,
    folder: "E:\\Archive",
    createdAtFs: "2024-01-01T00:00:00.000Z",
    modifiedAtFs: "2024-08-18T18:42:00.000Z",
    metadata:
      item.mediaClass === "video"
        ? [
            { key: "Codec", value: "H.264", source: "Container" },
            { key: "Frame rate", value: "29.97 fps", source: "Container" },
          ]
        : [
            { key: "Camera", value: "Sony α7R V", source: "EXIF" },
            { key: "Lens", value: "FE 24-70mm F2.8 GM II", source: "EXIF" },
          ],
    position: index + 1,
    total: items.length,
    previousFileId: index > 0 ? (items[index - 1]?.fileId ?? null) : null,
    nextFileId: index >= 0 && index < items.length - 1 ? (items[index + 1]?.fileId ?? null) : null,
    mediaUrl: item.isMissing ? null : `ml-media://media/${String(item.fileId)}`,
  };
}

export interface LibraryFixtureOptions {
  items?: LibraryItem[];
  undatedItems?: LibraryUndatedItem[];
  summary?: LibrarySummary;
  months?: LibraryMonth[];
  details?: Record<number, LibraryItemDetails>;
  failures?: Partial<Record<"summary" | "timeline" | "index" | "item" | "reveal" | "open", Error>>;
}

function throwIf(error: Error | undefined): void {
  if (error !== undefined) {
    throw error;
  }
}

function undatedFromItems(items: LibraryItem[]): LibraryUndatedItem[] {
  return items
    .filter((item) => item.date.value === null)
    .map((item) => ({ ...item, folder: "C:\\archive\\undated" }));
}

export function createLibraryFixtureClient(options: LibraryFixtureOptions = {}): LibraryClient {
  const items = options.items ?? libraryFixtureItems;
  const summary = options.summary ?? summaryFromItems(items);
  const months = options.months ?? monthsFromItems(items);
  const details = options.details ?? {};
  let undated = options.undatedItems ?? undatedFromItems(items);

  return {
    getSummary: () =>
      Promise.resolve().then(() => {
        throwIf(options.failures?.summary);
        return summary;
      }),
    getTimeline: (params) =>
      Promise.resolve().then(() => {
        throwIf(options.failures?.timeline);
        const filtered = sortItems(anchorItems(filteredItems(items, params.filter), params));
        const limit = params.limit ?? 200;
        const start = params.cursor === undefined ? 0 : Number(params.cursor);
        const page = filtered.slice(start, start + limit);
        const next = start + page.length < filtered.length ? String(start + page.length) : null;
        return { items: page, nextCursor: next, total: filtered.length };
      }),
    getTimelineIndex: () =>
      Promise.resolve().then(() => {
        throwIf(options.failures?.index);
        return { months };
      }),
    getItem: (params) =>
      Promise.resolve().then(() => {
        throwIf(options.failures?.item);
        const filtered = sortItems(filteredItems(items, params.filter ?? "all"));
        const item = items.find((candidate) => candidate.fileId === params.fileId);
        if (item === undefined) {
          throw new Error("The media item was not found");
        }
        return details[item.fileId] ?? detailsForItem(item, filtered);
      }),
    getUndated: (params) =>
      Promise.resolve().then(() => {
        const start = params.cursor === undefined ? 0 : Number(params.cursor);
        const limit = params.limit ?? 100;
        const page = undated.slice(start, start + limit);
        const next = start + page.length < undated.length ? String(start + page.length) : null;
        return { items: page, nextCursor: next, total: undated.length };
      }),
    setDate: (params: LibrarySetDateParams) =>
      Promise.resolve().then(() => {
        const selected = new Set(params.fileIds);
        const updated = undated.filter((item) => selected.has(item.fileId)).length;
        undated = undated.filter((item) => !selected.has(item.fileId));
        return { updated };
      }),
    clearDate: (params: LibraryClearDateParams) =>
      Promise.resolve().then(() => ({ updated: params.fileIds.length })),
    revealItem: () =>
      Promise.resolve().then(() => {
        throwIf(options.failures?.reveal);
      }),
    openItem: () =>
      Promise.resolve().then(() => {
        throwIf(options.failures?.open);
      }),
  };
}

export function createLargeLibraryFixture(count = 500): LibraryItem[] {
  const base = Date.parse("2024-08-18T18:42:00.000Z");
  return Array.from({ length: count }, (_, index) => {
    const fileId = index + 1;
    const video = index % 5 === 0;
    return {
      fileId,
      name: video
        ? `CLIP_${String(fileId).padStart(4, "0")}.MP4`
        : `IMG_${String(fileId).padStart(4, "0")}.JPG`,
      mediaClass: video ? "video" : "image",
      format: video ? "MP4" : "JPEG",
      sizeBytes: (video ? 120 : 8) * MB,
      width: video ? 1920 : 3000,
      height: video ? 1080 : 2000,
      durationSeconds: video ? 75 : null,
      date: {
        value: new Date(base - index * 86_400_000).toISOString(),
        precision: "exact",
        source: "EXIF DateTimeOriginal",
      },
      thumbnailStatus: "ready",
      thumbnailUrl: `ml-media://thumbnail/${String(fileId)}`,
      isMissing: false,
    } satisfies LibraryItem;
  });
}
