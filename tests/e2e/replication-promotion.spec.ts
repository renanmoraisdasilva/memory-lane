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

test("completes a full copy and promotes it to the source archive", async () => {
  test.setTimeout(240_000);
  const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-promotion-e2e-"));
  const userDataPath = path.join(root, "user-data");
  const sourcePath = path.join(root, "source-drive");
  const fullPath = path.join(root, "backup-full");
  await Promise.all([
    mkdir(userDataPath, { recursive: true }),
    mkdir(sourcePath, { recursive: true }),
    mkdir(fullPath, { recursive: true }),
  ]);
  await writeFile(path.join(sourcePath, "a-small.png"), ONE_PIXEL_PNG);
  await writeFile(path.join(sourcePath, "b-large.bin"), Buffer.alloc(1024 * 1024, 7));

  const app = await electron.launch({
    args: ["."],
    cwd: process.cwd(),
    env: {
      ...childEnvironment(),
      MEMORY_LANE_USER_DATA: userDataPath,
      MEMORY_LANE_DEV_DRIVES: JSON.stringify([
        { path: sourcePath, label: "Source drive", serial: "e2e-promote-source" },
        { path: fullPath, label: "Backup Full", serial: "e2e-promote-full" },
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
    const drawer = page.getByRole("dialog", { name: "Add a backup destination" });
    await drawer.getByRole("button", { name: /Backup Full/ }).click();
    await drawer.getByLabel("Goal").click();
    await page.getByRole("option", { name: /Full copy/ }).click();
    await drawer.getByLabel("Safety reserve (GB)").fill("0");
    await drawer.getByRole("button", { name: "Add and adopt" }).click();
    await expect(page.getByRole("link").filter({ hasText: "Backup Full" })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("link").filter({ hasText: "Backup Full" }).click();
    await expect(page.getByText("Adoption complete")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("link", { name: "Review backup plan" }).click();
    await expect(page.getByRole("heading", { name: "Backup plan" })).toBeVisible();
    await page.getByRole("button", { name: "Start backup" }).click();
    const startDialog = page.getByRole("dialog", { name: "Start backup" });
    await startDialog.getByLabel("Run scope").click();
    await page.getByRole("option", { name: "Full copy only" }).click();
    await startDialog.getByRole("button", { name: "Start backup" }).click();
    await expect(page.getByRole("heading", { name: "Backup run" })).toBeVisible();
    await expect(page.getByText("Completed", { exact: true })).toBeVisible({
      timeout: 120_000,
    });
    await page.waitForTimeout(300);

    await page.getByRole("link", { name: "Backup", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Backup destinations" })).toBeVisible();
    await page.getByRole("link", { name: "Review plan" }).click();
    await page.getByRole("link", { name: "Review promotion" }).click();
    await expect(page.getByRole("heading", { name: "Promote Backup Full" })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "Run verification" }).click();
    await expect(page.getByText("Verified", { exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page
      .getByRole("checkbox", { name: "I understand that this changes the active source archive." })
      .check();
    await page.getByRole("button", { name: "Promote to source" }).click();
    await expect(page.getByRole("heading", { name: "Promotion complete" })).toBeVisible({
      timeout: 60_000,
    });
    await page.getByRole("button", { name: "Open the new source" }).click();
    await expect(page.getByRole("heading", { name: "Memory Lane" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByRole("button", { name: /Open drive details for Backup Full/ }),
    ).toBeVisible();

    const copyRoot = path.join(fullPath, "Memory Lane", "Source drive");
    await expect(access(path.join(copyRoot, "a-small.png"))).resolves.toBeUndefined();
    await expect(access(path.join(copyRoot, "b-large.bin"))).resolves.toBeUndefined();
    await expect(access(path.join(sourcePath, "a-small.png"))).resolves.toBeUndefined();
    await expect(access(path.join(sourcePath, "b-large.bin"))).resolves.toBeUndefined();
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
