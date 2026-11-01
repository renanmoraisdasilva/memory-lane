import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { CATALOG_SCHEMA_VERSION } from "../schema-version";
import { catalogMigrations } from "../migrations/catalog-migrations";
import { runMigrations } from "../migrations/runner";
import { ensureDriveIdentity } from "./catalog-repository";
import {
  getDestinationLibraryContext,
  resolveDestinationCacheEntry,
  resolveDestinationMediaFile,
  saveDestinationPreview,
  saveDestinationThumbnail,
} from "./destination-library-media-repository";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function createDb(): Database.Database {
  const db = new Database(":memory:");
  runMigrations(db, catalogMigrations);
  ensureDriveIdentity(
    db,
    {
      volumeId: toVolumeId("volume-dest"),
      serialNumber: "SERIAL",
      label: "Backup A",
      fileSystem: "NTFS",
      rootPath: "F:\\",
      letter: "F:",
    },
    CATALOG_SCHEMA_VERSION,
  );
  return db;
}

describe("destination library media repository", () => {
  it("resolves relative media paths and cache entries", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-media-repo-"));
    roots.push(root);
    const db = createDb();
    const file = db
      .prepare(
        `INSERT INTO files (
           path, relative_path, name, size, state, last_seen_at, media_class, mime
         ) VALUES (?, 'photos\\a.jpg', 'a.jpg', 10, 'present', ?, 'image', 'image/jpeg')
         RETURNING id`,
      )
      .get(path.join(root, "photos", "a.jpg"), "2026-11-01T12:00:00.000Z") as { id: number };
    db.prepare(
      `INSERT INTO cache_entries (file_id, kind, path, bytes, generated_at, status)
       VALUES (?, 'thumbnail', ?, 4, ?, 'ready')`,
    ).run(
      file.id,
      path.join(root, ".memorylane", "cache", "thumbs", `${String(file.id)}.jpg`),
      "2026-11-01T12:00:00.000Z",
    );

    expect(resolveDestinationMediaFile(db, root, file.id)).toMatchObject({
      fileId: file.id,
      path: path.join(root, "photos", "a.jpg"),
      mime: "image/jpeg",
      mediaClass: "image",
    });
    expect(resolveDestinationMediaFile(db, root, 999)).toBeNull();
    const other = db
      .prepare(
        `INSERT INTO files (path, relative_path, name, size, state, last_seen_at, media_class)
         VALUES (?, 'notes.txt', 'notes.txt', 5, 'present', ?, 'other') RETURNING id`,
      )
      .get(path.join(root, "notes.txt"), "2026-11-01T12:00:00.000Z") as { id: number };
    expect(resolveDestinationMediaFile(db, root, other.id)).toBeNull();
    const hinted = db
      .prepare(
        `INSERT INTO files (path, relative_path, name, size, state, last_seen_at, media_class)
         VALUES (?, NULL, 'hint.jpg', 5, 'present', ?, 'image') RETURNING id`,
      )
      .get(path.join(root, "hint.jpg"), "2026-11-01T12:00:00.000Z") as { id: number };
    expect(resolveDestinationMediaFile(db, root, hinted.id)?.path).toBe(
      path.join(root, "hint.jpg"),
    );
    db.prepare(
      `INSERT INTO cache_entries (file_id, kind, path, bytes, generated_at, status)
       VALUES (?, 'thumbnail', ?, 4, ?, 'ready')`,
    ).run(
      hinted.id,
      path.join(root, ".memorylane", "cache", "thumbs", "hint.jpg"),
      "2026-11-01T12:00:00.000Z",
    );
    expect(resolveDestinationCacheEntry(db, root, hinted.id, "thumbnail")?.sourcePath).toBe(
      path.join(root, "hint.jpg"),
    );
    expect(resolveDestinationCacheEntry(db, root, 999, "thumbnail")).toBeNull();
    expect(resolveDestinationCacheEntry(db, root, file.id, "thumbnail")).toMatchObject({
      fileId: file.id,
      sourcePath: path.join(root, "photos", "a.jpg"),
      status: "ready",
    });
    expect(resolveDestinationCacheEntry(db, root, file.id, "preview")).toMatchObject({
      status: "pending",
    });
    expect(
      getDestinationLibraryContext(db, path.join(root, ".memorylane", "catalog.db")),
    ).toMatchObject({
      driveLabel: "Backup A",
      cachePath: path.join(root, ".memorylane", "cache"),
    });

    saveDestinationThumbnail(db, {
      fileId: file.id,
      path: path.join(root, ".memorylane", "cache", "thumbs", "new.jpg"),
      bytes: 8,
      status: "ready",
      now: "2026-11-02T12:00:00.000Z",
    });
    saveDestinationPreview(db, {
      fileId: file.id,
      path: "",
      bytes: 0,
      status: "failed",
      now: "2026-11-02T12:00:00.000Z",
    });
    expect(resolveDestinationCacheEntry(db, root, file.id, "thumbnail")).toMatchObject({
      cachePath: path.join(root, ".memorylane", "cache", "thumbs", "new.jpg"),
      status: "ready",
    });
    expect(resolveDestinationCacheEntry(db, root, file.id, "preview")).toMatchObject({
      status: "failed",
    });
    db.close();
  });

  it("rejects a relative path that escapes the destination root", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-media-repo-"));
    roots.push(root);
    const db = createDb();
    const file = db
      .prepare(
        `INSERT INTO files (
           path, relative_path, name, size, state, last_seen_at, media_class
         ) VALUES ('F:\\escape.jpg', '..\\escape.jpg', 'escape.jpg', 10, 'present', ?, 'image')`,
      )
      .run("2026-11-01T12:00:00.000Z") as { lastInsertRowid: number | bigint };
    expect(() => resolveDestinationMediaFile(db, root, Number(file.lastInsertRowid))).toThrow();
    db.close();
  });
});
