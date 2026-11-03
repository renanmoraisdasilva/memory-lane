import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { _electron as electron } from "playwright";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

let userDataPath: string;
let developmentDrivePath: string;

function childEnvironment(): Record<string, string> {
  const environment: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      environment[key] = value;
    }
  }
  return environment;
}

test.beforeAll(async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-e2e-"));
  userDataPath = path.join(root, "user-data");
  developmentDrivePath = path.join(root, "development-drive");
  await mkdir(userDataPath, { recursive: true });
  await mkdir(developmentDrivePath, { recursive: true });
  await writeFile(path.join(developmentDrivePath, "photo.png"), ONE_PIXEL_PNG);
  await writeFile(path.join(developmentDrivePath, "notes.txt"), "notes");
});

test.afterAll(async () => {
  await rm(path.dirname(userDataPath), { recursive: true, force: true });
});

test("[ML-REL-003] sets up a catalog and completes the first scan from the UI", async () => {
  test.setTimeout(90_000);

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

    const driveCard = page.getByRole("article").filter({ hasText: "Development drive" });
    await expect(driveCard).toBeVisible();
    await driveCard
      .getByRole("button", { name: /Set up a new catalog on Development drive/ })
      .click();

    const setupDialog = page.getByRole("dialog", { name: "Set up a new archive" });
    await expect(setupDialog).toBeVisible();
    await setupDialog.getByRole("button", { name: "Start first scan" }).click();

    await expect(page.getByRole("heading", { name: "Scan complete" })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByRole("heading", { name: "Scan report" })).toBeVisible();
    await expect(page.getByText("New files")).toBeVisible();

    const catalogPath = path.join(developmentDrivePath, ".memorylane", "catalog.db");
    await expect(page.getByText(catalogPath)).toBeVisible();
    await expect(access(catalogPath)).resolves.toBeUndefined();

    await page.getByRole("button", { name: "Open drive details for Development drive" }).click();
    const drawer = page.getByRole("dialog", { name: /Development drive/ });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Identity")).toBeVisible();
    await expect(drawer.getByText("Volume ID")).toBeVisible();
  } finally {
    await app.close();
  }
});
