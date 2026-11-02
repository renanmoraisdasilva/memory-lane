import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { catalogMigrations } from "../migrations/catalog-migrations";
import { runMigrations } from "../migrations/runner";
import { ensureDriveIdentity } from "./catalog-repository";
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

describe("health missing duplicates repository", () => {
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
      readyFileIds: [missing],
      withPendingMoves: 0,
      pendingMovedCandidates: 0,
      withVerifiedReplicas: 1,
      withDateOverride: 1,
    });
    expect(page.items[0]).toMatchObject({
      fileId: missing,
      name: "gone.jpg",
      duplicateFileId: present,
      duplicateName: "keep.jpg",
      pendingMovedCandidates: 0,
      hasVerifiedReplicas: true,
      hasDateOverride: true,
    });

    db.prepare("UPDATE missing_files SET dismissed_at = ? WHERE file_id = ?").run(now, missing);
    expect(getMissingDuplicates(db, 0, 10).total).toBe(0);
    db.close();
  });

  it("ignores missing duplicates without a present match or trusted hash, and flags pending moves", () => {
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
      total: 1,
      candidateFileIds: [moved],
      readyFileIds: [],
      withPendingMoves: 1,
      pendingMovedCandidates: 1,
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
      dismissedMovedCandidates: 0,
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
    db.close();
  });

  it("removes pending-move duplicates only when explicitly included", () => {
    const db = createDb();
    const present = insertFile(db, "keep.jpg", 100);
    addHash(db, present, "shared");
    const missing = insertMissingFile(db, "moved.jpg", 100, { sha256: "shared" });
    const insertCandidate = db.prepare(
      "INSERT INTO moved_candidates (file_id, old_path, new_path, sha256, state) VALUES (?, ?, ?, 'shared', 'pending')",
    );
    insertCandidate.run(missing, "C:\\archive\\moved.jpg", "C:\\archive\\one.jpg");
    insertCandidate.run(missing, "C:\\archive\\moved.jpg", "C:\\archive\\two.jpg");

    expect(getMissingDuplicates(db, 0, 10)).toMatchObject({
      total: 1,
      candidateFileIds: [missing],
      readyFileIds: [],
      withPendingMoves: 1,
      pendingMovedCandidates: 2,
    });
    expect(getMissingDuplicates(db, 0, 10).items[0]?.pendingMovedCandidates).toBe(2);
    expect(purgeMissingDuplicates(db, [missing], false)).toEqual({
      removed: 0,
      skipped: 1,
      dismissedMovedCandidates: 0,
    });
    expect(db.prepare("SELECT id FROM files WHERE id = ?").get(missing)).toBeDefined();
    expect(purgeMissingDuplicates(db, [missing], true)).toEqual({
      removed: 1,
      skipped: 0,
      dismissedMovedCandidates: 2,
    });
    expect(db.prepare("SELECT id FROM files WHERE id = ?").get(missing)).toBeUndefined();
    expect(db.prepare("SELECT id FROM files WHERE id = ?").get(present)).toBeDefined();
    expect(db.prepare("SELECT COUNT(*) AS count FROM moved_candidates").get()).toEqual({
      count: 0,
    });
    db.close();
  });
});
