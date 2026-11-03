import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { catalogMigrations } from "../migrations/catalog-migrations";
import { runMigrations } from "../migrations/runner";
import {
  getDestinationLibraryStats,
  upsertDestinationLibraryFiles,
} from "./replication-destination-library-repository";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("replication destination library repository", () => {
  it("[ML-REPL-015] [ML-REPL-025] [ML-REPL-077] upserts files, tracks missing files, and rejects escaped paths", async () => {
    const db = new Database(":memory:");
    runMigrations(db, catalogMigrations);
    const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-destination-library-"));
    roots.push(root);

    upsertDestinationLibraryFiles(db, {
      destinationRoot: root,
      runStartedAt: "2026-11-01T12:00:00.000Z",
      now: "2026-11-01T12:00:00.000Z",
      files: [
        {
          relativePath: "photos\\a.jpg",
          name: "a.jpg",
          sizeBytes: 10,
          modifiedAtFs: "2026-11-01T12:00:00.000Z",
          mediaClass: "image",
          sha256: "a".repeat(64),
          resolvedDate: "2011-01-01T00:00:00.000Z",
        },
        {
          relativePath: "README",
          name: "README",
          sizeBytes: 5,
          modifiedAtFs: null,
          mediaClass: "other",
          sha256: null,
          resolvedDate: null,
        },
      ],
    });
    expect(getDestinationLibraryStats(db)).toEqual({ files: 2, bytes: 15 });

    upsertDestinationLibraryFiles(db, {
      destinationRoot: root,
      runStartedAt: "2026-11-02T12:00:00.000Z",
      now: "2026-11-02T12:00:00.000Z",
      files: [],
    });
    expect(getDestinationLibraryStats(db)).toEqual({ files: 0, bytes: 0 });
    expect(
      db.prepare("SELECT state, missing_since FROM files WHERE name = 'README'").get(),
    ).toMatchObject({ state: "missing" });

    expect(() =>
      upsertDestinationLibraryFiles(db, {
        destinationRoot: root,
        runStartedAt: "2026-11-03T12:00:00.000Z",
        now: "2026-11-03T12:00:00.000Z",
        files: [
          {
            relativePath: "..\\escape.jpg",
            name: "escape.jpg",
            sizeBytes: 1,
            modifiedAtFs: null,
            mediaClass: "image",
            sha256: null,
            resolvedDate: null,
          },
        ],
      }),
    ).toThrow();
    db.close();
  });
});
