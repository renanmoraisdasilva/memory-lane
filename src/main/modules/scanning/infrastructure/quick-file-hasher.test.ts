import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { QUICK_HASH_ALGORITHM } from "@shared/domain/hashing";
import { createQuickFileHasher } from "./quick-file-hasher";

const roots: string[] = [];

async function createFile(contents: Buffer): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-quick-hash-"));
  roots.push(root);
  const filePath = path.join(root, "sample.bin");
  await writeFile(filePath, contents);
  return filePath;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("quick file hasher", () => {
  it("[ML-SCAN-010] hashes the head, middle, and tail deterministically", async () => {
    const contents = Buffer.alloc(128);
    for (let index = 0; index < contents.length; index += 1) {
      contents[index] = index;
    }
    const filePath = await createFile(contents);
    const hasher = createQuickFileHasher();

    const first = await hasher.hash(filePath, contents.length, 16);
    const second = await hasher.hash(filePath, contents.length, 16);

    expect(first).toEqual(second);
    expect(first.algorithm).toBe(QUICK_HASH_ALGORITHM);
    expect(first.sampleBytes).toBe(16);
    expect(first.digest).toHaveLength(64);
  });

  it("changes when a sampled region changes", async () => {
    const contents = Buffer.alloc(128, 1);
    const filePath = await createFile(contents);
    const hasher = createQuickFileHasher();
    const before = await hasher.hash(filePath, contents.length, 16);

    const headChanged = Buffer.from(contents);
    headChanged[0] = 9;
    await writeFile(filePath, headChanged);
    const afterHead = await hasher.hash(filePath, contents.length, 16);
    expect(afterHead.digest).not.toBe(before.digest);

    const middleChanged = Buffer.from(contents);
    middleChanged[64] = 9;
    await writeFile(filePath, middleChanged);
    const afterMiddle = await hasher.hash(filePath, contents.length, 16);
    expect(afterMiddle.digest).not.toBe(before.digest);

    const tailChanged = Buffer.from(contents);
    tailChanged[127] = 9;
    await writeFile(filePath, tailChanged);
    const afterTail = await hasher.hash(filePath, contents.length, 16);
    expect(afterTail.digest).not.toBe(before.digest);
  });

  it("handles files smaller than the requested sample", async () => {
    const filePath = await createFile(Buffer.from("tiny"));
    const result = await createQuickFileHasher().hash(filePath, 4, 16);
    expect(result.digest).toHaveLength(64);
    expect(result.sampleBytes).toBe(16);
  });
});
