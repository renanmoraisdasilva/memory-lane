import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createFileHasher } from "./file-hasher";

const temporaryDirectories: string[] = [];

async function createTempDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "memory-lane-hash-"));
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

describe("file hasher", () => {
  it("calculates a SHA-256 digest", async () => {
    const directory = await createTempDirectory();
    const filePath = path.join(directory, "hello.txt");
    await writeFile(filePath, "hello");

    await expect(createFileHasher().hash(filePath)).resolves.toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("rejects a missing file", async () => {
    await expect(
      createFileHasher().hash(path.join(os.tmpdir(), "missing-ml-file")),
    ).rejects.toThrow();
  });
});
