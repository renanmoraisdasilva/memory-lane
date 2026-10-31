import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { exiftool } from "exiftool-vendored";
import { _electron as electron } from "playwright";

const ONE_PIXEL_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EB//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EB//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EB//2Q==",
  "base64",
);

function childEnvironment(): Record<string, string> {
  const environment: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      environment[key] = value;
    }
  }
  return environment;
}

async function setUpCatalog(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Open a memory archive" })).toBeVisible();
  const driveCard = page.getByRole("article").filter({ hasText: "Development drive" });
  await driveCard
    .getByRole("button", { name: /Set up a new catalog on Development drive/ })
    .click();
  const setupDialog = page.getByRole("dialog", { name: "Set up a new archive" });
  await setupDialog.getByRole("button", { name: "Start first scan" }).click();
  await expect(page.getByRole("heading", { name: "Scan complete" })).toBeVisible({
    timeout: 90_000,
  });
  await page.getByRole("link", { name: "Open Memory Lane" }).click();
  await expect(page.getByRole("heading", { name: "Memory Lane" })).toBeVisible();
}

test("assigns and clears a catalog-only date from the UI", async () => {
  test.setTimeout(120_000);
  const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-dates-e2e-"));
  const userDataPath = path.join(root, "user-data");
  const developmentDrivePath = path.join(root, "development-drive");
  await mkdir(userDataPath, { recursive: true });
  await mkdir(developmentDrivePath, { recursive: true });
  const photoPath = path.join(developmentDrivePath, "future.jpg");
  await writeFile(photoPath, ONE_PIXEL_JPEG);
  try {
    await exiftool.write(
      photoPath,
      { DateTimeOriginal: "2099:01:01 00:00:00", Make: "MemoryLane" },
      ["-overwrite_original"],
    );
  } finally {
    await exiftool.end();
  }

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
    await setUpCatalog(page);
    await page.getByRole("link", { name: /Date unavailable/ }).click();
    await expect(
      page.getByRole("heading", { name: "Items without a resolved date" }),
    ).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Select future.jpg" })).toBeVisible();

    await page.getByRole("checkbox", { name: "Select future.jpg" }).check();
    await page.getByLabel("Year").fill("2011");
    await page.getByLabel("Month").selectOption("7");
    await page.getByRole("button", { name: "Apply to catalog" }).click();
    await expect(page.getByText("No items need a date")).toBeVisible();

    await page.getByRole("link", { name: "Memory Lane", exact: true }).click();
    await expect(page.getByRole("heading", { name: "July 2011" })).toBeVisible();
    await page.getByRole("link", { name: "future.jpg, photo" }).click();
    await expect(page.getByText("Month precision · Manual date")).toBeVisible();
    await expect(page.getByRole("button", { name: "Clear manual date" })).toBeVisible();

    await page.getByRole("button", { name: "Clear manual date" }).click();
    await expect(page.getByText("Manual date cleared.")).toBeVisible();
    await expect(page.getByText("Date unavailable", { exact: true }).last()).toBeVisible();
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
