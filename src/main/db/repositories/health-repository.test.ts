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
  getMissingFiles,
  getMovedCandidates,
} from "./health-repository";
import {
  getMissingDuplicates,
  purgeMissingDuplicates,
} from "./health-missing-duplicates-repository";
import { insertDestination, nextDestinationPriority } from "./replication-destination-repository";
import { refreshAdoptionCounters } from "./replication-adoption-repository";

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

function insertMissingFile(
  db: Database.Database,
  name: string,
  size: number,
  options: { sha256: string | null; hashedAt?: string },
): number {
  const fileId = insertFile(db, name, size, "missing");
  db.prepare(
    `INSERT INTO missing_files (file_id, last_path, last_seen_at, reason)
     VALUES (?, ?, ?, 'not_found_on_scan')`,
  ).run(fileId, `C:\\archive\\${name}`, now);
  if (options.sha256 !== null) {
    db.prepare(
      "INSERT INTO hashes (file_id, sha256, hashed_at, status) VALUES (?, ?, ?, 'complete')",
    ).run(fileId, options.sha256, options.hashedAt ?? now);
  }
  return fileId;
}

function insertBackupDestination(db: Database.Database): number {
  return insertDestination(db, {
    destinationId: "dest-health",
    volumeId: "volume-2",
    volumeSerial: "SERIAL-2",
    label: "Backup",
    rootRelative: "",
    copyRootRelative: "Memory Lane/Archive",
    archiveFolderName: "Archive",
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
  }).id;
}

function addVerifiedReplica(
  db: Database.Database,
  destinationRowId: number,
  fileId: number,
  sha256: string,
): void {
  db.prepare(
    `INSERT INTO replica_files (
       replica_id, file_id, relative_path, relative_path_key, source_relative_path,
       source_relative_path_key, size_bytes, sha256, status, last_checked_at, verified_at
     ) VALUES (?, ?, 'Memory Lane/Archive/gone.jpg', 'memory lane\\archive\\gone.jpg',
       'gone.jpg', 'gone.jpg', 100, ?, 'verified', ?, ?)`,
  ).run(destinationRowId, fileId, sha256, now, now);
  refreshAdoptionCounters(db, destinationRowId);
}

