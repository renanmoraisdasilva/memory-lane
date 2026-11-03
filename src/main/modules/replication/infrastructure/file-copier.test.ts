import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDestinationWriter } from "./destination-writer";
import { copyVerifiedFile, type CopySourceExpectation } from "./file-copier";

const roots: string[] = [];

async function createRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  roots.push(root);
  return root;
}

async function sourceExpectation(
  filePath: string,
  sha256?: string | null,
): Promise<CopySourceExpectation> {
  const info = await lstat(filePath);
  return {
    absolutePath: filePath,
    sizeBytes: info.size,
    modifiedAtFs: info.mtime.toISOString(),
    sha256:
      sha256 === undefined
        ? createHash("sha256")
            .update(await readFile(filePath))
            .digest("hex")
        : sha256,
  };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("file copier", () => {
  it("[ML-REPL-068] [ML-REPL-070] streams, hashes, verifies, and renames a copy", async () => {
    const root = await createRoot("memory-lane-copy-");
    const sourcePath = path.join(root, "source.bin");
    const destinationRoot = path.join(root, "destination");
    await writeFile(sourcePath, "hello backup");
    const source = await sourceExpectation(sourcePath);
    const writer = createDestinationWriter(destinationRoot);

    const result = await copyVerifiedFile({
      source,
      writer,
      relativePath: "Memory Lane\\Archive\\source.bin",
      freeBytes: 1_000_000,
      reserveBytes: 0,
      allowReplace: false,
    });

    expect(result).toMatchObject({
      status: "verified",
      sizeBytes: 12,
      sha256: source.sha256,
    });
    await expect(
      readFile(path.join(destinationRoot, "Memory Lane", "Archive", "source.bin"), "utf8"),
    ).resolves.toBe("hello backup");
  });

  it("[ML-REPL-069] [ML-REPL-071] discards a temp file when the source hash changes", async () => {
    const root = await createRoot("memory-lane-copy-");
    const sourcePath = path.join(root, "source.bin");
    const destinationRoot = path.join(root, "destination");
    await writeFile(sourcePath, "hello backup");
    const source = await sourceExpectation(sourcePath, "a".repeat(64));
    const writer = createDestinationWriter(destinationRoot);

    const result = await copyVerifiedFile({
      source,
      writer,
      relativePath: "source.bin",
      freeBytes: 1_000_000,
      reserveBytes: 0,
      allowReplace: false,
    });
    expect(result).toMatchObject({ status: "source_changed" });
    await expect(readFile(path.join(destinationRoot, "source.bin"), "utf8")).rejects.toThrow();
    const remaining = await readdir(destinationRoot);
    expect(remaining.some((name) => name.startsWith(".memorylane-tmp-"))).toBe(false);
  });

  it("[ML-REPL-019] refuses to overwrite without replacement approval", async () => {
    const root = await createRoot("memory-lane-copy-");
    const sourcePath = path.join(root, "source.bin");
    const destinationRoot = path.join(root, "destination");
    await mkdir(destinationRoot, { recursive: true });
    await writeFile(sourcePath, "new");
    await writeFile(path.join(destinationRoot, "source.bin"), "old");
    const source = await sourceExpectation(sourcePath);
    const writer = createDestinationWriter(destinationRoot);

    expect(
      await copyVerifiedFile({
        source,
        writer,
        relativePath: "source.bin",
        freeBytes: 1_000_000,
        reserveBytes: 0,
        allowReplace: false,
      }),
    ).toMatchObject({ status: "conflict" });
    await expect(readFile(path.join(destinationRoot, "source.bin"), "utf8")).resolves.toBe("old");
  });

  it("[ML-REPL-019] replaces a previously approved stale copy", async () => {
    const root = await createRoot("memory-lane-copy-");
    const sourcePath = path.join(root, "source.bin");
    const destinationRoot = path.join(root, "destination");
    await mkdir(destinationRoot, { recursive: true });
    await writeFile(sourcePath, "new");
    await writeFile(path.join(destinationRoot, "source.bin"), "old");
    const source = await sourceExpectation(sourcePath);
    const writer = createDestinationWriter(destinationRoot);

    expect(
      await copyVerifiedFile({
        source,
        writer,
        relativePath: "source.bin",
        freeBytes: 1_000_000,
        reserveBytes: 0,
        allowReplace: true,
      }),
    ).toMatchObject({ status: "verified" });
    await expect(readFile(path.join(destinationRoot, "source.bin"), "utf8")).resolves.toBe("new");
  });

  it("[ML-REPL-073] rejects a copy without safe free space", async () => {
    const root = await createRoot("memory-lane-copy-");
    const sourcePath = path.join(root, "source.bin");
    const destinationRoot = path.join(root, "destination");
    await writeFile(sourcePath, "hello");
    const source = await sourceExpectation(sourcePath);
    const writer = createDestinationWriter(destinationRoot);

    expect(
      await copyVerifiedFile({
        source,
        writer,
        relativePath: "source.bin",
        freeBytes: 5,
        reserveBytes: 10,
        allowReplace: false,
      }),
    ).toMatchObject({ status: "insufficient_space" });
  });

  it("[ML-REPL-074] rejects a non-file destination target and an unreadable source", async () => {
    const root = await createRoot("memory-lane-copy-");
    const sourcePath = path.join(root, "source.bin");
    const destinationRoot = path.join(root, "destination");
    await writeFile(sourcePath, "hello");
    await mkdir(path.join(destinationRoot, "folder"), { recursive: true });
    const source = await sourceExpectation(sourcePath);
    const writer = createDestinationWriter(destinationRoot);

    expect(
      await copyVerifiedFile({
        source,
        writer,
        relativePath: "folder",
        freeBytes: 1_000_000,
        reserveBytes: 0,
        allowReplace: true,
      }),
    ).toMatchObject({ status: "conflict" });

    const missing = await copyVerifiedFile({
      source: { ...source, absolutePath: path.join(root, "missing.bin") },
      writer,
      relativePath: "missing.bin",
      freeBytes: 1_000_000,
      reserveBytes: 0,
      allowReplace: false,
    });
    expect(missing.status).toBe("failed");
    expect(missing).toMatchObject({ retryable: false });
  });
});
