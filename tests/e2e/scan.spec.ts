import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { _electron as electron } from "playwright";
import type { CatalogSummary, DriveInfo } from "@shared/contracts/drives";
import type { IpcResult } from "@shared/contracts/ipc";
import type { ScanState } from "@shared/contracts/scan";

interface RendererBridge {
  listDrives(): Promise<IpcResult<DriveInfo[]>>;
  initializeCatalog(params: { volumeId: string }): Promise<IpcResult<CatalogSummary>>;
  startScan(params: { volumeId: string; intensity: string }): Promise<IpcResult<ScanState>>;
  getScanState(params: { volumeId: string }): Promise<IpcResult<ScanState>>;
}

function childEnvironment(): Record<string, string> {
  const environment: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      environment[key] = value;
    }
  }
  return environment;
}

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test("[ML-REL-004] runs a four-stage scan through the real preload bridge", async () => {
  test.setTimeout(90_000);
  const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-scan-e2e-"));
  const userDataPath = path.join(root, "user-data");
  const developmentDrivePath = path.join(root, "development-drive");
  await mkdir(userDataPath, { recursive: true });
  await mkdir(developmentDrivePath, { recursive: true });
  await writeFile(path.join(developmentDrivePath, "photo.png"), ONE_PIXEL_PNG);
  await writeFile(path.join(developmentDrivePath, "notes.txt"), "notes");

  const app = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: {
      ...childEnvironment(),
      MEMORY_LANE_USER_DATA: userDataPath,
      MEMORY_LANE_DEV_DRIVE: developmentDrivePath,
      MEMORY_LANE_E2E: "1",
    },
  });

  try {
    const page = await app.firstWindow();
    await expect(page.getByRole("heading", { name: "Open a memory archive" })).toBeVisible();

    const volumeId = await page.evaluate(async () => {
      const bridge = (globalThis as unknown as { memoryLane: RendererBridge }).memoryLane;
      const drives = await bridge.listDrives();
      if (!drives.ok) {
        throw new Error(drives.error.message);
      }
      const drive = drives.data.find((candidate) => candidate.label === "Development drive");
      if (drive === undefined) {
        throw new Error("Development drive was not detected");
      }
      return drive.volumeId;
    });

    await page.evaluate(
      async ({ id }) => {
        const bridge = (globalThis as unknown as { memoryLane: RendererBridge }).memoryLane;
        const catalog = await bridge.initializeCatalog({ volumeId: id });
        if (!catalog.ok) {
          throw new Error(catalog.error.message);
        }
      },
      { id: volumeId },
    );

    const complete = await page.evaluate(
      async ({ id }) => {
        const bridge = (globalThis as unknown as { memoryLane: RendererBridge }).memoryLane;
        const started = await bridge.startScan({ volumeId: id, intensity: "max" });
        if (!started.ok) {
          throw new Error(started.error.message);
        }

        const deadline = Date.now() + 60_000;
        while (Date.now() < deadline) {
          const state = await bridge.getScanState({ volumeId: id });
          if (!state.ok) {
            throw new Error(state.error.message);
          }
          if (state.data.status === "complete") {
            return state.data;
          }
          if (state.data.status === "error") {
            throw new Error(state.data.errorMessage ?? "Scan failed");
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        throw new Error("Timed out waiting for the scan");
      },
      { id: volumeId },
    );

    expect(complete.status).toBe("complete");
    expect(complete.mode).toBe("initial");
    expect(complete.report).toMatchObject({
      newFiles: 2,
      changedFiles: 0,
      missingFiles: 0,
    });
    expect(complete.stages.map((stage) => stage.state)).toEqual([
      "complete",
      "complete",
      "complete",
      "complete",
    ]);
    expect(complete.stages.map((stage) => stage.processed)).toEqual([2, 2, 1, 2]);

    await expect(
      access(path.join(developmentDrivePath, ".memorylane", "catalog.db")),
    ).resolves.toBeUndefined();
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
