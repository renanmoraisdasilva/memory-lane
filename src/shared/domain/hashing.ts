export const QUICK_HASH_ALGORITHM = "sha256-sampled-v1";

export const DEFAULT_QUICK_HASH_THRESHOLD_BYTES = 64 * 1024 * 1024;
export const DEFAULT_QUICK_HASH_SAMPLE_BYTES = 1024 * 1024;

export interface ScanHashPolicy {
  thresholdBytes: number;
  sampleBytes: number;
}

export const DEFAULT_SCAN_HASH_POLICY: ScanHashPolicy = {
  thresholdBytes: DEFAULT_QUICK_HASH_THRESHOLD_BYTES,
  sampleBytes: DEFAULT_QUICK_HASH_SAMPLE_BYTES,
};

export function shouldUseQuickHash(
  sizeBytes: number,
  hasSizePeer: boolean,
  quickHasherAvailable: boolean,
  policy: ScanHashPolicy = DEFAULT_SCAN_HASH_POLICY,
): boolean {
  return quickHasherAvailable && !hasSizePeer && sizeBytes > policy.thresholdBytes;
}
