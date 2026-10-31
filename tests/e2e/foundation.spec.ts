import { mkdir, mkdtemp, rm, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { _electron as electron } from "playwright";

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
});

test.afterAll(async () => {
  await rm(path.dirname(userDataPath), { recursive: true, force: true });
});

test("creates a catalog from a development drive", async () => {
  test.setTimeout(60_000);

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
    await expect(page.getByRole("heading", { name: /Your archive/ })).toBeVisible();
    await expect(page.getByText("Development drive").first()).toBeVisible();

    const developmentDriveCard = page.getByRole("article").filter({ hasText: "Development drive" });
    await developmentDriveCard.getByRole("button", { name: /Create catalog/i }).click();

    const catalogPath = path.join(developmentDrivePath, ".memorylane", "catalog.db");
    await expect(page.getByText(catalogPath)).toBeVisible();
    await expect(access(catalogPath)).resolves.toBeUndefined();
  } finally {
    await app.close();
  }
});
