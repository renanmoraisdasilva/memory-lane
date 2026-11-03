import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ScanState, ScanStatus } from "@shared/contracts/scan";
import type { FileHasher } from "../../src/main/modules/scanning/domain/scan-files";
import { createScanHarness, waitForComplete } from "./scan-harness";

interface BlockingHasher {
  hasher: FileHasher;
  started: Promise<void>;
  release: () => void;
}

interface ToggleChecker {
  check: (rootPath: string) => Promise<void>;
  setAvailable: (available: boolean) => void;
}

function createToggleChecker(): ToggleChecker {
  let available = true;
  return {
    async check(): Promise<void> {
      if (!available) {
        throw new Error("Drive unavailable");
      }
    },
    setAvailable: (next: boolean) => {
      available = next;
    },
  };
}

async function waitForStatus(
  scanService: Awaited<ReturnType<typeof createScanHarness>>["scanService"],
  drive: Awaited<ReturnType<typeof createScanHarness>>["drive"],
  status: ScanStatus,
  timeoutMs = 10_000,
): Promise<ScanState> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const state = await scanService.getState(drive.volumeId);
    if (state.status === status) {
      return state;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for scan status ${status}`);
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
  it("[ML-SCAN-004] [ML-SCAN-006] [ML-REL-004] pauses after the current file, holds progress, and resumes manually", async () => {
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

  it("[ML-SCAN-007] [ML-REL-004] persists an interruption on shutdown and resumes it explicitly", async () => {
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

  it("[ML-REL-016] fails cleanly when the drive disconnects and resumes after it returns", async () => {
    const blocking = createBlockingHasher();
    const checker = createToggleChecker();
    const harness = await createScanHarness({
      hasher: blocking.hasher,
      checkDriveAvailable: checker.check,
    });
    try {
      await writeFile(path.join(harness.drive.rootPath, "big.bin"), "blocked");
      await harness.scanService.startScan(harness.drive.volumeId, "balanced");
      await blocking.started;

      checker.setAvailable(false);
      blocking.release();

      const failed = await waitForStatus(harness.scanService, harness.drive, "error");
      expect(failed.errorMessage).toBe("The drive disconnected during the scan");

      checker.setAvailable(true);
      const resumed = await harness.scanService.resumeScan(harness.drive.volumeId);
      expect(resumed.status).toBe("active");

      const complete = await waitForComplete(harness.scanService, harness.drive);
      expect(complete.status).toBe("complete");
      expect(complete.report?.missingFiles).toBe(0);
    } finally {
      blocking.release();
      await harness.dispose();
    }
  });
});
