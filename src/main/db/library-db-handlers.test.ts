import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { createLibraryDbHandlers } from "./library-db-handlers";
import type { LibraryDbMethod } from "./library-worker-protocol";
import { catalogMigrations } from "./migrations/catalog-migrations";
import { runMigrations } from "./migrations/runner";
import { ensureDriveIdentity } from "./repositories/catalog-repository";

const volumeId = toVolumeId("volume-1");
const now = "2024-08-18T12:00:00.000Z";
const catalogPath = "C:\\archive\\.memorylane\\catalog.db";

function createHarness() {
  const db = new Database(":memory:");
  runMigrations(db, catalogMigrations);
  ensureDriveIdentity(
    db,
    {
      volumeId,
      serialNumber: "SERIAL",
      label: "Archive",
      fileSystem: "NTFS",
      rootPath: "C:\\",
      letter: "C:",
    },
    3,
  );
  const row = db
    .prepare(
      `INSERT INTO files (
        path, name, size, modified_at_fs, media_class, width, height, state, last_seen_at
      ) VALUES ('C:\\archive\\a.jpg', 'a.jpg', 100, ?, 'image', 10, 20, 'present', ?)
      RETURNING id`,
    )
    .get(now, now) as { id: number };
  db.prepare(
    `INSERT INTO file_dates (file_id, resolved_date, precision, source, confidence, original_value)
     VALUES (?, ?, 'exact', 'filesystem.created', 0.6, ?)`,
  ).run(row.id, now, now);
  db.prepare(
    `INSERT INTO scan_sessions (started_at, finished_at, state, mode, intensity)
     VALUES (?, ?, 'complete', 'initial', 'balanced')`,
  ).run(now, now);

  const handler = createLibraryDbHandlers({
    getCatalog: () => db,
    getCatalogPath: () => catalogPath,
  });
  return { db, handler, fileId: row.id };
}

describe("library DB handlers", () => {
  it("serves summary, default timeline, index, item, and context", () => {
    const { db, handler, fileId } = createHarness();

    expect(handler.handle("library.getSummary", {})).toMatchObject({ totalItems: 1 });
    expect(handler.handle("library.getTimeline", { filter: "all" })).toMatchObject({ total: 1 });
    expect(
      handler.handle("library.getTimeline", { filter: "all", cursor: undefined }),
    ).toMatchObject({ total: 1 });
    expect(handler.handle("library.getTimelineIndex", { filter: "photos" })).toMatchObject({
      months: [{ year: 2024, month: 8, count: 1 }],
    });
    expect(handler.handle("library.getItem", { fileId })).toMatchObject({
      item: { fileId },
      position: 1,
    });
    expect(handler.handle("library.getContext", {})).toMatchObject({
      volumeId,
      catalogPath,
    });
    db.close();
  });

  it("resolves media and saves thumbnail state", () => {
    const { db, handler, fileId } = createHarness();

    expect(handler.handle("library.resolveMedia", { fileId })).toMatchObject({
      fileId,
      state: "present",
    });
    expect(handler.handle("library.resolveThumbnail", { fileId })).toMatchObject({
      status: "pending",
    });
    expect(
      handler.handle("library.saveThumbnail", {
        fileId,
        path: "C:\\cache\\a.jpg",
        bytes: 10,
        status: "ready",
        now,
      }),
    ).toEqual({ saved: true });
    expect(handler.handle("library.resolveThumbnail", { fileId })).toMatchObject({
      status: "ready",
      cachePath: "C:\\cache\\a.jpg",
    });
    db.close();
  });

  it("rejects unknown methods and invalid params", () => {
    const { db, handler } = createHarness();

    try {
      handler.handle("library.nope" as LibraryDbMethod, {});
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(APP_ERROR_CODES.INVALID_REQUEST);
    }
    expect(() => handler.handle("library.getTimeline", { filter: "audio" })).toThrow();
    expect(() =>
      handler.handle("library.saveThumbnail", { fileId: 1, path: "", bytes: -1, status: "ready" }),
    ).toThrow();
    db.close();
  });
});
