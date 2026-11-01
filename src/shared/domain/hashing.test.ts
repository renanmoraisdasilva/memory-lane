import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUICK_HASH_THRESHOLD_BYTES,
  shouldUseQuickHash,
  type ScanHashPolicy,
} from "./hashing";

const policy: ScanHashPolicy = { thresholdBytes: 100, sampleBytes: 8 };

describe("quick hash policy", () => {
  it("uses a quick hash only for large files without a size peer", () => {
    expect(shouldUseQuickHash(101, false, true, policy)).toBe(true);
    expect(shouldUseQuickHash(100, false, true, policy)).toBe(false);
    expect(shouldUseQuickHash(101, true, true, policy)).toBe(false);
    expect(shouldUseQuickHash(101, false, false, policy)).toBe(false);
  });

  it("keeps the production threshold at 64 MiB", () => {
    expect(DEFAULT_QUICK_HASH_THRESHOLD_BYTES).toBe(64 * 1024 * 1024);
  });
});
