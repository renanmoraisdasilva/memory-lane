import { dateGroupKey, formatSectionLabel, formatSectionMeta } from "./date-format";
import type {
  LibraryDensity,
  LibraryItem,
  LibraryMonth,
  PeriodAnchor,
  TimelinePrecision,
} from "./types";

export interface TimelineSection {
  key: string;
  label: string;
  meta: string;
  precision: TimelinePrecision | null;
  items: LibraryItem[];
}

export interface TimelineSectionRow {
  kind: "section";
  key: string;
  height: number;
  section: TimelineSection;
}

export interface TimelineItemsRow {
  kind: "items";
  key: string;
  height: number;
  section: TimelineSection;
  items: LibraryItem[];
  itemIds: number[];
}

export type TimelineRow = TimelineSectionRow | TimelineItemsRow;

export interface DensityMetrics {
  minTileWidth: number;
  tileHeight: number;
  gap: number;
  sectionHeaderHeight: number;
}

export const DENSITY_METRICS: Record<LibraryDensity, DensityMetrics> = {
  comfortable: { minTileWidth: 220, tileHeight: 190, gap: 12, sectionHeaderHeight: 64 },
  dense: { minTileWidth: 152, tileHeight: 132, gap: 8, sectionHeaderHeight: 56 },
};

export function columnsForWidth(width: number, density: LibraryDensity): number {
  const metrics = DENSITY_METRICS[density];
  const columns = Math.floor((width + metrics.gap) / (metrics.minTileWidth + metrics.gap));
  return Math.max(1, Math.min(8, columns));
}

function createSection(item: LibraryItem): TimelineSection {
  return {
    key: dateGroupKey(item.date),
    label: formatSectionLabel(item.date),
    meta: formatSectionMeta(item.date),
    precision: item.date.precision,
    items: [item],
  };
}

export function groupTimelineItems(items: LibraryItem[]): TimelineSection[] {
  const sections: TimelineSection[] = [];
  const undated: LibraryItem[] = [];

  for (const item of items) {
    const key = dateGroupKey(item.date);
    if (key === "undated") {
      undated.push(item);
      continue;
    }
    const last = sections[sections.length - 1];
    if (last !== undefined && last.key === key) {
      last.items.push(item);
    } else {
      sections.push(createSection(item));
    }
  }

  if (undated.length > 0) {
    sections.push({
      key: "undated",
      label: "Date unavailable",
      meta: "No resolved date",
      precision: null,
      items: undated,
    });
  }
  return sections;
}

export function buildTimelineRows(
  sections: TimelineSection[],
  columns: number,
  density: LibraryDensity,
): TimelineRow[] {
  const metrics = DENSITY_METRICS[density];
  const rows: TimelineRow[] = [];

  for (const section of sections) {
    rows.push({
      kind: "section",
      key: `section:${section.key}`,
      height:
        section.key === "undated" ? metrics.sectionHeaderHeight + 46 : metrics.sectionHeaderHeight,
      section,
    });
    for (let index = 0; index < section.items.length; index += columns) {
      const items = section.items.slice(index, index + columns);
      const first = items[0];
      if (first !== undefined) {
        rows.push({
          kind: "items",
          key: `items:${section.key}:${first.fileId}`,
          height: metrics.tileHeight + metrics.gap,
          section,
          items,
          itemIds: items.map((item) => item.fileId),
        });
      }
    }
  }
  return rows;
}

export function findRowIndexForItem(rows: TimelineRow[], fileId: number): number {
  return rows.findIndex((row) => row.kind === "items" && row.itemIds.includes(fileId));
}

export function collectYears(months: LibraryMonth[]): number[] {
  const years = new Set<number>();
  for (const month of months) {
    years.add(month.year);
  }
  return Array.from(years).sort((left, right) => right - left);
}

export function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1),
  );
}

export function anchorTimelineParams(anchor: PeriodAnchor): {
  year: number | null;
  month: number | null;
} {
  if (anchor === null) {
    return { year: null, month: null };
  }
  if (anchor.kind === "year") {
    return { year: anchor.year, month: null };
  }
  return { year: anchor.year, month: anchor.month };
}

export function anchorKey(anchor: PeriodAnchor): string {
  if (anchor === null) {
    return "all";
  }
  if (anchor.kind === "year") {
    return `year:${anchor.year}`;
  }
  return `month:${anchor.year}:${anchor.month}`;
}

export function currentMonthIndex(months: LibraryMonth[], anchor: PeriodAnchor): number {
  if (months.length === 0) {
    return -1;
  }
  if (anchor !== null && anchor.kind === "month") {
    const exact = months.findIndex(
      (month) => month.year === anchor.year && month.month === anchor.month,
    );
    if (exact >= 0) {
      return exact;
    }
  }
  if (anchor !== null) {
    const yearIndex = months.findIndex((month) => month.year === anchor.year);
    if (yearIndex >= 0) {
      return yearIndex;
    }
  }
  return 0;
}

export function adjacentMonthAnchor(
  months: LibraryMonth[],
  anchor: PeriodAnchor,
  direction: -1 | 1,
): PeriodAnchor {
  if (months.length === 0) {
    return anchor;
  }
  const current = currentMonthIndex(months, anchor);
  if (current < 0) {
    return anchor;
  }
  const target = months[current + direction];
  return target === undefined ? anchor : { kind: "month", year: target.year, month: target.month };
}
