import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
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

test("backs up a source to two partial destinations", async () => {
  test.setTimeout(180_000);
  const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-replication-e2e-"));
  const userDataPath = path.join(root, "user-data");
  const sourcePath = path.join(root, "source-drive");
  const backupAPath = path.join(root, "backup-a");
  const backupBPath = path.join(root, "backup-b");
  await Promise.all([
    mkdir(userDataPath, { recursive: true }),
    mkdir(sourcePath, { recursive: true }),
    mkdir(backupAPath, { recursive: true }),
    mkdir(backupBPath, { recursive: true }),
  ]);
  await writeFile(path.join(sourcePath, "a-small.png"), ONE_PIXEL_PNG);
  await writeFile(path.join(sourcePath, "b-large.bin"), Buffer.alloc(2 * 1024 * 1024, 7));

  const app = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: {
      ...childEnvironment(),
      MEMORY_LANE_USER_DATA: userDataPath,
      MEMORY_LANE_DEV_DRIVES: JSON.stringify([
        { path: sourcePath, label: "Source drive", serial: "e2e-source" },
        { path: backupAPath, label: "Backup A", serial: "e2e-backup-a" },
        { path: backupBPath, label: "Backup B", serial: "e2e-backup-b" },
      ]),
      MEMORY_LANE_E2E: "1",
    },
  });

  try {
    const page = await app.firstWindow();
    await expect(page.getByRole("heading", { name: "Open a memory archive" })).toBeVisible();
    const sourceCard = page.getByRole("article").filter({ hasText: "Source drive" });
    await sourceCard.getByRole("button", { name: /Set up a new catalog on Source drive/ }).click();
    const setupDialog = page.getByRole("dialog", { name: "Set up a new archive" });
    await setupDialog.getByRole("button", { name: "Start first scan" }).click();
    await expect(page.getByRole("heading", { name: "Scan complete" })).toBeVisible({
      timeout: 90_000,
    });
    await page.getByRole("link", { name: "Open Memory Lane" }).click();
    await expect(page.getByRole("heading", { name: "Memory Lane" })).toBeVisible();

    await page.getByRole("link", { name: "Backup", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Backup destinations" })).toBeVisible();
    await page
      .getByRole("button", { name: /Add destination/ })
      .first()
      .click();

    const firstDrawer = page.getByRole("dialog", { name: "Add a backup destination" });
    await expect(firstDrawer).toBeVisible();
    await firstDrawer.getByRole("button", { name: /Backup A/ }).click();
    await firstDrawer.getByLabel("Space allocation").selectOption("fixed");
    await firstDrawer.getByLabel("Allocation (GB)").fill("0.001");
    await firstDrawer.getByLabel("Safety reserve (GB)").fill("0");
    await firstDrawer.getByRole("button", { name: "Add and adopt" }).click();
    await expect(page.getByRole("link").filter({ hasText: "Backup A" })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole("link").filter({ hasText: "Backup A" }).click();
    await expect(page.getByRole("heading", { name: "Backup A" })).toBeVisible();
    await expect(page.getByText("Adoption complete")).toBeVisible({ timeout: 30_000 });
    await page
      .getByRole("link", { name: /Backup/ })
      .first()
      .click();

    await page
      .getByRole("button", { name: /Add destination/ })
      .first()
      .click();
    const secondDrawer = page.getByRole("dialog", { name: "Add a backup destination" });
    await secondDrawer.getByRole("button", { name: /Backup B/ }).click();
    await secondDrawer.getByLabel("Safety reserve (GB)").fill("0");
    await secondDrawer.getByRole("button", { name: "Add and adopt" }).click();
    await expect(page.getByRole("link").filter({ hasText: "Backup B" })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("link").filter({ hasText: "Backup B" }).click();
    await expect(page.getByText("Adoption complete")).toBeVisible({ timeout: 30_000 });
    await page
      .getByRole("link", { name: /Backup/ })
      .first()
      .click();

    await page.getByRole("link", { name: "Review plan" }).click();
    await expect(page.getByRole("heading", { name: "Backup plan" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Backup A/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Backup B/ })).toBeVisible();
    await page.getByRole("button", { name: "Start backup" }).click();
    const startDialog = page.getByRole("dialog", { name: "Start partial backup" });
    await startDialog.getByRole("button", { name: "Start backup" }).click();

    await expect(page.getByRole("heading", { name: "Backup run" })).toBeVisible();
    await expect(page.getByText("Completed", { exact: true })).toBeVisible({
      timeout: 120_000,
    });

    const copyRoot = path.join(backupAPath, "Memory Lane", "Source drive");
    const otherCopyRoot = path.join(backupBPath, "Memory Lane", "Source drive");
    await expect(access(path.join(copyRoot, "a-small.png"))).resolves.toBeUndefined();
    await expect(access(path.join(otherCopyRoot, "b-large.bin"))).resolves.toBeUndefined();
    await expect(access(path.join(sourcePath, "a-small.png"))).resolves.toBeUndefined();
    await expect(access(path.join(sourcePath, "b-large.bin"))).resolves.toBeUndefined();
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
