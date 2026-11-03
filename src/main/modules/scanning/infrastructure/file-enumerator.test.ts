import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AppError } from "@shared/domain/errors";
import type { ScannedFile } from "../domain/scan-files";
import { enumerateFiles } from "./file-enumerator";

const temporaryDirectories: string[] = [];

async function createTempDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "memory-lane-enumerator-"));
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

describe("file enumerator", () => {
  it("[ML-SAFE-009] walks nested folders, batches files, and skips app-managed and system folders", async () => {
    const root = await createTempDirectory();
    await mkdir(path.join(root, "nested"), { recursive: true });
    await mkdir(path.join(root, ".memorylane", "cache"), { recursive: true });
    await mkdir(path.join(root, ".memorylane_quarantine", "run-1"), { recursive: true });
    await mkdir(path.join(root, "System Volume Information"), { recursive: true });
    await writeFile(path.join(root, "photo.jpg"), "image");
    await writeFile(path.join(root, "nested", "notes.txt"), "text");
    await writeFile(path.join(root, ".memorylane", "catalog.db"), "db");
    await writeFile(path.join(root, ".memorylane_quarantine", "run-1", "moved.jpg"), "moved");
    await writeFile(path.join(root, "System Volume Information", "index"), "system");

    const batches: ScannedFile[][] = [];
    const result = await enumerateFiles(
      root,
      async (files) => {
        batches.push(files);
      },
      { batchSize: 1 },
    );

    const paths = batches.flat().map((file) => path.relative(root, file.path));
    expect(result).toEqual({ fileCount: 2, hadErrors: false });
    expect(paths.sort()).toEqual([path.join("nested", "notes.txt"), "photo.jpg"]);
    expect(batches).toHaveLength(2);
    expect(batches.flat().find((file) => file.name === "photo.jpg")).toMatchObject({
      mediaClass: "image",
      linkCount: 1,
    });
  });

  it("rejects a missing scan root", async () => {
    await expect(
      enumerateFiles(path.join(os.tmpdir(), "memory-lane-missing-root"), async () => undefined),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("rejects a file used as the scan root", async () => {
    const root = await createTempDirectory();
    const filePath = path.join(root, "not-a-directory");
    await writeFile(filePath, "x");

    await expect(enumerateFiles(filePath, async () => undefined)).rejects.toBeInstanceOf(AppError);
  });
});
