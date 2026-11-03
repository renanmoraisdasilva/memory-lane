import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { ScannedFile } from "../../modules/scanning/domain/scan-files";
import { appMigrations } from "../migrations/app-migrations";
import { catalogMigrations } from "../migrations/catalog-migrations";
import { runMigrations } from "../migrations/runner";
import { ensureDriveIdentity } from "./catalog-repository";
import { applyCatalogBatch, finalizeScan, finishCatalog } from "./scan-catalog-repository";
import { createScanSession } from "./scan-session-repository";

const volumeId = toVolumeId("volume-1");
const now = "2026-01-01T10:00:00.000Z";
const rootPath = "C:\\archive";

function createDb(): Database.Database {
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
    2,
  );
  return db;
}

function startSession(db: Database.Database): void {
  createScanSession(db, { volumeId, rootPath, intensity: "balanced", now });
}

function scannedFile(filePath: string, overrides: Partial<ScannedFile> = {}): ScannedFile {
  return {
    path: filePath,
    name: "photo.jpg",
    extension: "jpg",
    size: 100,
    createdAtFs: now,
    modifiedAtFs: now,
    linkCount: 1,
    mediaClass: "image",
    format: "JPG",
    mime: "image/jpeg",
    ...overrides,
  };
}

interface InsertFileInput {
  path: string;
  size: number | string;
  state?: "present" | "missing";
  lastSeen?: string;
  missingSince?: string | null;
  mediaClass?: string;
}

function insertFile(db: Database.Database, input: InsertFileInput): number {
  const row = db
    .prepare(
      `INSERT INTO files (
        path, name, size, modified_at_fs, media_class, state, missing_since, last_seen_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id`,
    )
    .get(
      input.path,
      "file",
      input.size,
      now,
      input.mediaClass ?? "other",
      input.state ?? "present",
      input.missingSince ?? null,
      input.lastSeen ?? now,
    ) as { id: number } | undefined;
  if (row === undefined) {
    throw new Error("File insert failed");
  }
  return row.id;
}

function expectCode(error: unknown, code: string): void {
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe(code);
}

