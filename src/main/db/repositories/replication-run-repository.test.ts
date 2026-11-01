import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { CATALOG_SCHEMA_VERSION } from "../schema-version";
import { catalogMigrations } from "../migrations/catalog-migrations";
import { runMigrations } from "../migrations/runner";
import { ensureDriveIdentity } from "./catalog-repository";
import { insertDestination, nextDestinationPriority } from "./replication-destination-repository";
import {
  createRun,
  getActiveRun,
  getLatestRun,
  getRun,
  markInterruptedRuns,
  setRunStatus,
  updateRunPlan,
} from "./replication-run-repository";
import { appendRunEvent, listRunEvents } from "./replication-run-event-repository";
import { getExistingReplica, saveRunFileResult } from "./replication-run-file-repository";

const now = "2026-11-01T12:00:00.000Z";

function setup(): { db: Database.Database; destinationId: number; fileId: number } {
  const db = new Database(":memory:");
  runMigrations(db, catalogMigrations);
  ensureDriveIdentity(
    db,
    {
      volumeId: toVolumeId("volume-1"),
      serialNumber: "SERIAL",
      label: "Archive",
      fileSystem: "NTFS",
      rootPath: "E:\\",
      letter: "E:",
    },
    CATALOG_SCHEMA_VERSION,
  );
  const file = db
    .prepare(
      `INSERT INTO files (path, name, size, state, last_seen_at)
       VALUES ('E:\\photos\\a.jpg', 'a.jpg', 10, 'present', ?) RETURNING id`,
    )
    .get(now) as { id: number };
  const destination = insertDestination(db, {
    destinationId: "dest-1",
    volumeId: "volume-2",
    volumeSerial: null,
    label: "Backup A",
    rootRelative: "",
    copyRootRelative: null,
    archiveFolderName: null,
    goal: "extend_coverage",
    layout: "dedicated",
    localCatalogId: "local-1",
    localCatalogRelative: ".memorylane/catalog.db",
    sourceIndexRelative: null,
    allocationMode: "all_safe",
    allocationPercent: null,
    allocationBytes: null,
    reserveBytes: 0,
    priority: nextDestinationPriority(db),
    identityConfidence: "confirmed",
    now,
  });
  return { db, destinationId: destination.id, fileId: file.id };
}

