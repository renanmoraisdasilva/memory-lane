import { describe, expect, it } from "vitest";
import {
  formatBytes,
  formatCount,
  formatDateTime,
  formatDuration,
  formatMediaDuration,
  formatPercent,
} from "./format";

describe("formatBytes", () => {
  it("handles unknown and zero values", () => {
    expect(formatBytes(0)).toBe("Unknown");
    expect(formatBytes(Number.NaN)).toBe("Unknown");
  });

  it("formats bytes and binary units", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.00 KB");
    expect(formatBytes(1.5 * 1024 ** 2)).toBe("1.50 MB");
    expect(formatBytes(2 * 1024 ** 4)).toBe("2.00 TB");
  });
});

describe("scan formatting", () => {
  it("formats counts with grouping", () => {
    expect(formatCount(97_902)).toBe("97,902");
    expect(formatCount(0)).toBe("0");
  });

  it("formats durations for scan estimates", () => {
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(2_880)).toBe("48 min");
    expect(formatDuration(3_900)).toBe("1 hr 5 min");
    expect(formatDuration(null)).toBe("Not available");
  });

  it("formats media playback durations", () => {
    expect(formatMediaDuration(75)).toBe("01:15");
    expect(formatMediaDuration(204)).toBe("03:24");
    expect(formatMediaDuration(3_724)).toBe("1:02:04");
    expect(formatMediaDuration(null)).toBeNull();
  });

  it("formats percentages and unknown totals", () => {
    expect(formatPercent(83_000, 97_902)).toBe("85%");
    expect(formatPercent(10, null)).toBeNull();
    expect(formatPercent(10, 0)).toBeNull();
  });

  it("labels a missing timestamp", () => {
    expect(formatDateTime(null)).toBe("Not yet");
    expect(formatDateTime("not-a-date")).toBe("Unknown");
  });
});
