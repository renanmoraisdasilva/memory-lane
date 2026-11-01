import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
import { QUICK_HASH_ALGORITHM } from "@shared/domain/hashing";
import type { QuickFileHasher, QuickHashResult } from "../domain/scan-files";

interface SampleRegion {
  offset: number;
  length: number;
}

function sampleRegions(sizeBytes: number, sampleBytes: number): SampleRegion[] {
  if (sizeBytes <= 0 || sampleBytes <= 0) {
    return [];
  }
  const length = Math.min(sampleBytes, sizeBytes);
  const offsets = [0, Math.floor((sizeBytes - length) / 2), sizeBytes - length];
  const seen = new Set<number>();
  const regions: SampleRegion[] = [];
  for (const offset of offsets) {
    if (seen.has(offset)) {
      continue;
    }
    seen.add(offset);
    regions.push({ offset, length });
  }
  return regions;
}

export function createQuickFileHasher(): QuickFileHasher {
  return {
    async hash(filePath: string, sizeBytes: number, sampleBytes: number): Promise<QuickHashResult> {
      const regions = sampleRegions(sizeBytes, sampleBytes);
      const hash = createHash("sha256");
      hash.update(`${QUICK_HASH_ALGORITHM}\0${sizeBytes}\0`);
      const handle = await open(filePath, "r");
      try {
        const buffer = Buffer.alloc(sampleBytes);
        for (const region of regions) {
          const { bytesRead } = await handle.read(buffer, 0, region.length, region.offset);
          hash.update(`${region.offset}:${bytesRead}\0`);
          hash.update(buffer.subarray(0, bytesRead));
        }
      } finally {
        await handle.close();
      }
      return {
        algorithm: QUICK_HASH_ALGORITHM,
        digest: hash.digest("hex"),
        sampleBytes,
      };
    },
  };
}
