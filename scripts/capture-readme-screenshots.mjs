import { copyFile, mkdir, readdir, rm, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import { exiftool } from "exiftool-vendored";
import { _electron as electron } from "playwright";

const ROOT = path.join(path.parse(process.cwd()).root, "MemoryLaneDemo");
const MARKER = path.join(ROOT, ".memory-lane-readme-fixture");
const DRIVE = path.join(ROOT, "Archive");
const USER_DATA = path.join(ROOT, "UserData");
const OUTPUT = path.resolve("docs", "images");
const EXECUTABLE = path.resolve("release", "win-unpacked", "Memory Lane.exe");
const IMAGE_SOURCE = path.resolve("ui-mockups", "assets", "images");

const PHOTOS = [
  ["chronological-gallery-02.jpg", "Trips\\Santorini\\Santorini sunset.jpg", "2024:06:18 19:42:00"],
  ["chronological-gallery-04.jpg", "Trips\\Santorini\\Oia alley.jpg", "2024:06:18 10:15:00"],
  ["chronological-gallery-20.jpg", "Trips\\Kyoto\\Temple in autumn.jpg", "2024:06:20 17:05:00"],
  ["chronological-gallery-14.jpg", "Trips\\Banff\\Snowy forest trail.jpg", "2024:06:20 09:20:00"],
  ["chronological-gallery-18.jpg", "Trips\\Banff\\Frozen lake at dawn.jpg", "2024:06:20 08:10:00"],
  [
    "chronological-gallery-07.jpg",
    "Trips\\Mykonos\\Windmills at golden hour.jpg",
    "2024:06:18 18:20:00",
  ],
  ["chronological-gallery-16.jpg", "Home\\Winter morning cocoa.jpg", "2024:06:20 09:30:00"],
  ["chronological-gallery-11.jpg", "Home\\Garden table.jpg", "2024:06:19 13:45:00"],
];

const OTHER_FILES = [
  ["Documents\\Greece itinerary.txt", "Day 1 - Santorini\nDay 2 - Oia\nDay 3 - Ferry to Mykonos\n"],
  ["Documents\\Packing list.md", "# Packing\n\n- Camera\n- Walking shoes\n- Light jacket\n"],
  ["Documents\\Trip budget.csv", "category,planned,actual\nFlights,1200,1180\nHotels,900,940\n"],
  ["Documents\\Ferry tickets.pdf", "%PDF-1.4\nMemory Lane demo fixture\n"],
  ["Documents\\Photo archive 2019.zip", "Memory Lane demo fixture\n"],
];

function exifDate(value) {
  const [datePart, timePart] = value.split(" ");
  const [year, month, day] = datePart.split(":").map(Number);
  const [hour, minute, second] = timePart.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}

async function prepareFixture() {
  try {
    const entries = await readdir(ROOT);
    if (!entries.includes(path.basename(MARKER))) {
      throw new Error(`Refusing to remove ${ROOT}: it was not created by this script.`);
    }
    await rm(ROOT, { recursive: true, force: true });
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  await mkdir(DRIVE, { recursive: true });
  await mkdir(USER_DATA, { recursive: true });
  await mkdir(OUTPUT, { recursive: true });
  await writeFile(MARKER, "Memory Lane README screenshot fixture\n");

  for (const [source, target, date] of PHOTOS) {
    const targetPath = path.join(DRIVE, target);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await copyFile(path.join(IMAGE_SOURCE, source), targetPath);
    await exiftool.write(
      targetPath,
      {
        DateTimeOriginal: date,
        CreateDate: date,
        Make: "Memory Lane",
        Model: "Demo archive",
      },
      ["-overwrite_original"],
    );
    const timestamp = exifDate(date);
    await utimes(targetPath, timestamp, timestamp);
  }

  const duplicateSource = path.join(DRIVE, "Trips\\Santorini\\Santorini sunset.jpg");
  await copyFile(duplicateSource, path.join(DRIVE, "Trips\\Santorini\\Santorini sunset copy.jpg"));

  for (const [target, content] of OTHER_FILES) {
    const targetPath = path.join(DRIVE, target);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, content, "utf8");
    const timestamp = exifDate("2024:06:17 09:00:00");
    await utimes(targetPath, timestamp, timestamp);
  }
}

async function waitForApplication(page, text) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: "visible" });
}

async function capture(page, name) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUTPUT, name) });
  console.log(`Captured docs/images/${name}`);
}

async function main() {
  await prepareFixture();
  const environment = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      environment[key] = value;
    }
  }

  let app;
  try {
    app = await electron.launch({
      executablePath: EXECUTABLE,
      env: {
        ...environment,
        MEMORY_LANE_USER_DATA: USER_DATA,
        MEMORY_LANE_DEV_DRIVE: DRIVE,
        MEMORY_LANE_DEV_DRIVE_LABEL: "WD My Passport 2TB",
        MEMORY_LANE_E2E: "1",
      },
    });

    const page = await app.firstWindow();
    await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      window?.setSize(1440, 900);
      window?.center();
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });

    await page.getByRole("heading", { name: "Open a memory archive" }).waitFor({
      state: "visible",
      timeout: 20_000,
    });
    const driveCard = page.getByRole("article").filter({ hasText: "WD My Passport 2TB" });
    await driveCard
      .getByRole("button", { name: /Set up a new catalog on WD My Passport 2TB/ })
      .click();
    const setupDialog = page.getByRole("dialog", { name: "Set up a new archive" });
    await setupDialog.getByRole("button", { name: "Start first scan" }).click();
    await page.getByRole("heading", { name: "Scan complete" }).waitFor({
      state: "visible",
      timeout: 90_000,
    });

    await capture(page, "scan.png");

    await page.getByRole("link", { name: "Memory Lane", exact: true }).click();
    await page.getByRole("heading", { name: "Memory Lane" }).waitFor({
      state: "visible",
      timeout: 20_000,
    });
    await page.locator('[data-thumbnail-state="ready"]').first().waitFor({ timeout: 20_000 });
    await page.waitForTimeout(1_200);
    await capture(page, "library.png");

    await page
      .getByRole("link", { name: /, photo/ })
      .first()
      .click();
    await page.waitForURL(/#\/library\/item\//, { timeout: 10_000 });
    await page.waitForTimeout(900);
    await capture(page, "viewer.png");

    await page.getByRole("link", { name: "Library health", exact: true }).click();
    await page.getByRole("heading", { name: "Integrity information" }).waitFor({
      state: "visible",
    });
    await page.getByRole("tab", { name: /Duplicates/ }).click();
    await waitForApplication(page, "exact copies");
    await capture(page, "library-health.png");

    await page.getByRole("tab", { name: "Validation" }).click();
    await page.getByRole("button", { name: "Run validation" }).click();
    await page.getByRole("heading", { name: "Validation complete" }).waitFor({
      state: "visible",
      timeout: 90_000,
    });
    await capture(page, "library-validation.png");

    await page.getByRole("link", { name: "Other files", exact: true }).click();
    await page.getByRole("heading", { name: "Other files" }).waitFor({ state: "visible" });
    await capture(page, "other-files.png");

    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await page.getByRole("heading", { name: "Storage and app details" }).waitFor({
      state: "visible",
    });
    await page.getByRole("button", { name: "Back up now" }).click();
    await waitForApplication(page, "Backup complete");
    await capture(page, "settings.png");

    console.log("README screenshots refreshed.");
  } finally {
    await app?.close();
    await exiftool.end();
    await rm(ROOT, { recursive: true, force: true });
  }
}

await main();