describe("scan catalog repository", () => {
  it("counts new, unchanged, changed, and reappearing files", () => {
    const db = createDb();
    startSession(db);
    const filePath = "C:\\archive\\photo.jpg";

    const first = applyCatalogBatch(db, { volumeId, files: [scannedFile(filePath)], seenAt: now });
    expect(first).toEqual({ newFiles: 1, changedFiles: 0, processed: 1 });

    const unchanged = applyCatalogBatch(db, {
      volumeId,
      files: [scannedFile(filePath)],
      seenAt: "2026-01-01T10:00:01.000Z",
    });
    expect(unchanged).toEqual({ newFiles: 0, changedFiles: 0, processed: 1 });

    const changed = applyCatalogBatch(db, {
      volumeId,
      files: [scannedFile(filePath, { size: 200 })],
      seenAt: "2026-01-01T10:00:02.000Z",
    });
    expect(changed).toEqual({ newFiles: 0, changedFiles: 1, processed: 1 });

    db.prepare("UPDATE files SET state = 'missing' WHERE path = ?").run(filePath);
    const reappeared = applyCatalogBatch(db, {
      volumeId,
      files: [scannedFile(filePath, { size: 200 })],
      seenAt: "2026-01-01T10:00:03.000Z",
    });
    expect(reappeared).toEqual({ newFiles: 0, changedFiles: 1, processed: 1 });
    db.close();
  });

  it("rejects a batch for another catalog or without a session", () => {
    const db = createDb();
    startSession(db);
    const file = scannedFile("C:\\archive\\photo.jpg");

    try {
      applyCatalogBatch(db, { volumeId: toVolumeId("other"), files: [file], seenAt: now });
    } catch (error) {
      expectCode(error, APP_ERROR_CODES.CATALOG_MISMATCH);
    }
    db.close();

    const empty = createDb();
    try {
      applyCatalogBatch(empty, { volumeId, files: [file], seenAt: now });
    } catch (error) {
      expectCode(error, APP_ERROR_CODES.SCAN_STATE_INVALID);
    }
    empty.close();
  });

  it("rejects a malformed existing file row", () => {
    const db = createDb();
    startSession(db);
    insertFile(db, { path: "C:\\archive\\broken.jpg", size: "not-a-size" });

    expect(() =>
      applyCatalogBatch(db, {
        volumeId,
        files: [scannedFile("C:\\archive\\broken.jpg")],
        seenAt: now,
      }),
    ).toThrow(AppError);
    db.close();
  });

  it("[ML-HEALTH-006] marks files missing and supports a read-error pass without marking", () => {
    const db = createDb();
    startSession(db);
    applyCatalogBatch(db, {
      volumeId,
      files: [scannedFile("C:\\archive\\present.jpg")],
      seenAt: now,
    });
    insertFile(db, {
      path: "C:\\archive\\old.jpg",
      size: 10,
      lastSeen: "2025-01-01T00:00:00.000Z",
    });

    const safe = finishCatalog(db, {
      volumeId,
      rootPath,
      seenAt: "2026-01-01T10:01:00.000Z",
      markMissing: false,
    });
    expect(safe).toEqual({ processed: 1, missingFiles: 0 });

    const finished = finishCatalog(db, {
      volumeId,
      rootPath,
      seenAt: "2026-01-01T10:02:00.000Z",
      markMissing: true,
    });
    expect(finished).toEqual({ processed: 1, missingFiles: 1 });

    const missing = db.prepare("SELECT path FROM files WHERE state = 'missing'").all() as Array<{
      path: string;
    }>;
    expect(missing).toEqual([{ path: "C:\\archive\\old.jpg" }]);
    db.close();
  });

  it("handles a scan root that is already a filesystem root", () => {
    const db = createDb();
    startSession(db);
    insertFile(db, {
      path: "C:\\archive\\old.jpg",
      size: 10,
      lastSeen: "2025-01-01T00:00:00.000Z",
    });

    const result = finishCatalog(db, {
      volumeId,
      rootPath: "C:\\",
      seenAt: "2026-01-01T10:01:00.000Z",
      markMissing: true,
    });
    expect(result.missingFiles).toBe(1);
    db.close();
  });

  it("finalizes a scan and records a likely move", () => {
    const db = createDb();
    startSession(db);
    const oldId = insertFile(db, {
      path: "C:\\archive\\old.jpg",
      size: 10,
      state: "missing",
      missingSince: now,
    });
    const newId = insertFile(db, {
      path: "C:\\archive\\new.jpg",
      size: 10,
      state: "present",
      lastSeen: now,
    });
    db.prepare(
      "INSERT INTO hashes (file_id, sha256, hashed_at, status) VALUES (?, ?, ?, 'complete')",
    ).run(oldId, "a".repeat(64), now);
    db.prepare(
      "INSERT INTO hashes (file_id, sha256, hashed_at, status) VALUES (?, ?, ?, 'complete')",
    ).run(newId, "a".repeat(64), now);
    db.prepare(
      "INSERT INTO missing_files (file_id, last_path, last_seen_at, reason) VALUES (?, ?, ?, 'not_found')",
    ).run(oldId, "C:\\archive\\old.jpg", now);

    const appDb = new Database(":memory:");
    runMigrations(appDb, appMigrations);
    const state = finalizeScan(db, { catalogDb: db, appDb, volumeId, now });

    expect(state.status).toBe("complete");
    expect(state.report).toEqual({
      newFiles: 0,
      changedFiles: 0,
      missingFiles: 0,
      movedCandidates: 1,
    });
    const moved = db
      .prepare("SELECT old_path, new_path, state FROM moved_candidates")
      .all() as Array<{ old_path: string; new_path: string; state: string }>;
    expect(moved).toEqual([
      { old_path: "C:\\archive\\old.jpg", new_path: "C:\\archive\\new.jpg", state: "pending" },
    ]);
    appDb.close();
    db.close();
  });

  it("rejects finalization for another catalog or without a session", () => {
    const db = createDb();
    startSession(db);
    const appDb = new Database(":memory:");
    runMigrations(appDb, appMigrations);

    try {
      finalizeScan(db, { catalogDb: db, appDb, volumeId: toVolumeId("other"), now });
    } catch (error) {
      expectCode(error, APP_ERROR_CODES.CATALOG_MISMATCH);
    }
    appDb.close();
    db.close();

    const empty = createDb();
    const emptyApp = new Database(":memory:");
    runMigrations(emptyApp, appMigrations);
    try {
      finalizeScan(empty, { catalogDb: empty, appDb: emptyApp, volumeId, now });
    } catch (error) {
      expectCode(error, APP_ERROR_CODES.SCAN_STATE_INVALID);
    }
    emptyApp.close();
    empty.close();
  });
});
