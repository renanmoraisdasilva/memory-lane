import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { _electron as electron } from "playwright";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
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

function mediaFilter(page: Page) {
  return page.getByRole("group", { name: "Media filter" });
}

function densityFilter(page: Page) {
  return page.getByRole("group", { name: "Grid density" });
}

async function selectFilter(page: Page, name: "All" | "Photos" | "Videos"): Promise<void> {
  await mediaFilter(page).getByRole("button", { name }).click();
  await expect(mediaFilter(page).getByRole("button", { name })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
}

async function setUpCatalog(page: Page): Promise<void> {
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
    timeout: 90_000,
  });
  await expect(page.getByRole("link", { name: "Open Memory Lane" })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("link", { name: "Open Memory Lane" }).click();
}

async function expectMemoryLane(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Memory Lane" })).toBeVisible();
  await expect(mediaFilter(page)).toBeVisible();
  await expect(densityFilter(page)).toBeVisible();
  await expect(page.getByRole("feed", { name: "Media timeline" })).toBeVisible();
}

async function browsePhotos(page: Page): Promise<void> {
  await expectMemoryLane(page);
  await selectFilter(page, "Photos");
  await expect(page.getByRole("link", { name: /photo-one\.png, photo/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /photo-two\.png, photo/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /clip\.mp4, video/ })).toHaveCount(0);
}

async function openViewerAndNavigate(page: Page): Promise<void> {
  await page.getByRole("link", { name: /photo-one\.png, photo/ }).click();
  await expect(page.getByRole("heading", { name: "photo-one.png" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Media details" })).toBeVisible();

  const photo = page.getByRole("img", { name: "photo-one.png" });
  await expect(photo).toBeVisible();
  await expect(photo).toHaveAttribute("src", /^ml-media:\/\/media\/\d+$/);

  const nextLink = page.getByRole("link", { name: "Next item" });
  if ((await nextLink.count()) > 0) {
    await nextLink.click();
  } else {
    await page.getByRole("link", { name: "Previous item" }).click();
  }
  await expect(page.getByRole("heading", { name: "photo-two.png" })).toBeVisible();
  await expect(page.getByRole("img", { name: "photo-two.png" })).toHaveAttribute(
    "src",
    /^ml-media:\/\/media\/\d+$/,
  );

  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Memory Lane" })).toBeVisible();
  await expect(mediaFilter(page).getByRole("button", { name: "Photos" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
}

async function browseVideosAndDensity(page: Page): Promise<void> {
  await selectFilter(page, "Videos");
  await expect(page.getByRole("link", { name: /clip\.mp4, video/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /photo-one\.png, photo/ })).toHaveCount(0);

  await densityFilter(page).getByRole("button", { name: "Dense" }).click();
  await expect(densityFilter(page).getByRole("button", { name: "Dense" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page).toHaveURL(/density=dense/);

  await selectFilter(page, "All");
  await expect(page.getByRole("link", { name: /photo-one\.png, photo/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /clip\.mp4, video/ })).toBeVisible();
}

async function browseYears(page: Page): Promise<void> {
  const yearRail = page.getByRole("group", { name: "Jump to year" });
  const currentYear = String(new Date().getFullYear());
  const yearButton = yearRail.getByRole("button", { name: currentYear, exact: true });
  await expect(yearButton).toBeVisible();
  await yearButton.click();
  await expect(yearButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: /photo-one\.png, photo/ })).toBeVisible();

  await yearRail.getByRole("button", { name: "All years" }).click();
  await expect(yearRail.getByRole("button", { name: "All years" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
}

test("sets up, scans, filters, and browses the library from the UI", async () => {
  test.setTimeout(120_000);
  const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-ui-e2e-"));
  const userDataPath = path.join(root, "user-data");
  const developmentDrivePath = path.join(root, "development-drive");
  await mkdir(userDataPath, { recursive: true });
  await mkdir(developmentDrivePath, { recursive: true });
  await writeFile(path.join(developmentDrivePath, "photo-one.png"), ONE_PIXEL_PNG);
  await writeFile(path.join(developmentDrivePath, "photo-two.png"), ONE_PIXEL_PNG);
  await writeFile(path.join(developmentDrivePath, "clip.mp4"), "not a real video");
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
    await browsePhotos(page);
    await openViewerAndNavigate(page);
    await browseVideosAndDensity(page);
    await browseYears(page);
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
