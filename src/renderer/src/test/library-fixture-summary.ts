import type { LibraryItem, LibraryMonth, LibrarySummary } from "../features/library/types";

const GB = 1024 ** 3;

export function summaryFromItems(items: LibraryItem[]): LibrarySummary {
  return {
    totalItems: items.length,
    photoCount: items.filter((item) => item.mediaClass === "image").length,
    videoCount: items.filter((item) => item.mediaClass === "video").length,
    indexedBytes: items.reduce((total, item) => total + item.sizeBytes, 0) + GB,
    undatedCount: items.filter((item) => item.date.value === null).length,
    lastScanAt: "2026-10-31T14:32:00.000Z",
    metadataRefreshCount: 0,
  };
}

export function monthsFromItems(items: LibraryItem[]): LibraryMonth[] {
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
