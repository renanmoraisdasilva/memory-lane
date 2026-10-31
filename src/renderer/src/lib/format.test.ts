import { describe, expect, it } from "vitest";
import { formatBytes } from "./format";

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