describe("health repository", () => {
  it("groups exact duplicates across file types", () => {
    const db = createDb();
    const first = insertFile(db, "a.jpg", 100);
    const second = insertFile(db, "b.jpg", 100);
    const third = insertFile(db, "notes.txt", 10);
    addHash(db, first, "same");
    addHash(db, second, "same");
    addHash(db, third, "different");

    const page = getDuplicateGroups(db, 0, 10);
    expect(page).toMatchObject({ totalGroups: 1, totalFiles: 2, totalBytes: 200 });
    expect(page.groups[0]).toMatchObject({ fileCount: 2, totalBytes: 200 });
    expect(page.groups[0]?.files.map((file) => file.name).sort()).toEqual(["a.jpg", "b.jpg"]);
    db.close();
  });

  it("reads precomputed duplicate totals without rebuilding on every summary", () => {
    const db = createDb();
    const first = insertFile(db, "a.jpg", 100);
    const second = insertFile(db, "b.jpg", 100);
    addHash(db, first, "same");
    addHash(db, second, "same");

    expect(getHealthSummary(db)).toMatchObject({
      duplicateGroups: 0,
      duplicateFiles: 0,
    });
    expect(getDuplicateGroups(db, 0, 10).totalGroups).toBe(1);
    expect(getHealthSummary(db)).toMatchObject({
      duplicateGroups: 1,
      duplicateFiles: 2,
      duplicateBytes: 200,
    });
    db.close();
  });

  it("lists missing files and moved candidates", () => {
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

  it("confirms a moved candidate and updates the catalog path", () => {
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

  it("dismisses moved candidates and skips unknown targets", () => {
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

  it("summarizes an empty catalog and records the last validation", () => {
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
    expect(getMissingFiles(db, 0, 10)).toEqual({ items: [], total: 0 });
    expect(getDuplicateGroups(db, 0, 10)).toEqual({
      groups: [],
      totalGroups: 0,
      totalFiles: 0,
      totalBytes: 0,
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
    });
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

  it("finds missing exact duplicates with cleanup warnings", () => {
    const db = createDb();
    const present = insertFile(db, "keep.jpg", 100);
    addHash(db, present, "duplicate");
    const missing = insertMissingFile(db, "gone.jpg", 100, { sha256: "duplicate" });
    const destination = insertBackupDestination(db);
    addVerifiedReplica(db, destination, missing, "duplicate");
    db.prepare(
      "INSERT INTO date_overrides (file_id, year, month, created_at) VALUES (?, 2024, 6, ?)",
    ).run(missing, now);

    const page = getMissingDuplicates(db, 0, 10);
    expect(page).toMatchObject({
      total: 1,
      candidateFileIds: [missing],
      withVerifiedReplicas: 1,
      withDateOverride: 1,
    });
    expect(page.items[0]).toMatchObject({
      fileId: missing,
      name: "gone.jpg",
      duplicateFileId: present,
      duplicateName: "keep.jpg",
      hasVerifiedReplicas: true,
      hasDateOverride: true,
    });
    db.close();
  });

  it("ignores missing duplicates without a present match or trusted hash, and moved candidates", () => {
    const db = createDb();
    const present = insertFile(db, "keep.jpg", 100);
    addHash(db, present, "shared");
    insertMissingFile(db, "alone.jpg", 100, { sha256: "unique" });
    insertMissingFile(db, "changed.jpg", 100, {
      sha256: "shared",
      hashedAt: "2026-01-01T00:00:00.000Z",
    });
    const moved = insertMissingFile(db, "moved.jpg", 100, { sha256: "shared" });
    db.prepare(
      "INSERT INTO moved_candidates (file_id, old_path, new_path, sha256, state) VALUES (?, ?, ?, 'shared', 'pending')",
    ).run(moved, "C:\\archive\\moved.jpg", "C:\\archive\\moved-new.jpg");
    const noHash = insertFile(db, "nohash.jpg", 100, "missing");
    db.prepare(
      "INSERT INTO missing_files (file_id, last_path, last_seen_at, reason) VALUES (?, ?, ?, 'scan')",
    ).run(noHash, "C:\\archive\\nohash.jpg", now);
    insertMissingFile(db, "size.jpg", 200, { sha256: "shared" });

    expect(getMissingDuplicates(db, 0, 10)).toMatchObject({
      total: 0,
      candidateFileIds: [],
      withVerifiedReplicas: 0,
      withDateOverride: 0,
    });
    db.close();
  });

  it("purges only eligible missing duplicate entries and refreshes adoption counters", () => {
    const db = createDb();
    const present = insertFile(db, "keep.jpg", 100);
    addHash(db, present, "duplicate");
    const eligible = insertMissingFile(db, "gone.jpg", 100, { sha256: "duplicate" });
    const ineligible = insertMissingFile(db, "changed.jpg", 100, {
      sha256: "duplicate",
      hashedAt: "2026-01-01T00:00:00.000Z",
    });
    const destination = insertBackupDestination(db);
    addVerifiedReplica(db, destination, eligible, "duplicate");

    expect(getMissingDuplicates(db, 0, 10).total).toBe(1);
    expect(purgeMissingDuplicates(db, [eligible, ineligible, 9999])).toEqual({
      removed: 1,
      skipped: 2,
    });
    expect(db.prepare("SELECT id FROM files WHERE id = ?").get(eligible)).toBeUndefined();
    expect(db.prepare("SELECT id FROM files WHERE id = ?").get(ineligible)).toBeDefined();
    expect(db.prepare("SELECT id FROM files WHERE id = ?").get(present)).toBeDefined();
    expect(db.prepare("SELECT COUNT(*) AS count FROM replica_files").get()).toEqual({ count: 0 });
    expect(
      db
        .prepare("SELECT matched_files FROM replication_adoptions WHERE destination_id = ?")
        .get(destination),
    ).toEqual({ matched_files: 0 });
    expect(getMissingDuplicates(db, 0, 10).total).toBe(0);
    db.close();
  });
});
