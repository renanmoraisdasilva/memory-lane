import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { exiftool } from "exiftool-vendored";
import ffmpegStatic from "ffmpeg-static";
import { _electron as electron } from "playwright";

const execFileAsync = promisify(execFile);

const ONE_PIXEL_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EB//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EB//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EB//2Q==",
  "base64",
);

const releaseDirectory =
  process.env.MEMORY_LANE_RELEASE_DIR === undefined
    ? path.resolve("release")
    : path.resolve(process.env.MEMORY_LANE_RELEASE_DIR);
const executablePath = path.join(releaseDirectory, "win-unpacked", "Memory Lane.exe");
const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-smoke-"));
const userDataPath = path.join(root, "user-data");
const developmentDrivePath = path.join(root, "development-drive");
await mkdir(userDataPath, { recursive: true });
await mkdir(developmentDrivePath, { recursive: true });
await writeFile(path.join(developmentDrivePath, "scan.txt"), "packaged scan fixture");
const photoPath = path.join(developmentDrivePath, "photo.jpg");
await writeFile(photoPath, ONE_PIXEL_JPEG);
if (ffmpegStatic === null) {
  throw new Error("ffmpeg-static is unavailable for the packaged video smoke");
}
const videoPath = path.join(developmentDrivePath, "clip.wmv");
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
  videoPath,
]);
try {
  await exiftool.write(photoPath, { DateTimeOriginal: "2011:07:04 15:30:00", Make: "MemoryLane" }, [
    "-overwrite_original",
  ]);
} finally {
  await exiftool.end();
}

const environment = {};
for (const [key, value] of Object.entries(process.env)) {
  if (value !== undefined) {
    environment[key] = value;
  }
}

