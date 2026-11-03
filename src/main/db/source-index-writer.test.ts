import { access, mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { sourceIndexRelativePath, writeSourceIndex } from "./source-index-writer";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("source index writer", () => {
  it("[ML-REPL-027] writes a compact snapshot without WAL sidecars and replaces it atomically", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-source-index-"));
    roots.push(root);
    const relativePath = await writeSourceIndex({
      destinationRoot: root,
      catalogId: "catalog-1",
      sourceCatalogId: "catalog-1",
      sourceLabel: "4TB Archive",
      sourceRoot: "E:\\",
      generatedAt: "2026-11-01T12:00:00.000Z",
      files: [
        {
          fileId: 1,
          relativePath: "photos\\a.jpg",
          sizeBytes: 10,
          sha256: "a".repeat(64),
          resolvedDate: "2011-01-01T00:00:00.000Z",
          mediaClass: "image",
          replicaStatus: "verified",
          verifiedAt: "2026-11-01T12:00:00.000Z",
        },
      ],
    });
    expect(relativePath).toBe(sourceIndexRelativePath("catalog-1"));
    await expect(access(path.join(root, relativePath))).resolves.toBeUndefined();

    const index = new Database(path.join(root, relativePath), { readonly: true });
    expect(
      index
        .prepare("SELECT value FROM source_index_meta WHERE key = 'schema_version'")
        .pluck()
        .get(),
    ).toBe("1");
    expect(
      index.prepare("SELECT relative_path FROM source_files WHERE file_id = 1").pluck().get(),
    ).toBe("photos\\a.jpg");
    index.close();

    await writeSourceIndex({
      destinationRoot: root,
      catalogId: "catalog-1",
      sourceCatalogId: "catalog-1",
      sourceLabel: "4TB Archive",
      sourceRoot: "E:\\",
      generatedAt: "2026-11-02T12:00:00.000Z",
      files: [],
    });
    const rewritten = new Database(path.join(root, relativePath), { readonly: true });
    expect(rewritten.prepare("SELECT COUNT(*) FROM source_files").pluck().get()).toBe(0);
    rewritten.close();

    const files = await readdir(path.dirname(path.join(root, relativePath)));
    expect(files.filter((name) => name.includes("-wal") || name.includes("-shm"))).toEqual([]);
  });
});
