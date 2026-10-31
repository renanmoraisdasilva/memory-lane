import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { _electron as electron } from "playwright";

const executablePath = path.resolve("release", "win-unpacked", "Memory Lane.exe");
const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-smoke-"));
const userDataPath = path.join(root, "user-data");
const developmentDrivePath = path.join(root, "development-drive");
await mkdir(userDataPath, { recursive: true });
await mkdir(developmentDrivePath, { recursive: true });
await writeFile(path.join(developmentDrivePath, "scan.txt"), "packaged scan fixture");

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

  if (scanState.report?.newFiles !== 1) {
    throw new Error(`Unexpected packaged scan report: ${JSON.stringify(scanState.report)}`);
  }

  console.log("Packaged app launched, rendered, exposed the preload bridge, and completed a scan.");
} finally {
  if (app !== undefined) {
    await app.close();
  }
  await rm(root, { recursive: true, force: true });
}
