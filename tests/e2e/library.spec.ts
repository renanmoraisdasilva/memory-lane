import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { _electron as electron } from "playwright";
import type { CatalogSummary, DriveInfo } from "@shared/contracts/drives";
import type { IpcResult } from "@shared/contracts/ipc";
import type {
  LibraryItemDetails,
  LibrarySummary,
  LibraryTimelineIndex,
  LibraryTimelinePage,
} from "@shared/contracts/library";
import type { ScanState } from "@shared/contracts/scan";

interface LibraryBridge {
  listDrives(): Promise<IpcResult<DriveInfo[]>>;
  initializeCatalog(params: { volumeId: string }): Promise<IpcResult<CatalogSummary>>;
  startScan(params: { volumeId: string; intensity: string }): Promise<IpcResult<ScanState>>;
  getScanState(params: { volumeId: string }): Promise<IpcResult<ScanState>>;
  getLibrarySummary(): Promise<IpcResult<LibrarySummary>>;
  getLibraryTimeline(params: {
    filter: string;
    limit?: number;
  }): Promise<IpcResult<LibraryTimelinePage>>;
  getLibraryTimelineIndex(params: { filter: string }): Promise<IpcResult<LibraryTimelineIndex>>;
  getLibraryItem(params: {
    fileId: number;
    filter?: string;
  }): Promise<IpcResult<LibraryItemDetails>>;
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

test("[ML-REL-006] exposes the scanned catalog through the library bridge", async () => {
  test.setTimeout(90_000);
  const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-library-e2e-"));
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
      const bridge = (globalThis as unknown as { memoryLane: LibraryBridge }).memoryLane;
      const drives = await bridge.listDrives();
      if (!drives.ok) {
        throw new Error(drives.error.message);
      }
      const drive = drives.data.find((candidate) => candidate.label === "Development drive");
      if (drive === undefined) {
        throw new Error("Development drive was not detected");
      }

      const catalog = await bridge.initializeCatalog({ volumeId: drive.volumeId });
      if (!catalog.ok) {
        throw new Error(catalog.error.message);
      }
      const started = await bridge.startScan({ volumeId: drive.volumeId, intensity: "max" });
      if (!started.ok) {
        throw new Error(started.error.message);
      }
      return drive.volumeId;
    });

    await page.evaluate(
      async ({ id }) => {
        const bridge = (globalThis as unknown as { memoryLane: LibraryBridge }).memoryLane;
        const deadline = Date.now() + 60_000;
        while (Date.now() < deadline) {
          const state = await bridge.getScanState({ volumeId: id });
          if (!state.ok) {
            throw new Error(state.error.message);
          }
          if (state.data.status === "complete") {
            return;
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

    const library = await page.evaluate(async () => {
      const bridge = (globalThis as unknown as { memoryLane: LibraryBridge }).memoryLane;
      const summary = await bridge.getLibrarySummary();
      const timeline = await bridge.getLibraryTimeline({ filter: "all", limit: 200 });
      const index = await bridge.getLibraryTimelineIndex({ filter: "photos" });
      if (!summary.ok || !timeline.ok || !index.ok) {
        throw new Error("Library query failed");
      }
      const item = timeline.data.items[0];
      if (item === undefined) {
        throw new Error("Timeline returned no items");
      }
      const details = await bridge.getLibraryItem({ fileId: item.fileId, filter: "all" });
      if (!details.ok) {
        throw new Error(details.error.message);
      }
      return {
        summary: summary.data,
        timeline: timeline.data,
        index: index.data,
        details: details.data,
      };
    });

    expect(library.summary.totalItems).toBe(1);
    expect(library.summary.photoCount).toBe(1);
    expect(library.timeline.items[0]).toMatchObject({ name: "photo.png", mediaClass: "image" });
    expect(library.timeline.items[0]?.thumbnailUrl).toContain("ml-media://thumbnail/");
    expect(library.index.months).toHaveLength(1);
    expect(library.details.mediaUrl).toContain("ml-media://media/");
    expect(library.details.folder).toBe(developmentDrivePath);
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
