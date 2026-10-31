import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { exiftool } from "exiftool-vendored";
import { _electron as electron } from "playwright";

const ONE_PIXEL_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EB//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EB//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EB//2Q==",
  "base64",
);

const executablePath = path.resolve("release", "win-unpacked", "Memory Lane.exe");
const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-smoke-"));
const userDataPath = path.join(root, "user-data");
const developmentDrivePath = path.join(root, "development-drive");
await mkdir(userDataPath, { recursive: true });
await mkdir(developmentDrivePath, { recursive: true });
await writeFile(path.join(developmentDrivePath, "scan.txt"), "packaged scan fixture");
const photoPath = path.join(developmentDrivePath, "photo.jpg");
await writeFile(photoPath, ONE_PIXEL_JPEG);
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

  if (scanState.report?.newFiles !== 2) {
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
    const item = timeline.data.items[0];
    if (item === undefined) {
      throw new Error("Packaged library returned no items");
    }
    const details = await bridge.getLibraryItem({ fileId: item.fileId, filter: "all" });
    if (!details.ok) {
      throw new Error(details.error.message);
    }
    return { summary: summary.data, timeline: timeline.data, details: details.data };
  });

  if (library.summary.totalItems !== 1 || library.timeline.items[0]?.name !== "photo.jpg") {
    throw new Error(`Unexpected packaged library: ${JSON.stringify(library)}`);
  }
  if (library.timeline.items[0]?.date.source !== "exif.datetimeOriginal") {
    throw new Error(`Packaged ExifTool date was not used: ${JSON.stringify(library.timeline)}`);
  }
  if (
    !library.details.metadata.some(
      (entry) => entry.key === "metadata.exiftool" && entry.value === "ok",
    )
  ) {
    throw new Error(`Packaged ExifTool metadata missing: ${JSON.stringify(library.details)}`);
  }

  console.log(
    "Packaged app launched, rendered, exposed the preload bridge, completed a scan, and queried the library.",
  );
} finally {
  if (app !== undefined) {
    await app.close();
  }
  await rm(root, { recursive: true, force: true });
}
