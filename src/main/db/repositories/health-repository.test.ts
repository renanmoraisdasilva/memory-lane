import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { catalogMigrations } from "../migrations/catalog-migrations";
import { runMigrations } from "../migrations/runner";
import { ensureDriveIdentity } from "./catalog-repository";
import {
  confirmMovedCandidates,
  dismissMovedCandidates,
  getDuplicateGroups,
  getHealthSummary,
  rebuildDuplicateGroups,
} from "./health-repository";
import {
  dismissMissingFiles,
  getMissingFiles,
  restoreMissingFiles,
} from "./health-missing-repository";
import { getMovedCandidates, getMovedCandidatesByIds } from "./health-moved-repository";

const volumeId = toVolumeId("volume-1");
const now = "2026-10-31T12:00:00.000Z";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
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

function insertFile(
  db: Database.Database,
  name: string,
  size = 100,
  state: "present" | "missing" = "present",
): number {
  const row = db
    .prepare(
      `INSERT INTO files (
        path, name, size, modified_at_fs, media_class, format, state, missing_since, last_seen_at
      ) VALUES (?, ?, ?, ?, 'image', 'JPG', ?, ?, ?)
      RETURNING id`,
    )
    .get(`C:\\archive\\${name}`, name, size, now, state, state === "missing" ? now : null, now) as {
    id: number;
  };
  return row.id;
}

function addHash(db: Database.Database, fileId: number, sha256: string): void {
  db.prepare(
    "INSERT INTO hashes (file_id, sha256, hashed_at, status) VALUES (?, ?, ?, 'complete')",
  ).run(fileId, sha256, now);
}