describe("replication run repository", () => {
  it("creates, updates, and recovers runs", () => {
    const { db } = setup();
    expect(getLatestRun(db)).toBeNull();
    expect(() => getRun(db, 999)).toThrow();
    const run = createRun(db, {
      scope: "partial_only",
      goal: "extend_coverage",
      planRevision: 1,
      planHash: "hash-1",
      destinationSnapshot: "[]",
      plannedFiles: 10,
      plannedBytes: 100,
      remainderFiles: 1,
      remainderBytes: 10,
      now,
    });
    expect(run).toMatchObject({ status: "running", planRevision: 1, plannedFiles: 10 });
    expect(getLatestRun(db)?.id).toBe(run.id);
    expect(getActiveRun(db)?.id).toBe(run.id);

    const updated = updateRunPlan(db, run.id, {
      planRevision: 2,
      planHash: "hash-2",
      destinationSnapshot: "[]",
      plannedFiles: 8,
      plannedBytes: 80,
      remainderFiles: 2,
      remainderBytes: 20,
      now,
    });
    expect(updated).toMatchObject({ planRevision: 2, planHash: "hash-2", plannedFiles: 8 });

    expect(
      setRunStatus(db, { runId: run.id, status: "paused", now, errorMessage: null }),
    ).toMatchObject({ status: "paused", pausedAt: now });
    expect(
      setRunStatus(db, { runId: run.id, status: "running", now, errorMessage: null }),
    ).toMatchObject({ status: "running", resumedAt: now });
    expect(
      setRunStatus(db, { runId: run.id, status: "stopping", now, errorMessage: null }),
    ).toMatchObject({ status: "stopping", stopRequestedAt: now });
    expect(
      setRunStatus(db, { runId: run.id, status: "stopped", now, errorMessage: null }),
    ).toMatchObject({ status: "stopped", finishedAt: now });
    expect(
      setRunStatus(db, {
        runId: run.id,
        status: "completed",
        now,
        errorMessage: null,
      }),
    ).toMatchObject({ status: "completed", finishedAt: now });
    expect(getActiveRun(db)).toBeNull();

    createRun(db, {
      scope: "partial_only",
      goal: "extend_coverage",
      planRevision: 1,
      planHash: "hash-3",
      destinationSnapshot: "[]",
      plannedFiles: 2,
      plannedBytes: 20,
      remainderFiles: 0,
      remainderBytes: 0,
      now,
    });
    expect(markInterruptedRuns(db, now)).toBe(1);
    expect(getLatestRun(db)?.status).toBe("interrupted");
    expect(getRun(db, run.id).status).toBe("completed");
    db.close();
  });

  it("saves verified and failed file results and run events", () => {
    const { db, destinationId, fileId } = setup();
    const run = createRun(db, {
      scope: "partial_only",
      goal: "extend_coverage",
      planRevision: 1,
      planHash: "hash-1",
      destinationSnapshot: "[]",
      plannedFiles: 2,
      plannedBytes: 20,
      remainderFiles: 0,
      remainderBytes: 0,
      now,
    });
    saveRunFileResult(db, {
      runId: run.id,
      destinationRowId: destinationId,
      fileId,
      relativePath: "a.jpg",
      relativePathKey: "a.jpg",
      sourceRelativePath: "photos\\a.jpg",
      sourceRelativePathKey: "photos\\a.jpg",
      sizeBytes: 10,
      sha256: "a".repeat(64),
      status: "verified",
      sourceSizeAtVerify: 10,
      sourceModifiedAtFsAtVerify: now,
      destinationSizeAtVerify: 10,
      destinationModifiedAtFsAtVerify: now,
      lastCheckedAt: now,
      lastError: null,
    });
    expect(getExistingReplica(db, destinationId, fileId)).toMatchObject({
      status: "verified",
      relativePath: "a.jpg",
    });
    expect(getRun(db, run.id)).toMatchObject({
      copiedFiles: 1,
      copiedBytes: 10,
      verifiedFiles: 1,
      verifiedBytes: 10,
      failedFiles: 0,
    });

    saveRunFileResult(db, {
      runId: run.id,
      destinationRowId: destinationId,
      fileId,
      relativePath: "a.jpg",
      relativePathKey: "a.jpg",
      sourceRelativePath: "photos\\a.jpg",
      sourceRelativePathKey: "photos\\a.jpg",
      sizeBytes: 10,
      sha256: null,
      status: "failed",
      sourceSizeAtVerify: 10,
      sourceModifiedAtFsAtVerify: now,
      destinationSizeAtVerify: null,
      destinationModifiedAtFsAtVerify: null,
      lastCheckedAt: now,
      lastError: "locked",
    });
    expect(getRun(db, run.id)).toMatchObject({
      verifiedFiles: 1,
      failedFiles: 1,
      failedBytes: 10,
    });

    const event = appendRunEvent(db, {
      runId: run.id,
      type: "started",
      at: now,
      planRevision: 1,
      note: "started",
    });
    appendRunEvent(db, {
      runId: run.id,
      type: "completed",
      at: now,
      planRevision: 1,
      note: "done",
    });
    expect(event).toMatchObject({ runId: run.id, type: "started" });
    const firstPage = listRunEvents(db, run.id, null, 1);
    expect(firstPage.events.map((item) => item.type)).toEqual(["started"]);
    expect(firstPage.nextCursor).toBe(event.id);
    const secondPage = listRunEvents(db, run.id, firstPage.nextCursor, 10);
    expect(secondPage.events.map((item) => item.type)).toEqual(["completed"]);
    expect(secondPage.nextCursor).toBeNull();
    db.close();
  });
});
