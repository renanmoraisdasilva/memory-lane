import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { FileHasher } from "../../src/main/modules/scanning/domain/scan-files";
import { createScanHarness, waitForComplete } from "./scan-harness";

interface BlockingHasher {
  hasher: FileHasher;
  started: Promise<void>;
  release: () => void;
}

function createBlockingHasher(): BlockingHasher {
  let releaseGate: () => void = () => undefined;
  let markStarted: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    releaseGate = resolve;
  });
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });

  return {
    hasher: {
      async hash(): Promise<string> {
        markStarted();
        await gate;
        return createHash("sha256").update("blocked").digest("hex");
      },
    },
    started,
    release: () => releaseGate(),
  };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

describe("scan controls integration", () => {
  it("pauses after the current file, holds progress, and resumes manually", async () => {
    const blocking = createBlockingHasher();
    const harness = await createScanHarness({ hasher: blocking.hasher });
    try {
      await writeFile(path.join(harness.drive.rootPath, "big.bin"), "blocked");
      await harness.scanService.startScan(harness.drive.volumeId, "max");
      await blocking.started;

      const updated = await harness.scanService.setIntensity(harness.drive.volumeId, "eco");
      expect(updated.intensity).toBe("eco");

      const paused = await harness.scanService.pauseScan(harness.drive.volumeId);
      expect(paused.status).toBe("paused");
      blocking.release();
      await delay(100);

      const held = await harness.scanService.getState(harness.drive.volumeId);
      expect(held.status).toBe("paused");
      expect(held.intensity).toBe("eco");

      const resumed = await harness.scanService.resumeScan(harness.drive.volumeId);
      expect(resumed.status).toBe("active");

      const complete = await waitForComplete(harness.scanService, harness.drive);
      expect(complete.status).toBe("complete");
    } finally {
      blocking.release();
      await harness.dispose();
    }
  });

  it("persists an interruption on shutdown and resumes it explicitly", async () => {
    const blocking = createBlockingHasher();
    const harness = await createScanHarness({ hasher: blocking.hasher });
    try {
      await writeFile(path.join(harness.drive.rootPath, "big.bin"), "blocked");
      await harness.scanService.startScan(harness.drive.volumeId, "balanced");
      await blocking.started;

      const stopping = harness.scanService.shutdown();
      blocking.release();
      await stopping;

      const interrupted = await harness.scanService.getState(harness.drive.volumeId);
      expect(interrupted.status).toBe("interrupted");

      const resumed = await harness.scanService.resumeScan(harness.drive.volumeId);
      expect(resumed.status).toBe("active");
      const complete = await waitForComplete(harness.scanService, harness.drive);
      expect(complete.status).toBe("complete");
    } finally {
      blocking.release();
      await harness.dispose();
    }
  });
});