describe("health repository", () => {
  it("[ML-QUAR-001] [ML-HEALTH-002] [ML-HEALTH-003] [ML-REL-005] groups exact duplicates across file types", () => {
    const db = createDb();
    const first = insertFile(db, "a.jpg", 100);
    const second = insertFile(db, "b.jpg", 100);
    const third = insertFile(db, "notes.txt", 10);
    addHash(db, first, "same");
    addHash(db, second, "same");
    addHash(db, third, "different");
    rebuildDuplicateGroups(db);

    const page = getDuplicateGroups(db, 0, 10);
    expect(page).toMatchObject({ totalGroups: 1, totalFiles: 2, totalBytes: 200 });
    expect(page.groups[0]).toMatchObject({ fileCount: 2, totalBytes: 200 });
    expect(page.groups[0]?.files.map((file) => file.name).sort()).toEqual(["a.jpg", "b.jpg"]);
    db.close();
  });

  it("[ML-HEALTH-004] orders duplicate groups by total bytes descending", () => {
    const db = createDb();
    const smallA = insertFile(db, "small-a.jpg", 100);
    const smallB = insertFile(db, "small-b.jpg", 100);
    const largeA = insertFile(db, "large-a.jpg", 300);
    const largeB = insertFile(db, "large-b.jpg", 300);
    addHash(db, smallA, "small");
    addHash(db, smallB, "small");
    addHash(db, largeA, "large");
    addHash(db, largeB, "large");
    rebuildDuplicateGroups(db);

    const page = getDuplicateGroups(db, 0, 10);
    expect(page.groups.map((group) => group.totalBytes)).toEqual([600, 200]);
    db.close();
  });

  it("[ML-HEALTH-001] [ML-HEALTH-005] reads precomputed duplicate totals without rebuilding on every summary", () => {
    const db = createDb();
    const first = insertFile(db, "a.jpg", 100);
    const second = insertFile(db, "b.jpg", 100);
    addHash(db, first, "same");
    addHash(db, second, "same");

    expect(getHealthSummary(db)).toMatchObject({
      duplicateGroups: 0,
      duplicateFiles: 0,
    });
    rebuildDuplicateGroups(db);
    expect(getDuplicateGroups(db, 0, 10).totalGroups).toBe(1);
    expect(getHealthSummary(db)).toMatchObject({
      duplicateGroups: 1,
      duplicateFiles: 2,
      duplicateBytes: 200,
    });
    db.close();
  });

  it("[ML-HEALTH-001] [ML-HEALTH-006] [ML-REL-005] lists missing files and moved candidates", () => {
    const db = createDb();
    const oldId = insertFile(db, "old.jpg", 100, "missing");
    const newId = insertFile(db, "new.jpg", 100);
    db.prepare(
      "INSERT INTO missing_files (file_id, last_path, last_seen_at, reason) VALUES (?, ?, ?, 'not_found_on_scan')",
    ).run(oldId, "C:\\archive\\old.jpg", now);
    db.prepare(
      "INSERT INTO moved_candidates (file_id, old_path, new_path, sha256, state) VALUES (?, ?, ?, 'hash', 'pending')",
    ).run(oldId, "C:\\archive\\old.jpg", "C:\\archive\\new.jpg");
    addHash(db, oldId, "hash");
    addHash(db, newId, "hash");

    const missing = getMissingFiles(db, 0, 10);
    expect(missing.items[0]).toMatchObject({
      fileId: oldId,
      name: "old.jpg",
      hasMovedCandidate: true,
      lastPath: "C:\\archive\\old.jpg",
    });
    const moved = getMovedCandidates(db);
    expect(moved.items[0]).toMatchObject({
      fileId: oldId,
      name: "old.jpg",
      oldPath: "C:\\archive\\old.jpg",
      newPath: "C:\\archive\\new.jpg",
    });
    const summary = getHealthSummary(db);
    expect(summary).toMatchObject({ missingFiles: 1, movedCandidates: 1 });
    db.close();
  });

  it("[ML-HEALTH-010] confirms a moved candidate and updates the catalog path", () => {
    const db = createDb();
    const oldId = insertFile(db, "old.jpg", 100, "missing");
    insertFile(db, "new.jpg", 100);
    db.prepare(
      "INSERT INTO missing_files (file_id, last_path, last_seen_at, reason) VALUES (?, ?, ?, 'not_found_on_scan')",
    ).run(oldId, "C:\\archive\\old.jpg", now);
    const candidate = db
      .prepare(
        "INSERT INTO moved_candidates (file_id, old_path, new_path, sha256, state) VALUES (?, ?, ?, 'hash', 'pending') RETURNING id",
      )
      .get(oldId, "C:\\archive\\old.jpg", "C:\\archive\\new.jpg") as { id: number };

    expect(confirmMovedCandidates(db, [candidate.id], now)).toEqual({ updated: 1, skipped: 0 });
    expect(
      db.prepare("SELECT path, name, state, missing_since FROM files WHERE id = ?").get(oldId),
    ).toEqual({
      path: "C:\\archive\\new.jpg",
      name: "new.jpg",
      state: "present",
      missing_since: null,
    });
    expect(db.prepare("SELECT COUNT(*) AS count FROM missing_files").get()).toEqual({ count: 0 });
    expect(
      db.prepare("SELECT state, confirmed_at FROM moved_candidates WHERE id = ?").get(candidate.id),
    ).toEqual({ state: "confirmed", confirmed_at: now });
    db.close();
  });

  it("[ML-HEALTH-011] dismisses moved candidates and skips unknown targets", () => {
    const db = createDb();
    const oldId = insertFile(db, "old.jpg", 100, "missing");
    const candidate = db
      .prepare(
        "INSERT INTO moved_candidates (file_id, old_path, new_path, sha256, state) VALUES (?, ?, ?, 'hash', 'pending') RETURNING id",
      )
      .get(oldId, "C:\\archive\\old.jpg", "C:\\archive\\new.jpg") as { id: number };

    expect(dismissMovedCandidates(db, [candidate.id])).toEqual({ updated: 1, skipped: 0 });
    expect(dismissMovedCandidates(db, [9999])).toEqual({ updated: 0, skipped: 1 });
    expect(confirmMovedCandidates(db, [9999], now)).toEqual({ updated: 0, skipped: 1 });
    expect(getMovedCandidates(db).total).toBe(0);
    db.close();
  });

  it("[ML-HEALTH-009] paginates moved candidates and fetches selected candidates by id", () => {
    const db = createDb();
    const ids: number[] = [];
    for (let index = 0; index < 3; index += 1) {
      const fileId = insertFile(db, `moved-${index}.jpg`, 100, "missing");
      const row = db
        .prepare(
          "INSERT INTO moved_candidates (file_id, old_path, new_path, sha256, state) VALUES (?, ?, ?, 'hash', 'pending') RETURNING id",
        )
        .get(fileId, `C:\\archive\\moved-${index}.jpg`, `C:\\archive\\new-${index}.jpg`) as {
        id: number;
      };
      ids.push(row.id);
    }

    const lastId = ids[ids.length - 1] as number;
    const first = getMovedCandidates(db, 0, 2);
    expect(first.total).toBe(3);
    expect(first.items.map((item) => item.id)).toEqual(ids.slice(0, 2));
    const second = getMovedCandidates(db, 2, 2);
    expect(second.total).toBe(3);
    expect(second.items.map((item) => item.id)).toEqual([lastId]);
    const selected = getMovedCandidatesByIds(db, [lastId, 9999]);
    expect(selected.total).toBe(1);
    expect(selected.items[0]).toMatchObject({ id: lastId });
    db.close();
  });

  it("[ML-HEALTH-001] summarizes an empty catalog and records the last validation", () => {
    const db = createDb();
    expect(getHealthSummary(db)).toEqual({
      duplicateGroups: 0,
      duplicateFiles: 0,
      duplicateBytes: 0,
      missingFiles: 0,
      movedCandidates: 0,
      lastValidationAt: null,
    });
    db.prepare(
      `INSERT INTO validation_sessions (levels, state, started_at, finished_at)
       VALUES ('["existence"]', 'complete', ?, ?)`,
    ).run(now, now);
    expect(getHealthSummary(db).lastValidationAt).toBe(now);
    expect(getMissingFiles(db, 0, 10)).toEqual({
      items: [],
      total: 0,
      fileIds: [],
      dismissedTotal: 0,
    });
    expect(getDuplicateGroups(db, 0, 10)).toEqual({
      groups: [],
      totalGroups: 0,
      totalFiles: 0,
      totalBytes: 0,
      totalExcessBytes: 0,
    });
    db.close();
  });

  it("shows missing files without a moved match", () => {
    const db = createDb();
    const fileId = insertFile(db, "gone.jpg", 100, "missing");
    db.prepare(
      "INSERT INTO missing_files (file_id, last_path, last_seen_at, reason) VALUES (?, ?, NULL, NULL)",
    ).run(fileId, "C:\\archive\\gone.jpg");

    expect(getMissingFiles(db, 0, 10).items[0]).toMatchObject({
      fileId,
      hasMovedCandidate: false,
      lastSeenAt: null,
      reason: null,
      dismissedAt: null,
    });
    db.close();
  });

  it("[ML-HEALTH-008] orders disregarded files newest first and pages them", () => {
    const db = createDb();
    const older = insertFile(db, "older.jpg", 100, "missing");
    const newer = insertFile(db, "newer.jpg", 100, "missing");
    db.prepare(
      "INSERT INTO missing_files (file_id, last_path, last_seen_at, reason, dismissed_at) VALUES (?, ?, ?, 'scan', ?)",
    ).run(older, "C:\\archive\\older.jpg", now, "2026-11-01T12:00:00.000Z");
    db.prepare(
      "INSERT INTO missing_files (file_id, last_path, last_seen_at, reason, dismissed_at) VALUES (?, ?, ?, 'scan', ?)",
    ).run(newer, "C:\\archive\\newer.jpg", now, "2026-11-03T12:00:00.000Z");

    const first = getMissingFiles(db, 0, 1, true);
    expect(first.total).toBe(2);
    expect(first.items[0]?.fileId).toBe(newer);
    expect(first.fileIds).toEqual([newer, older]);

    const second = getMissingFiles(db, 1, 1, true);
    expect(second.items[0]?.fileId).toBe(older);
    db.close();
  });

  it("[ML-HEALTH-007] [ML-HEALTH-008] dismisses and restores missing files without deleting catalog rows", () => {
    const db = createDb();
    const fileId = insertFile(db, "gone.jpg", 100, "missing");
    db.prepare(
      "INSERT INTO missing_files (file_id, last_path, last_seen_at, reason) VALUES (?, ?, ?, 'scan')",
    ).run(fileId, "C:\\archive\\gone.jpg", now);
    db.prepare(
      "INSERT INTO moved_candidates (file_id, old_path, new_path, sha256, state) VALUES (?, ?, ?, 'hash', 'pending')",
    ).run(fileId, "C:\\archive\\gone.jpg", "C:\\archive\\new.jpg");

    expect(dismissMissingFiles(db, [fileId], now)).toEqual({ updated: 1, skipped: 0 });
    expect(getHealthSummary(db).missingFiles).toBe(0);
    expect(getMovedCandidates(db).total).toBe(0);
    expect(getMissingFiles(db, 0, 10)).toEqual({
      items: [],
      total: 0,
      fileIds: [],
      dismissedTotal: 1,
    });
    const dismissed = getMissingFiles(db, 0, 10, true);
    expect(dismissed.items[0]).toMatchObject({ fileId, dismissedAt: now });
    expect(dismissed.fileIds).toEqual([fileId]);
    expect(dismissed.dismissedTotal).toBe(1);
    expect(db.prepare("SELECT state FROM files WHERE id = ?").get(fileId)).toEqual({
      state: "missing",
    });

    expect(dismissMissingFiles(db, [fileId], now)).toEqual({ updated: 0, skipped: 1 });
    expect(restoreMissingFiles(db, [fileId])).toEqual({ updated: 1, skipped: 0 });
    expect(getHealthSummary(db).missingFiles).toBe(1);
    expect(getMissingFiles(db, 0, 10).items[0]).toMatchObject({
      fileId,
      dismissedAt: null,
    });
    expect(getMissingFiles(db, 0, 10).dismissedTotal).toBe(0);
    db.close();
  });

  it("skips a moved candidate when the catalog update fails", () => {
    const db = createDb();
    const oldId = insertFile(db, "old.jpg", 100, "missing");
    const candidate = db
      .prepare(
        "INSERT INTO moved_candidates (file_id, old_path, new_path, sha256, state) VALUES (?, ?, ?, 'hash', 'pending') RETURNING id",
      )
      .get(oldId, "C:\\archive\\old.jpg", "C:\\archive\\new.jpg") as { id: number };
    db.exec(
      "CREATE TRIGGER fail_update BEFORE UPDATE ON files BEGIN SELECT RAISE(ABORT, 'nope'); END;",
    );

    expect(confirmMovedCandidates(db, [candidate.id], now)).toEqual({ updated: 0, skipped: 1 });
    db.close();
  });
});
