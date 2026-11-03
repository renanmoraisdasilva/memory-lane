import type * as FsPromises from "node:fs/promises";
import { mkdtemp, open, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof FsPromises>();
  return { ...actual, open: vi.fn(actual.open) };
});

import { createQuickFileHasher } from "./quick-file-hasher";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("quick file hasher read-only access [ML-SAFE-003]", () => {
  it("[ML-SAFE-003] opens the source file with the read-only flag", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-read-only-"));
    roots.push(root);
    const filePath = path.join(root, "sample.bin");
    await writeFile(filePath, Buffer.from("read me"));

    await createQuickFileHasher().hash(filePath, 7, 4);

    expect(vi.mocked(open)).toHaveBeenCalledWith(filePath, "r");
  });
});
