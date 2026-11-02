import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { catalogMigrations } from "../migrations/catalog-migrations";
import { runMigrations } from "../migrations/runner";
import { ensureDriveIdentity } from "./catalog-repository";
import {
  createValidation,
  failValidation,
  finishValidation,
  getValidationState,
  listPendingValidation,
  pauseValidation,
  resumeValidation,
  saveValidationResults,
} from "./validation-repository";

const volumeId = toVolumeId("volume-1");
const now = "2026-10-31T12:00:00.000Z";

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
    5,
  );
  return db;
}

function insertFile(db: Database.Database, name: string, hash: string | null): number {
  const row = db
    .prepare(
      `INSERT INTO files (
        path, name, size, modified_at_fs, media_class, format, state, last_seen_at
      ) VALUES (?, ?, 100, ?, 'image', 'JPG', 'present', ?)
      RETURNING id`,
    )
    .get(`C:\\archive\\${name}`, name, now, now) as { id: number };
  if (hash !== null) {
    db.prepare(
      "INSERT INTO hashes (file_id, sha256, hashed_at, status) VALUES (?, ?, ?, 'complete')",
    ).run(row.id, hash, now);
  }
  return row.id;
}

describe("validation repository", () => {
  it("creates, progresses, pauses, resumes, and completes a session", () => {
    const db = createDb();
    insertFile(db, "a.jpg", "hash-a");
    insertFile(db, "b.jpg", null);

    expect(getValidationState(db)).toMatchObject({ status: "idle", sessionId: null });
    const created = createValidation(db, ["existence", "hash"], now);
    expect(created).toMatchObject({
      status: "running",
      total: 4,
      processed: 0,
      report: null,
    });
    const sessionId = created.sessionId;
    if (sessionId === null) {
      throw new Error("Session was not created");
    }
    expect(listPendingValidation(db, sessionId, "existence", 10)).toHaveLength(2);

    saveValidationResults(
      db,
      sessionId,
      [
        { fileId: 1, level: "existence", result: "verified", detail: null },
        { fileId: 1, level: "hash", result: "hashVerified", detail: null, actualHash: "hash-a" },
      ],
      now,
    );
    expect(getValidationState(db).processed).toBe(2);

    pauseValidation(db, sessionId, now);
    expect(getValidationState(db).status).toBe("paused");
    resumeValidation(db, sessionId, now);
    expect(getValidationState(db).status).toBe("running");

    finishValidation(db, sessionId, now);
    expect(getValidationState(db)).toMatchObject({
      status: "complete",
      report: { total: 2, verified: 2 },
    });
    failValidation(db, sessionId, "disk error", now);
    expect(getValidationState(db)).toMatchObject({
      status: "failed",
      errorMessage: "disk error",
    });
    db.close();
  });

  it("marks missing files and stores changed hashes", () => {
    const db = createDb();
    const fileId = insertFile(db, "a.jpg", "old-hash");
    const state = createValidation(db, ["hash"], now);
    const sessionId = state.sessionId;
    if (sessionId === null) {
      throw new Error("Session was not created");
    }

    saveValidationResults(
      db,
      sessionId,
      [
        {
          fileId,
          level: "hash",
          result: "hashMismatch",
          detail: "changed",
          actualHash: "new-hash",
        },
        { fileId, level: "existence", result: "missing", detail: "gone" },
      ],
      now,
    );

    expect(db.prepare("SELECT state FROM files WHERE id = ?").get(fileId)).toEqual({
      state: "missing",
    });
    expect(db.prepare("SELECT sha256 FROM hashes WHERE file_id = ?").get(fileId)).toEqual({
      sha256: "new-hash",
    });
    expect(db.prepare("SELECT COUNT(*) AS count FROM missing_files").get()).toEqual({ count: 1 });
    db.prepare("UPDATE missing_files SET dismissed_at = ? WHERE file_id = ?").run(now, fileId);
    saveValidationResults(
      db,
      sessionId,
      [{ fileId, level: "existence", result: "missing", detail: "still gone" }],
      now,
    );
    expect(
      db.prepare("SELECT dismissed_at FROM missing_files WHERE file_id = ?").get(fileId),
    ).toEqual({ dismissed_at: now });
    expect(getValidationState(db).report).toMatchObject({ hashMismatch: 1, missing: 1 });
    db.close();
  });

  it("handles malformed stored sessions and pending rows", () => {
    const db = createDb();
    insertFile(db, "a.jpg", "hash");
    db.prepare(
      `INSERT INTO validation_sessions (levels, state, started_at)
       VALUES ('not-json', 'running', ?)`,
    ).run(now);
    expect(getValidationState(db).levels).toEqual([]);

    const state = createValidation(db, ["existence"], now);
    if (state.sessionId === null) {
      throw new Error("Session was not created");
    }
    const sessionId = state.sessionId;
    db.prepare("UPDATE files SET path = ''").run();
    expect(() => listPendingValidation(db, sessionId, "existence", 10)).toThrow();
    db.close();
  });
});
