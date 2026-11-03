import { createHash } from "node:crypto";
import { link, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type {
  DuplicateCleanupFile,
  DuplicateCleanupGroup,
  DuplicateCleanupPlan,
} from "@shared/contracts/health";
import { createFileHasher } from "../../scanning/infrastructure/file-hasher";
import { QuarantineMover } from "./quarantine-mover";

const temporaryDirectories: string[] = [];

async function createRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-cleanup-"));
  temporaryDirectories.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function sha(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

function cleanupFile(filePath: string, size: number, fileId = 1): DuplicateCleanupFile {
  return {
    fileId,
    name: path.basename(filePath),
    path: filePath,
    sizeBytes: size,
    createdAtFs: "2020-01-01T00:00:00.000Z",
    modifiedAtFs: "2020-01-01T00:00:00.000Z",
  };
}

function groupWith(
  keeperPath: string,
  candidatePath: string,
  hash: string,
  size: number,
): DuplicateCleanupGroup {
  return {
    groupId: 7,
    sha256: hash,
    keeper: cleanupFile(keeperPath, size, 1),
    candidates: [cleanupFile(candidatePath, size, 2)],
    excessBytes: size,
  };
}

function planFor(root: string, group: DuplicateCleanupGroup): DuplicateCleanupPlan {
  return {
    rootPath: root,
    keeperRule: "oldest-created-then-shorter-path",
    summary: {
      totalGroups: 1,
      totalFiles: 2,
      totalDuplicateBytes: group.excessBytes * 2,
      eligibleGroups: 1,
      skippedGroups: 0,
      groupsWithoutCoverage: 0,
      filesToMove: 1,
      bytesToMove: group.excessBytes,
      keepers: 1,
      skipCounts: {
        notAGroup: 0,
        empty: 0,
        belowMinimumSize: 0,
        candidateDateOverride: 0,
        multipleDateOverrides: 0,
        hardLink: 0,
      },
      minimumFileSizeBytes: 1024,
      rootPath: root,
      quarantineRoot: path.join(root, ".memorylane_quarantine"),
    },
    groups: [group],
  };
}

async function prepare(
  mover: QuarantineMover,
  root: string,
  group: DuplicateCleanupGroup,
): Promise<{ quarantinePath: string; journalPath: string }> {
  const quarantinePath = path.join(root, ".memorylane_quarantine", "run-1");
  const journalPath = path.join(quarantinePath, "journal.jsonl");
  await mover.prepare({
    plan: planFor(root, group),
    runId: 12,
    quarantinePath,
    journalPath,
    startedAt: "2026-11-02T12:00:00.000Z",
  });
  return { quarantinePath, journalPath };
}

describe("quarantine mover", () => {
  it("[ML-SAFE-002] [ML-QUAR-011] [ML-REL-002] moves a verified candidate into the quarantine run folder", async () => {
    const root = await createRoot();
    const content = Buffer.alloc(2048, 7);
    const keeperPath = path.join(root, "keep", "photo.jpg");
    const candidatePath = path.join(root, "phone", "photo.jpg");
    await mkdir(path.dirname(keeperPath), { recursive: true });
    await mkdir(path.dirname(candidatePath), { recursive: true });
    await writeFile(keeperPath, content);
    await writeFile(candidatePath, content);
    const hash = sha(content);
    const group = groupWith(keeperPath, candidatePath, hash, content.length);
    const mover = new QuarantineMover(createFileHasher());
    const { quarantinePath, journalPath } = await prepare(mover, root, group);

    const result = await mover.move({
      group,
      candidate: group.candidates[0] as DuplicateCleanupFile,
      runRootPath: root,
      quarantinePath,
      movedAt: "2026-11-02T12:00:01.000Z",
    });

    expect(result.skipReason).toBeNull();
    expect(result.move?.quarantinePath).toBe(path.join(quarantinePath, "phone", "photo.jpg"));
    await expect(stat(candidatePath)).rejects.toBeDefined();
    expect((await readFile(path.join(quarantinePath, "phone", "photo.jpg"))).length).toBe(2048);
    const journal = await readFile(journalPath, "utf8");
    expect(journal).toContain('"type":"file-moved"');
    expect(journal).toContain('"type":"run-started"');
    const manifest = JSON.parse(
      await readFile(path.join(quarantinePath, "manifest.json"), "utf8"),
    ) as { runId?: number; groups: unknown[] };
    expect(manifest.groups).toHaveLength(1);
  });

  it("uses a unique destination when the quarantine path already exists", async () => {
    const root = await createRoot();
    const content = Buffer.alloc(1024, 3);
    const keeperPath = path.join(root, "keep", "clip.mp4");
    const candidatePath = path.join(root, "phone", "clip.mp4");
    const destination = path.join(root, ".memorylane_quarantine", "run-1", "phone", "clip.mp4");
    await mkdir(path.dirname(keeperPath), { recursive: true });
    await mkdir(path.dirname(candidatePath), { recursive: true });
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(keeperPath, content);
    await writeFile(candidatePath, content);
    await writeFile(destination, "existing");
    const group = groupWith(keeperPath, candidatePath, sha(content), content.length);
    const mover = new QuarantineMover(createFileHasher());
    const { quarantinePath } = await prepare(mover, root, group);

    const result = await mover.move({
      group,
      candidate: group.candidates[0] as DuplicateCleanupFile,
      runRootPath: root,
      quarantinePath,
      movedAt: "2026-11-02T12:00:01.000Z",
    });

    expect(result.move?.quarantinePath).toBe(path.join(quarantinePath, "phone", "clip.1.mp4"));
  });

  it("[ML-QUAR-008] [ML-REL-002] restores a file when the quarantined copy fails verification", async () => {
    const root = await createRoot();
    const content = Buffer.alloc(2048, 4);
    const keeperPath = path.join(root, "keep", "photo.jpg");
    const candidatePath = path.join(root, "phone", "photo.jpg");
    await mkdir(path.dirname(keeperPath), { recursive: true });
    await mkdir(path.dirname(candidatePath), { recursive: true });
    await writeFile(keeperPath, content);
    await writeFile(candidatePath, content);
    const realHasher = createFileHasher();
    const hasher = {
      hash: (filePath: string): Promise<string> =>
        filePath.includes(".memorylane_quarantine")
          ? Promise.resolve("0".repeat(64))
          : realHasher.hash(filePath),
    };
    const group = groupWith(keeperPath, candidatePath, sha(content), content.length);
    const mover = new QuarantineMover(hasher);
    const { quarantinePath, journalPath } = await prepare(mover, root, group);

    const result = await mover.move({
      group,
      candidate: group.candidates[0] as DuplicateCleanupFile,
      runRootPath: root,
      quarantinePath,
      movedAt: "2026-11-02T12:00:01.000Z",
    });

    expect(result).toEqual({ move: null, skipReason: "destination-hash-mismatch" });
    expect((await readFile(candidatePath)).length).toBe(2048);
    await expect(stat(path.join(quarantinePath, "phone", "photo.jpg"))).rejects.toBeDefined();
    const journal = await readFile(journalPath, "utf8");
    expect(journal).toContain('"type":"file-restored"');
    expect(journal).toContain('"reason":"destination-hash-mismatch"');
  });

  it("[ML-QUAR-010] skips changed, missing, hard-linked, and outside-root candidates", async () => {
    const root = await createRoot();
    const content = Buffer.alloc(2048, 9);
    const keeperPath = path.join(root, "keep", "photo.jpg");
    await mkdir(path.dirname(keeperPath), { recursive: true });
    await writeFile(keeperPath, content);
    const mover = new QuarantineMover(createFileHasher());

    const changedPath = path.join(root, "phone", "changed.jpg");
    await mkdir(path.dirname(changedPath), { recursive: true });
    await writeFile(changedPath, Buffer.alloc(2048, 1));
    const changedGroup = groupWith(keeperPath, changedPath, sha(content), content.length);
    const prepared = await prepare(mover, root, changedGroup);
    expect(
      (
        await mover.move({
          group: changedGroup,
          candidate: changedGroup.candidates[0] as DuplicateCleanupFile,
          runRootPath: root,
          quarantinePath: prepared.quarantinePath,
          movedAt: "2026-11-02T12:00:01.000Z",
        })
      ).skipReason,
    ).toBe("changed");

    const missingGroup = groupWith(keeperPath, path.join(root, "gone.jpg"), sha(content), 2048);
    expect(
      (
        await mover.move({
          group: missingGroup,
          candidate: missingGroup.candidates[0] as DuplicateCleanupFile,
          runRootPath: root,
          quarantinePath: prepared.quarantinePath,
          movedAt: "2026-11-02T12:00:02.000Z",
        })
      ).skipReason,
    ).toBe("missing");

    const hardPath = path.join(root, "phone", "hard.jpg");
    await link(changedPath, hardPath);
    const hardGroup = groupWith(keeperPath, hardPath, sha(content), 2048);
    expect(
      (
        await mover.move({
          group: hardGroup,
          candidate: hardGroup.candidates[0] as DuplicateCleanupFile,
          runRootPath: root,
          quarantinePath: prepared.quarantinePath,
          movedAt: "2026-11-02T12:00:03.000Z",
        })
      ).skipReason,
    ).toBe("hard-link");

    const outsideGroup = groupWith(
      keeperPath,
      path.join(os.tmpdir(), "outside.jpg"),
      sha(content),
      2048,
    );
    expect(
      (
        await mover.move({
          group: outsideGroup,
          candidate: outsideGroup.candidates[0] as DuplicateCleanupFile,
          runRootPath: root,
          quarantinePath: prepared.quarantinePath,
          movedAt: "2026-11-02T12:00:04.000Z",
        })
      ).skipReason,
    ).toBe("outside-root");
  });

  it("[ML-QUAR-010] rejects a quarantine path outside the catalog root", async () => {
    const root = await createRoot();
    const group = groupWith(
      path.join(root, "a.jpg"),
      path.join(root, "b.jpg"),
      "a".repeat(64),
      1024,
    );
    const mover = new QuarantineMover(createFileHasher());
    await expect(
      mover.prepare({
        plan: planFor(root, group),
        runId: 1,
        quarantinePath: path.join(os.tmpdir(), "elsewhere"),
        journalPath: path.join(os.tmpdir(), "elsewhere", "journal.jsonl"),
        startedAt: "2026-11-02T12:00:00.000Z",
      }),
    ).rejects.toBeDefined();
  });
});
