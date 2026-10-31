import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { acquireCatalogLock } from "./catalog-lock";

const temporaryDirectories: string[] = [];

async function createTempDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "memory-lane-lock-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("catalog lock", () => {
  it("acquires and releases the lock", async () => {
    const directory = await createTempDirectory();
    const release = acquireCatalogLock(directory);

    await expect(access(path.join(directory, "catalog.lock"))).resolves.toBeUndefined();
    release();
    await expect(access(path.join(directory, "catalog.lock"))).rejects.toBeDefined();
  });

  it("rejects a second lock held by a live process", async () => {
    const directory = await createTempDirectory();
    const release = acquireCatalogLock(directory);

    expect(() => acquireCatalogLock(directory)).toThrow(AppError);
    try {
      acquireCatalogLock(directory);
    } catch (error) {
      expect((error as AppError).code).toBe(APP_ERROR_CODES.CATALOG_LOCKED);
    }
    release();
  });

  it("replaces a stale lock", async () => {
    const directory = await createTempDirectory();
    await writeFile(
      path.join(directory, "catalog.lock"),
      JSON.stringify({ pid: 999999, startedAt: "2026-01-01T00:00:00.000Z" }),
    );

    const release = acquireCatalogLock(directory);
    release();
  });

  it("replaces a malformed lock", async () => {
    const directory = await createTempDirectory();
    await writeFile(path.join(directory, "catalog.lock"), "not-json");

    const release = acquireCatalogLock(directory);
    release();
  });

  it("ignores a second release", async () => {
    const directory = await createTempDirectory();
    const release = acquireCatalogLock(directory);

    release();
    expect(() => release()).not.toThrow();
  });
});
