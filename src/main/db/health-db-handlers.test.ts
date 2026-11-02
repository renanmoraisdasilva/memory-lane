import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { createHealthDbHandlers } from "./health-db-handlers";
import type { HealthDbMethod } from "./health-worker-protocol";
import { catalogMigrations } from "./migrations/catalog-migrations";
import { runMigrations } from "./migrations/runner";
import { ensureDriveIdentity } from "./repositories/catalog-repository";

const volumeId = toVolumeId("volume-1");
const now = "2026-10-31T12:00:00.000Z";

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
    5,
  );
  const file = db
    .prepare(
      `INSERT INTO files (
        path, name, size, modified_at_fs, media_class, format, state, last_seen_at
      ) VALUES ('C:\\archive\\a.jpg', 'a.jpg', 100, ?, 'image', 'JPG', 'present', ?)
      RETURNING id`,
    )
    .get(now, now) as { id: number };
  db.prepare(
    "INSERT INTO hashes (file_id, sha256, hashed_at, status) VALUES (?, 'hash', ?, 'complete')",
  ).run(file.id, now);
  const missing = db
    .prepare(
      `INSERT INTO files (
        path, name, size, modified_at_fs, media_class, format, state, missing_since, last_seen_at
      ) VALUES ('C:\\archive\\old.jpg', 'old.jpg', 100, ?, 'image', 'JPG', 'missing', ?, ?)
      RETURNING id`,
    )
    .get(now, now, now) as { id: number };
  db.prepare(
    "INSERT INTO missing_files (file_id, last_path, last_seen_at, reason) VALUES (?, 'C:\\archive\\old.jpg', ?, 'scan')",
  ).run(missing.id, now);
  const moved = db
    .prepare(
      "INSERT INTO moved_candidates (file_id, old_path, new_path, sha256, state) VALUES (?, 'C:\\archive\\old.jpg', 'C:\\archive\\a.jpg', 'hash', 'pending') RETURNING id",
    )
    .get(missing.id) as { id: number };
  db.prepare(
    `INSERT INTO file_dates (file_id, resolved_date, precision, source, confidence, original_value)
     VALUES (?, ?, 'exact', 'filesystem.created', 0.6, ?)`,
  ).run(file.id, now, now);

  const handler = createHealthDbHandlers({ getCatalog: () => db });
  return { db, handler, fileId: file.id, missingId: missing.id, movedId: moved.id };
}

describe("health DB handlers", () => {
  it("serves summary, duplicates, missing, and moved records", () => {
    const { db, handler, movedId } = createHarness();

    expect(handler.handle("health.getSummary", {})).toMatchObject({
      duplicateGroups: 0,
      missingFiles: 1,
      movedCandidates: 1,
    });
    expect(handler.handle("health.getDuplicates", {})).toMatchObject({ totalGroups: 0 });
    expect(handler.handle("health.getDuplicates", { offset: 0, limit: 10 })).toMatchObject({
      totalGroups: 0,
    });
    expect(handler.handle("health.getMissing", {})).toMatchObject({ total: 1 });
    expect(handler.handle("health.getMissing", { offset: 0, limit: 10 })).toMatchObject({
      total: 1,
    });
    expect(handler.handle("health.getMoved", {})).toMatchObject({ total: 1 });
    expect(handler.handle("health.confirmMoved", { candidateIds: [movedId], now })).toEqual({
      updated: 1,
      skipped: 0,
    });
    expect(handler.handle("health.getMoved", {})).toMatchObject({ total: 0 });
    expect(
      handler.handle("health.dismissMoved", {
        candidateIds: [movedId],
      }),
    ).toEqual({ updated: 0, skipped: 1 });
    db.close();
  });

  it("serves and purges missing duplicate entries", () => {
    const { db, handler, fileId } = createHarness();
    const duplicate = db
      .prepare(
        `INSERT INTO files (
          path, name, size, modified_at_fs, media_class, format, state, missing_since, last_seen_at
        ) VALUES ('C:\\archive\\duplicate.jpg', 'duplicate.jpg', 100, ?, 'image', 'JPG',
          'missing', ?, ?) RETURNING id`,
      )
      .get(now, now, now) as { id: number };
    db.prepare(
      "INSERT INTO missing_files (file_id, last_path, last_seen_at, reason) VALUES (?, ?, ?, 'scan')",
    ).run(duplicate.id, "C:\\archive\\duplicate.jpg", now);
    db.prepare(
      "INSERT INTO hashes (file_id, sha256, hashed_at, status) VALUES (?, 'hash', ?, 'complete')",
    ).run(duplicate.id, now);

    expect(handler.handle("health.getMissingDuplicates", {})).toMatchObject({
      total: 1,
      candidateFileIds: [duplicate.id],
    });
    expect(handler.handle("health.getMissingDuplicates", { offset: 0, limit: 1 })).toMatchObject({
      total: 1,
    });
    expect(handler.handle("health.purgeMissingDuplicates", { fileIds: [duplicate.id] })).toEqual({
      removed: 1,
      skipped: 0,
    });
    expect(db.prepare("SELECT id FROM files WHERE id = ?").get(duplicate.id)).toBeUndefined();
    expect(db.prepare("SELECT id FROM files WHERE id = ?").get(fileId)).toBeDefined();
    expect(handler.handle("health.getMissing", {})).toMatchObject({ total: 1 });
    db.close();
  });

  it("manages a validation session and saves results", () => {
    const { db, handler, fileId } = createHarness();
    expect(handler.handle("health.getValidationState", {})).toMatchObject({ status: "idle" });
    const started = handler.handle("health.createValidation", {
      levels: ["existence", "hash"],
      now,
    }) as { sessionId: number; total: number; status: string };
    expect(started).toMatchObject({ status: "running", total: 4 });
    expect(
      handler.handle("health.listPendingValidation", {
        sessionId: started.sessionId,
        level: "existence",
        limit: 10,
      }),
    ).toHaveLength(2);
    expect(
      handler.handle("health.setValidationLevel", {
        sessionId: started.sessionId,
        level: "existence",
        now,
      }),
    ).toEqual({ saved: true });
    expect(
      handler.handle("health.saveValidationResults", {
        sessionId: started.sessionId,
        items: [{ fileId, level: "existence", result: "verified", detail: null }],
        now,
      }),
    ).toMatchObject({ processed: 1, currentLevel: "existence" });
    expect(
      handler.handle("health.pauseValidation", { sessionId: started.sessionId, now }),
    ).toMatchObject({ status: "paused" });
    expect(
      handler.handle("health.resumeValidation", { sessionId: started.sessionId, now }),
    ).toMatchObject({ status: "running" });
    expect(
      handler.handle("health.finishValidation", { sessionId: started.sessionId, now }),
    ).toMatchObject({ status: "complete" });
    expect(
      handler.handle("health.failValidation", {
        sessionId: started.sessionId,
        message: "failed",
        now,
      }),
    ).toMatchObject({ status: "failed", errorMessage: "failed" });
    db.close();
  });

  it("rejects unknown methods and invalid params", () => {
    const { db, handler } = createHarness();
    try {
      handler.handle("health.nope" as HealthDbMethod, {});
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(APP_ERROR_CODES.INVALID_REQUEST);
    }
    expect(() => handler.handle("health.getDuplicates", { limit: 500 })).toThrow();
    expect(() => handler.handle("health.createValidation", { levels: [] })).toThrow();
    db.close();
  });
});
