import { execFile } from "node:child_process";
import { copyFile, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import Database from "better-sqlite3";
import ffmpegStatic from "ffmpeg-static";
import { afterEach, describe, expect, it } from "vitest";
import { VideoProxyService } from "../../src/main/modules/media/video-proxy";
import { createScanHarness, testLogger, waitForComplete } from "./scan-harness";

const execFileAsync = promisify(execFile);
const ffmpegPath = ffmpegStatic;
const roots: string[] = [];

async function createRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-video-proxy-"));
  roots.push(root);
  return root;
}

async function generateFixture(outputPath: string, format: "wmv" | "3gp"): Promise<void> {
  if (ffmpegPath === null) {
    throw new Error("ffmpeg is unavailable");
  }
  const common = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    format === "wmv" ? "color=c=red:s=64x64:d=0.6" : "color=c=blue:s=176x144:d=0.6",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=channel_layout=mono:sample_rate=44100",
    "-t",
    "0.6",
  ];
  const codecs =
    format === "wmv"
      ? ["-c:v", "wmv2", "-b:v", "200k", "-c:a", "wmav2", "-b:a", "64k", "-f", "asf"]
      : [
          "-c:v",
          "h263",
          "-b:v",
          "100k",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "libopencore_amrnb",
          "-ar",
          "8000",
          "-ac",
          "1",
          "-f",
          "3gp",
        ];
  await execFileAsync(ffmpegPath, [...common, ...codecs, outputPath]);
}

async function fileId(catalogPath: string, name: string): Promise<number> {
  const db = new Database(catalogPath, { readonly: true });
  try {
    const row = db.prepare("SELECT id FROM files WHERE name = ?").get(name) as
      { id: number } | undefined;
    if (row === undefined) {
      throw new Error(`Fixture ${name} was not cataloged`);
    }
    return row.id;
  } finally {
    db.close();
  }
}

async function waitForProxy(
  service: VideoProxyService,
  fileIdValue: number,
): Promise<Awaited<ReturnType<VideoProxyService["getState"]>>> {
  const deadline = Date.now() + 30_000;
  let state = await service.prepare(fileIdValue);
  while (Date.now() < deadline) {
    if (state.status === "ready" || state.status === "failed") {
      return state;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
    state = await service.getState(fileIdValue);
  }
  throw new Error(`Timed out preparing proxy for file ${String(fileIdValue)}`);
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function copyIntoDrive(source: string, destination: string): Promise<void> {
  await copyFile(source, destination);
}

describe.skipIf(ffmpegPath === null)("video proxy integration", () => {
  it("[ML-LIB-009] [ML-REL-018] converts WMV and 3GP sources into playable MP4 proxies and reuses the cache", async () => {
    const harness = await createScanHarness();
    const service = new VideoProxyService({
      db: harness.db,
      ffmpegPath: ffmpegPath ?? "ffmpeg",
      logger: testLogger(),
    });
    const root = await createRoot();
    try {
      const wmvPath = path.join(root, "clip.wmv");
      const threeGpPath = path.join(root, "clip.3gp");
      await generateFixture(wmvPath, "wmv");
      await generateFixture(threeGpPath, "3gp");
      await copyIntoDrive(wmvPath, path.join(harness.drive.rootPath, "clip.wmv"));
      await copyIntoDrive(threeGpPath, path.join(harness.drive.rootPath, "clip.3gp"));

      await harness.scanService.startScan(harness.drive.volumeId, "max");
      await waitForComplete(harness.scanService, harness.drive);

      for (const name of ["clip.wmv", "clip.3gp"]) {
        const id = await fileId(harness.catalogPath, name);
        const state = await waitForProxy(service, id);
        expect(state.status).toBe("ready");
        expect(state.mediaUrl).toBe(`ml-media://proxy/${String(id)}`);
        const proxyPath = await service.resolveProxyPath(id);
        expect(proxyPath).not.toBeNull();
        if (proxyPath === null) {
          throw new Error("Missing proxy path");
        }
        expect((await stat(proxyPath)).size).toBeGreaterThan(0);
        await execFileAsync(ffmpegPath ?? "ffmpeg", [
          "-hide_banner",
          "-loglevel",
          "error",
          "-i",
          proxyPath,
          "-f",
          "null",
          "-",
        ]);
      }

      const cachedId = await fileId(harness.catalogPath, "clip.wmv");
      const cached = await service.prepare(cachedId);
      expect(cached.status).toBe("ready");
    } finally {
      await service.shutdown();
      await harness.dispose();
    }
  });
  it("[ML-VIDEO-007] reports a failed conversion without creating coverage or a proxy URL", async () => {
    const harness = await createScanHarness();
    const service = new VideoProxyService({
      db: harness.db,
      ffmpegPath: ffmpegPath ?? "ffmpeg",
      logger: testLogger(),
    });
    try {
      await writeFile(path.join(harness.drive.rootPath, "broken.wmv"), "not a video");
      await harness.scanService.startScan(harness.drive.volumeId, "max");
      await waitForComplete(harness.scanService, harness.drive);

      const id = await fileId(harness.catalogPath, "broken.wmv");
      const state = await waitForProxy(service, id);
      expect(state.status).toBe("failed");
      expect(state.mediaUrl).toBeNull();
      expect(state.errorMessage).toBeTruthy();
      expect(await service.resolveProxyPath(id)).toBeNull();
    } finally {
      await service.shutdown();
      await harness.dispose();
    }
  });
});
