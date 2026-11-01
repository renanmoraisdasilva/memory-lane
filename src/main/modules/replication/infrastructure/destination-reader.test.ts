import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDestinationReader } from "./destination-reader";

const roots: string[] = [];

async function createRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-reader-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("destination reader", () => {
  it("finds regular files and skips Memory Lane internals and filesystem metadata", async () => {
    const root = await createRoot();
    await mkdir(path.join(root, "photos"), { recursive: true });
    await mkdir(path.join(root, ".memorylane", "replicas", "catalog"), { recursive: true });
    await mkdir(path.join(root, ".memorylane", "cache"), { recursive: true });
    await mkdir(path.join(root, "$RECYCLE.BIN"), { recursive: true });
    await mkdir(path.join(root, "System Volume Information"), { recursive: true });
    await writeFile(path.join(root, "photos", "a.jpg"), "photo");
    await writeFile(path.join(root, ".memorylane", "catalog.db"), "catalog");
    await writeFile(path.join(root, ".memorylane", "replicas", "catalog", "index.db"), "index");
    await writeFile(path.join(root, ".memorylane", "cache", "thumb.jpg"), "thumb");
    await writeFile(path.join(root, ".memorylane-tmp-abc"), "temp");
    await writeFile(path.join(root, "$RECYCLE.BIN", "old.bin"), "recycled");
    await writeFile(path.join(root, "System Volume Information", "meta.bin"), "meta");

    const scan = await createDestinationReader().scan(root);
    expect(scan.files.map((file) => file.relativePath)).toEqual([path.join("photos", "a.jpg")]);
    expect(scan.files[0]).toMatchObject({
      name: "a.jpg",
      size: 5,
    });
    expect(scan.files[0]?.absolutePath).toBe(path.join(root, "photos", "a.jpg"));
    expect(scan.files[0]?.modifiedAtFs).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(scan.skipped).toEqual([]);
  });
});
