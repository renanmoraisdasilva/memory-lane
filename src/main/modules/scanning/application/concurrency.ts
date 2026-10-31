import type { ScanIntensity } from "@shared/contracts/scan";

const CONCURRENCY: Record<ScanIntensity, number> = {
  eco: 2,
  balanced: 4,
  max: 8,
};

export function concurrencyFor(intensity: ScanIntensity): number {
  return CONCURRENCY[intensity];
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));

  const runners = Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) {
        return;
      }
      const item = items[index];
      if (item !== undefined) {
        results[index] = await worker(item);
      }
    }
  });

  await Promise.all(runners);
  return results;
}
