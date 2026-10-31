import { describe, expect, it } from "vitest";
import { libraryFixtureItems } from "../../test/library-fixtures";
import {
  adjacentMonthAnchor,
  anchorTimelineParams,
  buildTimelineRows,
  columnsForWidth,
  currentMonthIndex,
  findRowIndexForItem,
  groupTimelineItems,
} from "./timeline-model";

describe("timeline model", () => {
  it("groups exact, month, year, and undated items with undated last", () => {
    const sections = groupTimelineItems(libraryFixtureItems);

    expect(sections.some((section) => section.precision === "exact")).toBe(true);
    expect(sections.some((section) => section.precision === "month")).toBe(true);
    expect(sections.some((section) => section.precision === "year")).toBe(true);
    expect(sections[sections.length - 1]?.key).toBe("undated");
    expect(sections[sections.length - 1]?.label).toBe("Date unavailable");

    const month = sections.find((section) => section.precision === "month");
    expect(month?.label).toBe("July 2008");
    const year = sections.find((section) => section.precision === "year");
    expect(year?.label).toBe("1998");
  });

  it("builds section and tile rows with stable item anchors", () => {
    const sections = groupTimelineItems(libraryFixtureItems);
    const rows = buildTimelineRows(sections, 4, "comfortable");

    expect(rows[0]?.kind).toBe("section");
    expect(rows[1]?.kind).toBe("items");
    const itemRow = rows.find((row) => row.kind === "items" && row.itemIds.includes(1));
    expect(itemRow?.kind).toBe("items");
    if (itemRow === undefined) {
      throw new Error("The fixture item row is missing");
    }
    expect(findRowIndexForItem(rows, 1)).toBe(rows.indexOf(itemRow));
  });

  it("computes responsive columns for both densities", () => {
    expect(columnsForWidth(1000, "comfortable")).toBe(4);
    expect(columnsForWidth(1000, "dense")).toBe(6);
    expect(columnsForWidth(300, "comfortable")).toBe(1);
  });

  it("maps period anchors to timeline params and adjacent months", () => {
    const months = [
      { year: 2024, month: 8, count: 2 },
      { year: 2024, month: 6, count: 2 },
      { year: 2008, month: 7, count: 1 },
    ];

    expect(anchorTimelineParams(null)).toEqual({ year: null, month: null });
    expect(anchorTimelineParams({ kind: "year", year: 2024 })).toEqual({
      year: 2024,
      month: null,
    });
    expect(anchorTimelineParams({ kind: "month", year: 2024, month: 6 })).toEqual({
      year: 2024,
      month: 6,
    });
    expect(currentMonthIndex(months, null)).toBe(0);
    expect(currentMonthIndex(months, { kind: "month", year: 2024, month: 6 })).toBe(1);
    expect(adjacentMonthAnchor(months, { kind: "year", year: 2024 }, 1)).toEqual({
      kind: "month",
      year: 2024,
      month: 6,
    });
  });
});
