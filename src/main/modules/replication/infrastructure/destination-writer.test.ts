import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AppError } from "@shared/domain/errors";
import { createDestinationWriter } from "./destination-writer";

const roots: string[] = [];

async function createRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-writer-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("destination writer", () => {
  it("writes text and temp files only inside the destination root", async () => {
    const root = await createRoot();
    const writer = createDestinationWriter(root);

    await writer.writeText("Memory Lane\\4TB Archive\\.memorylane\\marker.json", '{"ok":true}');
    expect(
      await readFile(
        path.join(root, "Memory Lane", "4TB Archive", ".memorylane", "marker.json"),
        "utf8",
      ),
    ).toBe('{"ok":true}');

    const temp = await writer.createTemp("Memory Lane\\4TB Archive\\photos\\a.jpg");
    await new Promise<void>((resolve, reject) => {
      temp.stream.on("error", reject);
      temp.stream.end("photo", () => resolve());
    });
    await writer.renameTemp(temp.relativePath, "Memory Lane\\4TB Archive\\photos\\a.jpg");
    expect(
      await readFile(path.join(root, "Memory Lane", "4TB Archive", "photos", "a.jpg"), "utf8"),
    ).toBe("photo");
  });

  it("rejects traversal, absolute paths, and non-temp cleanup", async () => {
    const root = await createRoot();
    const writer = createDestinationWriter(root);

    await expect(writer.writeText("..\\outside.txt", "no")).rejects.toBeInstanceOf(AppError);
    await expect(writer.writeText("C:\\outside.txt", "no")).rejects.toBeInstanceOf(AppError);
    await expect(writer.renameTemp("photos\\a.jpg", "photos\\b.jpg")).rejects.toBeInstanceOf(
      AppError,
    );
    await expect(writer.removeTemp("photos\\a.jpg")).rejects.toBeInstanceOf(AppError);
  });

  it("removes only empty directories it is asked to remove", async () => {
    const root = await createRoot();
    const writer = createDestinationWriter(root);
    await writer.mkdir("empty");
    await writer.removeEmptyDirectory("empty");
    await expect(readFile(path.join(root, "empty", "x"), "utf8")).rejects.toThrow();

    await mkdir(path.join(root, "full"), { recursive: true });
    await writeFile(path.join(root, "full", "x"), "x");
    await writer.removeEmptyDirectory("full");
    expect(await readFile(path.join(root, "full", "x"), "utf8")).toBe("x");
  });

  it("rejects a symlink that escapes the destination root", async () => {
    const root = await createRoot();
    const outside = await createRoot();
    const writer = createDestinationWriter(root);
    const link = path.join(root, "escape");
    try {
      await symlink(outside, link, "junction");
    } catch {
      return;
    }
    await expect(writer.writeText("escape\\a.txt", "no")).rejects.toBeInstanceOf(AppError);
  });

  it.skipIf(process.platform !== "win32")(
    "accepts an existing drive root without trying to mkdir it",
    async () => {
      const driveRoot = path.parse(process.cwd()).root;
      const writer = createDestinationWriter(driveRoot);
      await expect(writer.freeBytes()).resolves.toBeGreaterThan(0);
    },
  );
});
