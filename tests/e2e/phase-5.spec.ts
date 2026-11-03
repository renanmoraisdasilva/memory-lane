import { access, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
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

test("[ML-SET-003] [ML-SET-006] [ML-SET-012] [ML-REL-009] [ML-REL-010] browses other files and manages settings, cache, and backups", async () => {
  test.setTimeout(150_000);
  const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-phase-5-e2e-"));
  const userDataPath = path.join(root, "user-data");
  const developmentDrivePath = path.join(root, "development-drive");
  await mkdir(userDataPath, { recursive: true });
  await mkdir(developmentDrivePath, { recursive: true });
  await writeFile(path.join(developmentDrivePath, "a.jpg"), ONE_PIXEL_JPEG);
  await writeFile(path.join(developmentDrivePath, "notes.txt"), "remember this");
  await writeFile(path.join(developmentDrivePath, "budget.csv"), "month,total\nOctober,42\n");

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

    await page.getByRole("link", { name: "Other files" }).click();
    await expect(page.getByRole("heading", { name: "Other files" })).toBeVisible();
    await expect(page.getByText("notes.txt")).toBeVisible();
    await expect(page.getByText("budget.csv")).toBeVisible();
    await expect(page.getByRole("tab", { name: /Documents/ })).toBeVisible();

    await page.getByRole("tab", { name: /PDFs/ }).click();
    await expect(page.getByText("notes.txt")).not.toBeVisible();

    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Storage and app details" })).toBeVisible();

    await page.getByRole("button", { name: "Back up now" }).click();
    await expect(page.getByText("Backup complete")).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(async () => {
        const backupsRoot = path.join(userDataPath, "backups");
        const entries = await readdir(backupsRoot).catch(() => []);
        return entries.length;
      })
      .toBeGreaterThan(0);

    await page.getByRole("button", { name: "Clear generated cache" }).click();
    const dialog = page.getByRole("dialog", { name: "Clear generated cache?" });
    await dialog.getByRole("button", { name: "Clear cache" }).click();
    await expect(page.getByText("Cache cleared")).toBeVisible({ timeout: 30_000 });

    await access(path.join(developmentDrivePath, "notes.txt"));
    await access(path.join(developmentDrivePath, "a.jpg"));
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
