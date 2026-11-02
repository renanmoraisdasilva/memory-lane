import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { catalogMigrations } from "../migrations/catalog-migrations";
import { runMigrations } from "../migrations/runner";
import {
  catalogRootPath,
  listSourceFiles,
  saveSourceHash,
  toSourceRelativePath,
} from "./replication-source-repository";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("replication source repository", () => {
  it("lists source-relative files and persists observed source hashes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-source-repository-"));
    roots.push(root);
    const catalogPath = path.join(root, ".memorylane", "catalog.db");
    const db = new Database(":memory:");
    runMigrations(db, catalogMigrations);
    const now = "2026-11-01T12:00:00.000Z";
    const a = path.join(root, "photos", "a.jpg");
    db.prepare(
      `INSERT INTO files (id, path, name, size, state, last_seen_at, modified_at_fs)
       VALUES (1, ?, 'a.jpg', 10, 'present', ?, ?)`,
    ).run(a, now, now);
    db.prepare(
      `INSERT INTO files (id, path, name, size, state, last_seen_at)
       VALUES (2, ?, 'b.jpg', 20, 'missing', ?)`,
    ).run(path.join(root, "photos", "b.jpg"), now);
    db.prepare(
      `INSERT INTO hashes (file_id, sha256, hashed_at, status, source_size_at_hash, source_modified_at_fs_at_hash)
       VALUES (1, ?, ?, 'complete', 10, ?)`,
    ).run("a".repeat(64), now, now);

    expect(catalogRootPath(catalogPath)).toBe(root);
    expect(toSourceRelativePath(catalogPath, a)).toBe(path.join("photos", "a.jpg"));
    expect(listSourceFiles(db, catalogPath)).toEqual([
      expect.objectContaining({
        id: 1,
        sourceRelativePath: path.join("photos", "a.jpg"),
        sha256: "a".repeat(64),
        sourceSizeAtHash: 10,
        hashedAt: now,
      }),
      expect.objectContaining({
        id: 2,
        state: "missing",
        sha256: null,
      }),
    ]);

    saveSourceHash(db, {
      fileId: 2,
      sha256: "b".repeat(64),
      size: 20,
      modifiedAtFs: now,
      now,
    });
    saveSourceHash(db, {
      fileId: 2,
      sha256: "c".repeat(64),
      size: 20,
      modifiedAtFs: now,
      now,
    });
    expect(
      db.prepare("SELECT sha256, source_size_at_hash FROM hashes WHERE file_id = 2").get(),
    ).toEqual({ sha256: "c".repeat(64), source_size_at_hash: 20 });

    expect(() => toSourceRelativePath(catalogPath, path.join(root, "..", "outside.jpg"))).toThrow();
    db.close();
  });
});
