import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { _electron as electron } from "playwright";

const executablePath = path.resolve("release", "win-unpacked", "Memory Lane.exe");
const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-smoke-"));
const userDataPath = path.join(root, "user-data");
const developmentDrivePath = path.join(root, "development-drive");
await mkdir(userDataPath, { recursive: true });
await mkdir(developmentDrivePath, { recursive: true });

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
  await page.getByRole("heading", { name: /Your archive/ }).waitFor({
    state: "visible",
    timeout: 20_000,
  });

  const bridgeType = await page.evaluate(() => typeof window.memoryLane);
  if (bridgeType !== "object") {
    throw new Error(`Preload bridge was not available: ${bridgeType}`);
  }

  console.log("Packaged app launched, rendered, and exposed the preload bridge.");
} finally {
  if (app !== undefined) {
    await app.close();
  }
  await rm(root, { recursive: true, force: true });
}
