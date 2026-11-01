import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { test, expect } from "@playwright/test";
import { _electron as electron } from "playwright";
import ffmpegStatic from "ffmpeg-static";
import type { CatalogSummary, DriveInfo } from "@shared/contracts/drives";
import type { IpcResult } from "@shared/contracts/ipc";
import type { LibraryItem, LibraryTimelinePage, VideoProxyState } from "@shared/contracts/library";
import type { ScanState } from "@shared/contracts/scan";

const execFileAsync = promisify(execFile);

interface RendererBridge {
  listDrives(): Promise<IpcResult<DriveInfo[]>>;
  initializeCatalog(params: { volumeId: string }): Promise<IpcResult<CatalogSummary>>;
  startScan(params: { volumeId: string; intensity: string }): Promise<IpcResult<ScanState>>;
  getScanState(params: { volumeId: string }): Promise<IpcResult<ScanState>>;
  getLibraryTimeline(params: {
    filter: string;
    limit: number;
  }): Promise<IpcResult<LibraryTimelinePage>>;
  prepareVideoProxy(params: {
    fileId: number;
    retry?: boolean;
  }): Promise<IpcResult<VideoProxyState>>;
  getVideoProxyState(params: { fileId: number }): Promise<IpcResult<VideoProxyState>>;
}

interface RendererVideoElement {
  preload: string;
  src: string;
  readyState: number;
  duration: number;
  videoWidth: number;
  error: { message: string } | null;
  addEventListener(type: string, listener: () => void, options?: { once?: boolean }): void;
  remove(): void;
}

interface RendererDocument {
  createElement(tag: string): RendererVideoElement;
  body: { appendChild(node: RendererVideoElement): void };
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

async function generateWmv(filePath: string): Promise<void> {
  if (ffmpegStatic === null) {
    throw new Error("ffmpeg-static is unavailable");
  }
  await execFileAsync(ffmpegStatic, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=red:s=64x64:d=0.5",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=channel_layout=mono:sample_rate=44100",
    "-t",
    "0.5",
    "-c:v",
    "wmv2",
    "-b:v",
    "200k",
    "-c:a",
    "wmav2",
    "-b:a",
    "64k",
    "-f",
    "asf",
    filePath,
  ]);
}

test("prepares and serves a WMV compatible copy through the real bridge", async () => {
  test.setTimeout(120_000);
  const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-video-e2e-"));
  const userDataPath = path.join(root, "user-data");
  const developmentDrivePath = path.join(root, "development-drive");
  await mkdir(userDataPath, { recursive: true });
  await mkdir(developmentDrivePath, { recursive: true });
  await generateWmv(path.join(developmentDrivePath, "clip.wmv"));

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
      const catalog = await bridge.initializeCatalog({ volumeId: drive.volumeId });
      if (!catalog.ok) {
        throw new Error(catalog.error.message);
      }
      return drive.volumeId;
    });

    await page.evaluate(
      async ({ id }) => {
        const bridge = (globalThis as unknown as { memoryLane: RendererBridge }).memoryLane;
        const started = await bridge.startScan({ volumeId: id, intensity: "eco" });
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

    const videoItem = await page.evaluate(async () => {
      const bridge = (globalThis as unknown as { memoryLane: RendererBridge }).memoryLane;
      const timeline = await bridge.getLibraryTimeline({ filter: "videos", limit: 10 });
      if (!timeline.ok) {
        throw new Error(timeline.error.message);
      }
      const item: LibraryItem | undefined = timeline.data.items[0];
      if (item === undefined) {
        throw new Error("No video was cataloged");
      }
      return item;
    });

    const proxy = await page.evaluate(
      async ({ fileId }) => {
        const bridge = (globalThis as unknown as { memoryLane: RendererBridge }).memoryLane;
        const first = await bridge.prepareVideoProxy({ fileId });
        if (!first.ok) {
          throw new Error(first.error.message);
        }
        let state = first.data;
        const deadline = Date.now() + 60_000;
        while (Date.now() < deadline) {
          if (state.status === "ready" || state.status === "failed") {
            return state;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
          const next = await bridge.getVideoProxyState({ fileId });
          if (!next.ok) {
            throw new Error(next.error.message);
          }
          state = next.data;
        }
        throw new Error(`Timed out preparing video ${String(fileId)}`);
      },
      { fileId: videoItem.fileId },
    );

    if (proxy.mediaUrl === null) {
      throw new Error(`Proxy did not become ready: ${JSON.stringify(proxy)}`);
    }
    const media = await page.evaluate(
      async ({ url }) => {
        const dom = (globalThis as unknown as { document: RendererDocument }).document;
        const video = dom.createElement("video");
        video.preload = "metadata";
        video.src = url;
        dom.body.appendChild(video);
        const result = await new Promise<{
          readyState: number;
          duration: number;
          videoWidth: number;
          error: string | null;
        }>((resolve) => {
          let settled = false;
          const finish = (): void => {
            if (settled) {
              return;
            }
            settled = true;
            resolve({
              readyState: video.readyState,
              duration: Number.isFinite(video.duration) ? video.duration : 0,
              videoWidth: video.videoWidth,
              error: video.error?.message ?? null,
            });
          };
          video.addEventListener("loadedmetadata", finish, { once: true });
          video.addEventListener("error", finish, { once: true });
          setTimeout(finish, 10_000);
        });
        video.remove();
        return result;
      },
      { url: proxy.mediaUrl },
    );

    expect(videoItem.name).toBe("clip.wmv");
    expect(proxy.status).toBe("ready");
    expect(media.error).toBeNull();
    expect(media.readyState).toBeGreaterThanOrEqual(1);
    expect(media.videoWidth).toBeGreaterThan(0);
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
