import { describe, expect, it } from "vitest";
import type { DuplicateCleanupFile } from "@shared/domain/duplicate-cleanup";
import { AppError } from "@shared/domain/errors";
import {
  summarizeDuplicateEvaluations,
  type DuplicateEvaluationGroup,
} from "./duplicate-evaluation";
import {
  createDb,
  createDestination,
  insertGroup,
  TEST_NOW as now,
  TEST_QUARANTINE_ROOT as quarantineRoot,
  TEST_ROOT_PATH as rootPath,
} from "./health-cleanup-repository.fixtures";
import {
  applyCleanupMoves,
  finishCleanupRun,
  getCleanupPlan,
  getCleanupSummary,
  getLatestCleanupState,
  startCleanupRun,
} from "./health-cleanup-repository";
import { getDuplicateGroups } from "./health-repository";

describe("health cleanup repository", () => {
  it("[ML-QUAR-002] [ML-QUAR-003] summarizes eligible and skipped groups with the keeper rule", () => {
    const db = createDb();
    const eligible = insertGroup(db, "a".repeat(64), [
      {
        input: {
          path: "E:\\archive\\A\\photo.jpg",
          createdAt: "2020-01-01T00:00:00.000Z",
        },
        covered: true,
      },
      {
        input: {
          path: "E:\\archive\\B\\photo.jpg",
          createdAt: "2024-01-01T00:00:00.000Z",
        },
      },
      {
        input: {
          path: "E:\\archive\\C\\photo.jpg",
          createdAt: "2025-01-01T00:00:00.000Z",
        },
      },
    ]);
    insertGroup(db, "b".repeat(64), [
      { input: { path: "E:\\archive\\uncovered-a.jpg" } },
      { input: { path: "E:\\archive\\uncovered-b.jpg" } },
    ]);
    insertGroup(db, "c".repeat(64), [
      { input: { path: "E:\\archive\\empty-a.jpg", size: 0 } },
      { input: { path: "E:\\archive\\empty-b.jpg", size: 0 } },
    ]);
    insertGroup(db, "d".repeat(64), [
      { input: { path: "E:\\archive\\tiny-a.jpg", size: 512 } },
      { input: { path: "E:\\archive\\tiny-b.jpg", size: 512 } },
    ]);
    insertGroup(db, "e".repeat(64), [
      { input: { path: "E:\\archive\\hard-a.jpg", linkCount: 2 } },
      { input: { path: "E:\\archive\\hard-b.jpg" } },
    ]);
    insertGroup(db, "f".repeat(64), [
      { input: { path: "E:\\archive\\override-a.jpg" }, override: true },
      { input: { path: "E:\\archive\\override-b.jpg" }, override: true },
    ]);
    insertGroup(db, "g".repeat(64), [
      { input: { path: "E:\\archive\\keeper-covered.jpg" }, covered: true },
      { input: { path: "E:\\archive\\candidate-override.jpg" }, override: true },
    ]);

    const summary = getCleanupSummary(db, rootPath, quarantineRoot);
    expect(summary).toMatchObject({
      totalGroups: 7,
      eligibleGroups: 2,
      skippedGroups: 5,
      groupsWithoutCoverage: 1,
      filesToMove: 3,
      keepers: 2,
      minimumFileSizeBytes: 1024,
      skipCounts: {
        empty: 1,
        belowMinimumSize: 1,
        candidateDateOverride: 1,
        multipleDateOverrides: 1,
        hardLink: 1,
      },
    });
    expect(summary.bytesToMove).toBe(6144);

    const plan = getCleanupPlan(db, rootPath, quarantineRoot);
    expect(plan.groups).toHaveLength(2);
    expect(plan.groups[0]?.keeper.fileId).toBe(eligible[0]);
    expect(plan.groups[0]?.candidates.map((file) => file.fileId)).toEqual([
      eligible[1],
      eligible[2],
    ]);
    expect(plan.groups[0]?.excessBytes).toBe(4096);
    db.close();
  });

  it("promotes a covered copy to keeper when the older copy is uncovered", () => {
    const db = createDb();
    const ids = insertGroup(db, "a".repeat(64), [
      {
        input: {
          path: "E:\\archive\\older\\photo.jpg",
          createdAt: "2010-01-01T00:00:00.000Z",
        },
      },
      {
        input: {
          path: "E:\\archive\\newer\\photo.jpg",
          createdAt: "2024-01-01T00:00:00.000Z",
        },
        covered: true,
      },
    ]);

    const plan = getCleanupPlan(db, rootPath, quarantineRoot);
    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0]?.keeper.fileId).toBe(ids[1]);
    expect(plan.groups[0]?.candidates.map((file) => file.fileId)).toEqual([ids[0]]);
    expect(plan.summary.groupsWithoutCoverage).toBe(0);
    db.close();
  });

  it("pages duplicate groups with keeper decisions and a full excess total", () => {
    const db = createDb();
    const ids = insertGroup(db, "a".repeat(64), [
      { input: { path: "E:\\archive\\photos\\a.jpg" }, covered: true },
      { input: { path: "E:\\archive\\backup\\a.jpg" } },
    ]);
    insertGroup(db, "b".repeat(64), [
      { input: { path: "E:\\archive\\notes-a.txt", mediaClass: "other", size: 512 } },
      { input: { path: "E:\\archive\\notes-b.txt", mediaClass: "other", size: 512 } },
    ]);

    const page = getDuplicateGroups(db, 0, 10);
    expect(page).toMatchObject({
      totalGroups: 2,
      totalExcessBytes: 2048,
    });
    const eligible = page.groups.find((group) => group.eligible);
    expect(eligible).toMatchObject({
      keeperFileId: ids[0],
      eligible: true,
      skipReason: null,
      excessBytes: 2048,
    });
    const notes = page.groups.find((group) => group.files[0]?.name === "notes-a.txt");
    expect(notes?.files[0]?.mediaClass).toBe("other");
    expect(notes?.skipReason).toBe("below-minimum-size");
    db.close();
  });

  it("[ML-QUAR-011] [ML-QUAR-012] records a run, deletes moved rows, and refreshes adoption counters", () => {
    const db = createDb();
    const destination = createDestination(db);
    const ids = insertGroup(db, "a".repeat(64), [
      { input: { path: "E:\\archive\\keep\\photo.jpg" }, covered: true },
      { input: { path: "E:\\archive\\move\\photo.jpg" }, covered: true },
    ]);
    const candidate = ids[1] as number;
    const keeper = ids[0] as number;

    const state = startCleanupRun(db, {
      startedAt: now,
      keeperRule: "oldest-created-then-shorter-path",
      rootPath,
      groupsTotal: 1,
      groupsWithoutCoverage: 0,
      filesTotal: 1,
      bytesTotal: 2048,
      quarantinePath: "E:\\archive\\.memorylane_quarantine\\run-1",
      journalPath: "E:\\archive\\.memorylane_quarantine\\run-1\\journal.jsonl",
    });
    expect(state).toMatchObject({ status: "running", groupsTotal: 1, filesTotal: 1 });

    const applied = applyCleanupMoves(db, state.runId as number, [
      {
        fileId: candidate,
        sourcePath: "E:\\archive\\move\\photo.jpg",
        quarantinePath: "E:\\archive\\.memorylane_quarantine\\run-1\\move\\photo.jpg",
        sha256: "a".repeat(64),
        sizeBytes: 2048,
        createdAtFs: "2020-01-01T00:00:00.000Z",
        modifiedAtFs: "2020-01-01T00:00:00.000Z",
        keeperFileId: keeper,
        keeperPath: "E:\\archive\\keep\\photo.jpg",
        movedAt: now,
      },
    ]);
    expect(applied).toEqual({ recorded: 1, removed: 1 });
    expect(db.prepare("SELECT id FROM files WHERE id = ?").get(candidate)).toBeUndefined();
    expect(db.prepare("SELECT COUNT(*) AS count FROM duplicate_groups").get()).toEqual({
      count: 0,
    });
    expect(db.prepare("SELECT COUNT(*) AS count FROM cleanup_moves").get()).toEqual({ count: 1 });
    expect(
      db
        .prepare(
          "SELECT verified_files, matched_files FROM replication_adoptions WHERE destination_id = ?",
        )
        .get(destination),
    ).toEqual({ verified_files: 1, matched_files: 1 });
    expect(
      db.prepare("SELECT files_moved, bytes_moved FROM cleanup_runs WHERE id = ?").get(state.runId),
    ).toEqual({ files_moved: 1, bytes_moved: 2048 });

    const finished = finishCleanupRun(db, {
      runId: state.runId as number,
      status: "complete",
      groupsProcessed: 1,
      groupsSkipped: 0,
      filesMoved: 1,
      filesSkipped: 0,
      bytesMoved: 2048,
      finishedAt: now,
      errorMessage: null,
    });
    expect(finished).toMatchObject({ status: "complete", filesMoved: 1, finishedAt: now });
    db.close();
  });

  it("counts a not-a-group decision when a plan is summarized", () => {
    const keeper: DuplicateCleanupFile = {
      fileId: 1,
      name: "one.jpg",
      path: "E:\\archive\\one.jpg",
      sizeBytes: 2048,
      createdAtFs: now,
      modifiedAtFs: now,
      linkCount: 1,
      hasVerifiedReplica: true,
      hasDateOverride: false,
    };
    const group: DuplicateEvaluationGroup = {
      groupId: 1,
      sha256: "a".repeat(64),
      files: [keeper],
      decision: {
        keeper,
        keeperReason: "stable tiebreaker",
        eligible: false,
        skipReason: "not-a-group",
        excessBytes: 0,
      },
    };
    const summary = summarizeDuplicateEvaluations([group], rootPath, quarantineRoot);
    expect(summary.skipCounts.notAGroup).toBe(1);
    expect(summary.skippedGroups).toBe(1);
  });

  it("rejects moves for missing or finished runs and records unmatched files", () => {
    const db = createDb();
    const move = {
      fileId: 9999,
      sourcePath: "E:\\archive\\gone.jpg",
      quarantinePath: "E:\\archive\\.memorylane_quarantine\\run-1\\gone.jpg",
      sha256: "a".repeat(64),
      sizeBytes: 2048,
      createdAtFs: now,
      modifiedAtFs: now,
      keeperFileId: 1,
      keeperPath: "E:\\archive\\keeper.jpg",
      movedAt: now,
    };

    expect(() => applyCleanupMoves(db, 9999, [move])).toThrow(AppError);
    expect(() =>
      finishCleanupRun(db, {
        runId: 9999,
        status: "complete",
        groupsProcessed: 0,
        groupsSkipped: 0,
        filesMoved: 0,
        filesSkipped: 0,
        bytesMoved: 0,
        finishedAt: now,
        errorMessage: null,
      }),
    ).toThrow(AppError);

    const state = startCleanupRun(db, {
      startedAt: now,
      keeperRule: "oldest-created-then-shorter-path",
      rootPath,
      groupsTotal: 1,
      groupsWithoutCoverage: 0,
      filesTotal: 1,
      bytesTotal: 2048,
      quarantinePath: "E:\\archive\\.memorylane_quarantine\\run-1",
      journalPath: "E:\\archive\\.memorylane_quarantine\\run-1\\journal.jsonl",
    });
    expect(applyCleanupMoves(db, state.runId as number, [move])).toEqual({
      recorded: 1,
      removed: 0,
    });
    finishCleanupRun(db, {
      runId: state.runId as number,
      status: "complete",
      groupsProcessed: 1,
      groupsSkipped: 0,
      filesMoved: 1,
      filesSkipped: 0,
      bytesMoved: 2048,
      finishedAt: now,
      errorMessage: null,
    });
    expect(() => applyCleanupMoves(db, state.runId as number, [move])).toThrow(AppError);
    db.close();
  });

  it("[ML-QUAR-014] marks a stale running run as failed when its state is read", () => {
    const db = createDb();
    insertGroup(db, "a".repeat(64), [
      { input: { path: "E:\\archive\\a.jpg" }, covered: true },
      { input: { path: "E:\\archive\\b.jpg" } },
    ]);
    const state = startCleanupRun(db, {
      startedAt: now,
      keeperRule: "oldest-created-then-shorter-path",
      rootPath,
      groupsTotal: 1,
      groupsWithoutCoverage: 0,
      filesTotal: 1,
      bytesTotal: 2048,
      quarantinePath: "E:\\archive\\.memorylane_quarantine\\run-1",
      journalPath: "E:\\archive\\.memorylane_quarantine\\run-1\\journal.jsonl",
    });

    const latest = getLatestCleanupState(db, "2026-11-02T13:00:00.000Z");
    expect(latest).toMatchObject({
      runId: state.runId,
      status: "failed",
      errorMessage: "Cleanup was interrupted. Rescan to reconcile the catalog.",
    });
    db.close();
  });
});
