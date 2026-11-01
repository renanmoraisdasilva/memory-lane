import { copyFile, mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { _electron as electron } from "playwright";

const sourcePath = process.argv[2];
if (sourcePath === undefined) {
  console.error("Usage: node scripts/validate-heic-packaged.mjs <photo.heic>");
  process.exit(1);
}

const executablePath = path.resolve("release", "win-unpacked", "Memory Lane.exe");
const resolvedSource = path.resolve(sourcePath);
await stat(resolvedSource);
await stat(executablePath);

const environment = {};
for (const [key, value] of Object.entries(process.env)) {
  if (value !== undefined) {
    environment[key] = value;
  }
}

const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-heic-check-"));
const userDataPath = path.join(root, "user-data");
const developmentDrivePath = path.join(root, "development-drive");
await mkdir(userDataPath, { recursive: true });
await mkdir(developmentDrivePath, { recursive: true });
await copyFile(resolvedSource, path.join(developmentDrivePath, "photo.heic"));

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

  const startedAt = Date.now();
  const result = await page.evaluate(async () => {
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

    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      const state = await bridge.getScanState({ volumeId: drive.volumeId });
      if (!state.ok) {
        throw new Error(state.error.message);
      }
      if (state.data.status === "complete") {
        break;
      }
      if (state.data.status === "error") {
        throw new Error(state.data.errorMessage ?? "Packaged scan failed");
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const timeline = await bridge.getLibraryTimeline({ filter: "all", limit: 10 });
    if (!timeline.ok) {
      throw new Error(timeline.error.message);
    }
    const item = timeline.data.items.find((candidate) => candidate.name === "photo.heic");
    if (item === undefined) {
      throw new Error("The HEIC fixture was not cataloged");
    }
    const details = await bridge.getLibraryItem({ fileId: item.fileId, filter: "all" });
    if (!details.ok) {
      throw new Error(details.error.message);
    }
    if (details.data.mediaUrl === null) {
      throw new Error("The HEIC fixture has no media URL");
    }

    const image = new Image();
    image.src = details.data.mediaUrl;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("The HEIC preview did not render"));
    });

    return {
      fileId: item.fileId,
      name: item.name,
      mediaUrl: details.data.mediaUrl,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    };
  });

  const previewPath = path.join(
    developmentDrivePath,
    ".memorylane",
    "cache",
    "previews",
    `${String(result.fileId)}.jpg`,
  );
  const preview = await stat(previewPath);
  console.log(
    JSON.stringify(
      {
        ...result,
        previewPath,
        previewBytes: preview.size,
        elapsedMs: Date.now() - startedAt,
      },
      null,
      2,
    ),
  );
} finally {
  await app?.close();
  await rm(root, { recursive: true, force: true });
}
