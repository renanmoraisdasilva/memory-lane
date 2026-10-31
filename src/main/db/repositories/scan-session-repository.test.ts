import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { runMigrations } from "../migrations/runner";
import { catalogMigrations } from "../migrations/catalog-migrations";
import { ensureDriveIdentity } from "./catalog-repository";
import {
  beginScanStage,
  completeScanStage,
  createScanSession,
  failScanSession,
  getScanState,
  interruptScanSession,
  pauseScanSession,
  readLatestScanSession,
  recoverInterruptedScans,
  resumeScanSession,
  saveScanProgress,
  setScanIntensity,
} from "./scan-session-repository";

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
      rootPath: "E:\\",
      letter: "E:",
    },
    2,
  );
  return db;
}

function start(db: Database.Database) {
  return createScanSession(db, { volumeId, rootPath, intensity: "balanced", now });
}

describe("scan session repository", () => {
  it("returns an idle state before the first scan", () => {
    const db = createDb();
    const state = getScanState(db, volumeId);

    expect(state.status).toBe("idle");
    expect(state.stages).toHaveLength(4);
    expect(state.stages.every((stage) => stage.state === "queued")).toBe(true);
    expect(state.intensity).toBe("balanced");
    db.close();
  });

  it("creates a session and reports the active catalog stage", () => {
    const db = createDb();
    const state = start(db);

    expect(state.status).toBe("active");
    expect(state.mode).toBe("initial");
    expect(state.currentStage).toBe("catalog");
    expect(state.startedAt).toBe(now);
    expect(state.stages[0]?.state).toBe("queued");
    db.close();
  });

  it("rejects a second session while one is running", () => {
    const db = createDb();
    start(db);

    expect(() => start(db)).toThrow(AppError);
    try {
      start(db);
    } catch (error) {
      expect((error as AppError).code).toBe(APP_ERROR_CODES.SCAN_ALREADY_RUNNING);
    }
    db.close();
  });

  it("pauses, resumes, and interrupts a session", () => {
    const db = createDb();
    start(db);
    const active = beginScanStage(db, { volumeId, stage: "catalog", total: null, now });
    expect(active.stages[0]?.state).toBe("active");

    const paused = pauseScanSession(db, volumeId, now);
    expect(paused.status).toBe("paused");
    expect(paused.stages[0]?.state).toBe("paused");

    const resumed = resumeScanSession(db, volumeId, now);
    expect(resumed.status).toBe("active");
    expect(resumed.stages[0]?.state).toBe("active");

    const interrupted = interruptScanSession(db, volumeId, now);
    expect(interrupted.status).toBe("interrupted");
    expect(interrupted.stages[0]?.state).toBe("paused");
    db.close();
  });

  it("stores progress and completes a stage", () => {
    const db = createDb();
    start(db);
    beginScanStage(db, { volumeId, stage: "metadata", total: 100, now });
    saveScanProgress(db, {
      volumeId,
      stage: "metadata",
      processed: 40,
      total: 100,
      etaSeconds: 120,
      now,
    });

    let state = getScanState(db, volumeId);
    expect(state.stages.find((stage) => stage.id === "metadata")).toMatchObject({
      state: "active",
      processed: 40,
      total: 100,
    });
    expect(state.etaSeconds).toBe(120);

    state = completeScanStage(db, {
      volumeId,
      stage: "metadata",
      processed: 100,
      total: 100,
      now,
    });
    expect(state.stages.find((stage) => stage.id === "metadata")).toMatchObject({
      state: "complete",
      processed: 100,
      total: 100,
    });
    db.close();
  });

  it("records a failure as an error state", () => {
    const db = createDb();
    start(db);
    beginScanStage(db, { volumeId, stage: "catalog", total: null, now });

    const state = failScanSession(db, volumeId, "Drive disconnected", now);
    expect(state.status).toBe("error");
    expect(state.errorMessage).toBe("Drive disconnected");
    expect(state.stages[0]?.state).toBe("failed");
    db.close();
  });

  it("recovers running sessions after an app restart", () => {
    const db = createDb();
    start(db);
    beginScanStage(db, { volumeId, stage: "catalog", total: null, now });

    recoverInterruptedScans(db);
    const state = getScanState(db, volumeId);
    expect(state.status).toBe("interrupted");
    expect(state.stages[0]?.state).toBe("paused");
    expect(readLatestScanSession(db)?.state).toBe("interrupted");
    db.close();
  });

  it("persists intensity for idle and active scans", () => {
    const db = createDb();
    const idle = setScanIntensity(db, volumeId, "eco", now);
    expect(idle.status).toBe("idle");
    expect(idle.intensity).toBe("eco");

    const active = start(db);
    expect(active.intensity).toBe("balanced");
    const changed = setScanIntensity(db, volumeId, "max", now);
    expect(changed.intensity).toBe("max");
    db.close();
  });

  it("rejects scan requests for another catalog", () => {
    const db = createDb();
    expect(() => getScanState(db, toVolumeId("other"))).toThrow(AppError);
    db.close();
  });

  it("rejects resuming a completed scan", () => {
    const db = createDb();
    start(db);
    db.prepare("UPDATE scan_sessions SET state = 'complete'").run();

    expect(() => resumeScanSession(db, volumeId, now)).toThrow(AppError);
    db.close();
  });

  it("uses incremental mode when the catalog already has files", () => {
    const db = createDb();
    db.prepare(
      `INSERT INTO files (path, name, size, modified_at_fs, state, last_seen_at)
       VALUES ('C:\\archive\\a.jpg', 'a.jpg', 10, ?, 'present', ?)`,
    ).run(now, now);

    expect(start(db).mode).toBe("incremental");
    db.close();
  });

  it("fills a missing stage row as queued", () => {
    const db = createDb();
    start(db);
    db.prepare("DELETE FROM scan_stages WHERE stage = 'hashes'").run();

    const state = getScanState(db, volumeId);
    expect(state.stages.find((stage) => stage.id === "hashes")?.state).toBe("queued");
    db.close();
  });

  it("rejects corrupted session and stage rows", () => {
    const sessionDb = createDb();
    start(sessionDb);
    sessionDb.prepare("UPDATE scan_sessions SET new_files = 'bad'").run();
    expect(() => getScanState(sessionDb, volumeId)).toThrow(AppError);
    sessionDb.close();

    const stageDb = createDb();
    start(stageDb);
    stageDb.prepare("UPDATE scan_stages SET processed = 'bad' WHERE stage = 'catalog'").run();
    expect(() => getScanState(stageDb, volumeId)).toThrow(AppError);
    stageDb.close();
  });

  it("handles interruption and failure without a session", () => {
    const db = createDb();
    expect(interruptScanSession(db, volumeId, now).status).toBe("idle");
    expect(failScanSession(db, volumeId, "failed", now).status).toBe("idle");
    db.close();
  });

  it("does not interrupt a completed session", () => {
    const db = createDb();
    start(db);
    db.prepare("UPDATE scan_sessions SET state = 'complete'").run();

    expect(interruptScanSession(db, volumeId, now).status).toBe("complete");
    db.close();
  });

  it("records a failure when the session has no current stage", () => {
    const db = createDb();
    start(db);
    db.prepare("UPDATE scan_sessions SET last_stage = NULL").run();

    const state = failScanSession(db, volumeId, "failed", now);
    expect(state.status).toBe("error");
    db.close();
  });

  it("rejects mutations that target another catalog", () => {
    const db = createDb();
    start(db);
    const other = toVolumeId("other");

    expect(() =>
      createScanSession(db, { volumeId: other, rootPath, intensity: "eco", now }),
    ).toThrow(AppError);
    expect(() =>
      beginScanStage(db, { volumeId: other, stage: "catalog", total: null, now }),
    ).toThrow(AppError);
    expect(() =>
      saveScanProgress(db, {
        volumeId: other,
        stage: "catalog",
        processed: 0,
        total: null,
        etaSeconds: null,
        now,
      }),
    ).toThrow(AppError);
    expect(() =>
      completeScanStage(db, { volumeId: other, stage: "catalog", processed: 0, total: 0, now }),
    ).toThrow(AppError);
    expect(() => pauseScanSession(db, other, now)).toThrow(AppError);
    expect(() => resumeScanSession(db, other, now)).toThrow(AppError);
    expect(() => setScanIntensity(db, other, "eco", now)).toThrow(AppError);
    expect(() => interruptScanSession(db, other, now)).toThrow(AppError);
    expect(() => failScanSession(db, other, "failed", now)).toThrow(AppError);
    db.close();
  });
});