let app;
try {
  app = await electron.launch({
    executablePath,
    env: {
      ...environment,
      MEMORY_LANE_USER_DATA: userDataPath,
      MEMORY_LANE_DEV_DRIVE: developmentDrivePath,
    },
  });

  const page = await app.firstWindow();
  await page.getByRole("heading", { name: "Open a memory archive" }).waitFor({
    state: "visible",
    timeout: 20_000,
  });

  const bridgeType = await page.evaluate(() => typeof window.memoryLane);
  if (bridgeType !== "object") {
    throw new Error(`Preload bridge was not available: ${bridgeType}`);
  }

  const scanState = await page.evaluate(async () => {
    const bridge = window.memoryLane;
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
    const started = await bridge.startScan({ volumeId: drive.volumeId, intensity: "eco" });
    if (!started.ok) {
      throw new Error(started.error.message);
    }

    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const state = await bridge.getScanState({ volumeId: drive.volumeId });
      if (!state.ok) {
        throw new Error(state.error.message);
      }
      if (state.data.status === "complete") {
        return state.data;
      }
      if (state.data.status === "error") {
        throw new Error(state.data.errorMessage ?? "Packaged scan failed");
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("Timed out waiting for the packaged scan");
  });

  if (scanState.report?.newFiles !== 3) {
    throw new Error(`Unexpected packaged scan report: ${JSON.stringify(scanState.report)}`);
  }

  const library = await page.evaluate(async () => {
    const bridge = window.memoryLane;
    const summary = await bridge.getLibrarySummary();
    const timeline = await bridge.getLibraryTimeline({ filter: "all", limit: 10 });
    if (!summary.ok) {
      throw new Error(summary.error.message);
    }
    if (!timeline.ok) {
      throw new Error(timeline.error.message);
    }
    const photo = timeline.data.items.find((item) => item.name === "photo.jpg");
    const video = timeline.data.items.find((item) => item.name === "clip.wmv");
    if (photo === undefined || video === undefined) {
      throw new Error(
        `Packaged library did not return both media items: ${JSON.stringify(timeline.data)}`,
      );
    }
    const details = await bridge.getLibraryItem({ fileId: photo.fileId, filter: "all" });
    if (!details.ok) {
      throw new Error(details.error.message);
    }
    return { summary: summary.data, timeline: timeline.data, details: details.data, video };
  });

  if (library.summary.totalItems !== 2) {
    throw new Error(`Unexpected packaged library: ${JSON.stringify(library)}`);
  }
  if (
    library.details.item.name !== "photo.jpg" ||
    library.details.item.date.source !== "exif.datetimeOriginal"
  ) {
    throw new Error(`Packaged ExifTool date was not used: ${JSON.stringify(library.details)}`);
  }
  if (
    !library.details.metadata.some(
      (entry) => entry.key === "metadata.exiftool" && entry.value === "ok",
    )
  ) {
    throw new Error(`Packaged ExifTool metadata missing: ${JSON.stringify(library.details)}`);
  }

  const proxy = await page.evaluate(
    async ({ fileId }) => {
      const bridge = window.memoryLane;
      const first = await bridge.prepareVideoProxy({ fileId });
      if (!first.ok) {
        throw new Error(first.error.message);
      }
      let state = first.data;
      const deadline = Date.now() + 60_000;
      while (Date.now() < deadline) {
        if (state.status === "ready" || state.status === "failed") {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
        const next = await bridge.getVideoProxyState({ fileId });
        if (!next.ok) {
          throw new Error(next.error.message);
        }
        state = next.data;
      }
      return state;
    },
    { fileId: library.video.fileId },
  );

  if (proxy.status !== "ready" || proxy.mediaUrl === null) {
    throw new Error(`Packaged video proxy was not ready: ${JSON.stringify(proxy)}`);
  }

  const phaseFive = await page.evaluate(async () => {
    const bridge = window.memoryLane;
    const other = await bridge.getOtherFiles({ category: "documents", limit: 10 });
    if (!other.ok) {
      throw new Error(other.error.message);
    }
    const settings = await bridge.getSettingsInfo();
    if (!settings.ok) {
      throw new Error(settings.error.message);
    }
    const backup = await bridge.runBackup();
    if (!backup.ok) {
      throw new Error(backup.error.message);
    }
    const afterBackup = await bridge.getSettingsInfo();
    if (!afterBackup.ok) {
      throw new Error(afterBackup.error.message);
    }
    const cache = await bridge.clearCache();
    if (!cache.ok) {
      throw new Error(cache.error.message);
    }
    const summary = await bridge.getLibrarySummary();
    if (!summary.ok) {
      throw new Error(summary.error.message);
    }
    return {
      other: other.data,
      settings: settings.data,
      backup: backup.data,
      afterBackup: afterBackup.data,
      cache: cache.data,
      summary: summary.data,
    };
  });

  if (
    phaseFive.other.total !== 1 ||
    phaseFive.other.items[0]?.name !== "scan.txt" ||
    phaseFive.other.items[0]?.category !== "documents"
  ) {
    throw new Error(`Unexpected packaged Other files result: ${JSON.stringify(phaseFive.other)}`);
  }
  if (!phaseFive.settings.offline) {
    throw new Error("Packaged settings did not report offline mode");
  }
  if (phaseFive.backup.status !== "success" || phaseFive.afterBackup.backup.lastBackupAt === null) {
    throw new Error(`Packaged backup did not complete: ${JSON.stringify(phaseFive)}`);
  }
  if (phaseFive.summary.totalItems !== 2) {
    throw new Error(`Cache clearing changed the catalog: ${JSON.stringify(phaseFive.summary)}`);
  }

  await stat(phaseFive.backup.path);
  await stat(path.join(path.dirname(phaseFive.backup.path), "app.db"));
  try {
    await stat(phaseFive.settings.cache.path);
    throw new Error(`Packaged cache directory still exists: ${phaseFive.settings.cache.path}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Packaged cache directory")) {
      throw error;
    }
  }

  console.log(
    "Packaged app launched, rendered, scanned, prepared a WMV compatible copy, browsed Other files, completed a backup, and cleared generated cache.",
  );
} finally {
  if (app !== undefined) {
    await app.close();
  }
  await rm(root, { recursive: true, force: true });
}
