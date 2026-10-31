import { describe, expect, it, vi } from "vitest";
import type { ThumbnailGenerator } from "../scanning/domain/scan-files";
import { createThumbnailScheduler } from "./thumbnail-scheduler";

interface Deferred {
  resolve: (value: { bytes: number } | null) => void;
  reject: (error: unknown) => void;
}

function waitForTurn(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function controlledGenerator(calls: string[], pending: Map<string, Deferred>): ThumbnailGenerator {
  return {
    generate: vi.fn(
      (filePath: string) =>
        new Promise<{ bytes: number } | null>((resolve, reject) => {
          calls.push(filePath);
          pending.set(filePath, { resolve, reject });
        }),
    ),
  };
}

describe("thumbnail scheduler", () => {
  it("runs interactive work before queued bulk work", async () => {
    const calls: string[] = [];
    const pending = new Map<string, Deferred>();
    const generator = controlledGenerator(calls, pending);
    const scheduler = createThumbnailScheduler(generator, { interactive: 1, bulk: 1 });

    const bulkOne = scheduler.generate("bulk-1", "out-1", "bulk");
    const bulkTwo = scheduler.generate("bulk-2", "out-2", "bulk");
    const interactive = scheduler.generate("visible", "out-visible", "interactive");
    await waitForTurn();

    expect(calls).toEqual(["bulk-1", "visible"]);
    pending.get("bulk-1")?.resolve({ bytes: 1 });
    await waitForTurn();

    expect(calls).toEqual(["bulk-1", "visible", "bulk-2"]);
    pending.get("visible")?.resolve({ bytes: 1 });
    pending.get("bulk-2")?.resolve({ bytes: 1 });
    await expect(Promise.all([bulkOne, bulkTwo, interactive])).resolves.toHaveLength(3);
  });

  it("deduplicates in-flight work for the same output path", async () => {
    const generator: ThumbnailGenerator = {
      generate: vi.fn(async () => ({ bytes: 10 })),
    };
    const scheduler = createThumbnailScheduler(generator, { interactive: 1, bulk: 1 });

    const first = scheduler.generate("source", "same-output", "interactive");
    const second = scheduler.generate("source", "same-output", "bulk");

    await expect(first).resolves.toEqual({ bytes: 10 });
    await expect(second).resolves.toEqual({ bytes: 10 });
    expect(generator.generate).toHaveBeenCalledTimes(1);
  });

  it("respects the interactive concurrency limit", async () => {
    const calls: string[] = [];
    const pending = new Map<string, Deferred>();
    const generator = controlledGenerator(calls, pending);
    const scheduler = createThumbnailScheduler(generator, { interactive: 2, bulk: 1 });

    const tasks = [1, 2, 3].map((id) =>
      scheduler.generate(`source-${id}`, `out-${id}`, "interactive"),
    );
    await waitForTurn();
    expect(calls).toHaveLength(2);

    pending.get("source-1")?.resolve({ bytes: 1 });
    await waitForTurn();
    expect(calls).toHaveLength(3);

    pending.get("source-2")?.resolve({ bytes: 1 });
    pending.get("source-3")?.resolve({ bytes: 1 });
    await expect(Promise.all(tasks)).resolves.toHaveLength(3);
  });

  it("propagates generator failures", async () => {
    const generator: ThumbnailGenerator = {
      generate: vi.fn(async () => {
        throw new Error("thumbnail failed");
      }),
    };
    const scheduler = createThumbnailScheduler(generator);

    await expect(scheduler.generate("source", "out", "interactive")).rejects.toThrow(
      "thumbnail failed",
    );
  });
});
