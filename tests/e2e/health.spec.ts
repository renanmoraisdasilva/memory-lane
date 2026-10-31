import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
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
}

test("reports duplicate groups and runs a catalog validation", async () => {
  test.setTimeout(120_000);
  const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-health-e2e-"));
  const userDataPath = path.join(root, "user-data");
  const developmentDrivePath = path.join(root, "development-drive");
  await mkdir(userDataPath, { recursive: true });
  await mkdir(developmentDrivePath, { recursive: true });
  await writeFile(path.join(developmentDrivePath, "a.jpg"), ONE_PIXEL_JPEG);
  await writeFile(path.join(developmentDrivePath, "b.jpg"), ONE_PIXEL_JPEG);
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
    await setUpCatalog(page);
    await page.getByRole("link", { name: /Library health/ }).click();
    await expect(page.getByRole("heading", { name: "Integrity information" })).toBeVisible();
    await expect(page.getByText("No missing files")).toBeVisible();

    await page.getByRole("tab", { name: /Duplicates/ }).click();
    await expect(page.getByText("2 exact copies")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("a.jpg", { exact: true })).toBeVisible();
    await expect(page.getByText("b.jpg", { exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "Validation" }).click();
    await page.getByLabel("Metadata revalidation").uncheck();
    await page.getByRole("button", { name: "Run validation" }).click();
    await expect(page.getByRole("heading", { name: "Validation complete" })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText("Verified")).toBeVisible();
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
