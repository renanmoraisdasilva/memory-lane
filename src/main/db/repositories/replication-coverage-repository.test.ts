import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { CATALOG_SCHEMA_VERSION } from "../schema-version";
import { catalogMigrations } from "../migrations/catalog-migrations";
import { runMigrations } from "../migrations/runner";
import { ensureDriveIdentity } from "./catalog-repository";
import { insertDestination, nextDestinationPriority } from "./replication-destination-repository";
import {
  getCoverageSummary,
  getDestinationCoverageMap,
  getDestinationOverlapBytes,
  getDestinationReplicaHealth,
  getOverlapBytes,
  listVerifiedCoverage,
} from "./replication-coverage-repository";

const now = "2026-11-01T12:00:00.000Z";

function createFile(
  db: Database.Database,
  id: number,
  size: number,
  state: "present" | "missing" = "present",
): void {
  db.prepare(
    `INSERT INTO files (id, path, name, size, state, last_seen_at, source_membership)
     VALUES (?, ?, ?, ?, ?, ?, 'source')`,
  ).run(id, `E:\\photos\\${String(id)}.jpg`, `${String(id)}.jpg`, size, state, now);
}

function insertDestinationRow(db: Database.Database, destinationId: string) {
  return insertDestination(db, {
    destinationId,
    volumeId: `volume-${destinationId}`,
    volumeSerial: null,
    label: destinationId,
    rootRelative: "",
    copyRootRelative: null,
    archiveFolderName: null,
    goal: "extend_coverage",
    layout: "dedicated",
    localCatalogId: null,
    localCatalogRelative: null,
    sourceIndexRelative: null,
    allocationMode: "all_safe",
    allocationPercent: null,
    allocationBytes: null,
    reserveBytes: 0,
    priority: nextDestinationPriority(db),
    identityConfidence: "confirmed",
    now,
  });
}

function insertReplica(
  db: Database.Database,
  input: {
    replicaId: number;
    fileId: number;
    status: string;
    sha256: string | null;
    size: number;
  },
): void {
  const path = `${String(input.fileId)}.jpg`;
  db.prepare(
    `INSERT INTO replica_files (
       replica_id, file_id, relative_path, relative_path_key, source_relative_path,
       source_relative_path_key, size_bytes, sha256, status, verified_at,
       source_size_at_verify, source_modified_at_fs_at_verify
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
  ).run(
    input.replicaId,
    input.fileId,
    path,
    path,
    path,
    path,
    input.size,
    input.sha256,
    input.status,
    now,
    input.size,
  );
}

describe("replication coverage repository", () => {
  it("reports full coverage percentages for an empty catalog", () => {
    const db = new Database(":memory:");
    runMigrations(db, catalogMigrations);

    const summary = getCoverageSummary(db);

    expect(summary.sourceFiles).toBe(0);
    expect(summary.sourceBytes).toBe(0);
    expect(summary.partialPercent).toBe(100);
    expect(summary.allDestinationPercent).toBe(100);
    expect(summary.coverageAsOf).toBeNull();
    db.close();
  });

  it("computes destination coverage, overlap, coverage map, and health", () => {
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
    createFile(db, 1, 10);
    createFile(db, 2, 20);
    createFile(db, 3, 30, "missing");
    createFile(db, 4, 40);
    createFile(db, 5, 50);
    createFile(db, 6, 60);
    db.prepare(
      `INSERT INTO file_dates (file_id, resolved_date, precision)
       VALUES (1, '2011-07-04T15:30:00.000Z', 'exact'),
              (2, '2012-01-01T00:00:00.000Z', 'year')`,
    ).run();
    const first = insertDestinationRow(db, "dest-1");
    const second = insertDestinationRow(db, "dest-2");
    const third = insertDestinationRow(db, "dest-3");
    insertReplica(db, {
      replicaId: first.id,
      fileId: 1,
      size: 10,
      status: "verified",
      sha256: "a".repeat(64),
    });
    insertReplica(db, {
      replicaId: first.id,
      fileId: 2,
      size: 20,
      status: "verified",
      sha256: "b".repeat(64),
    });
    insertReplica(db, {
      replicaId: first.id,
      fileId: 3,
      size: 30,
      status: "verified",
      sha256: "c".repeat(64),
    });
    insertReplica(db, {
      replicaId: first.id,
      fileId: 4,
      size: 40,
      status: "conflict",
      sha256: "d".repeat(64),
    });
    insertReplica(db, {
      replicaId: first.id,
      fileId: 5,
      size: 50,
      status: "stale",
      sha256: "e".repeat(64),
    });
    insertReplica(db, {
      replicaId: first.id,
      fileId: 6,
      size: 60,
      status: "missing",
      sha256: null,
    });
    insertReplica(db, {
      replicaId: second.id,
      fileId: 2,
      size: 20,
      status: "verified",
      sha256: "b".repeat(64),
    });

    const coverage = listVerifiedCoverage(db);
    expect(coverage).toEqual([
      {
        destinationRowId: first.id,
        verifiedFileIds: new Set([1, 2]),
        verifiedBytes: 30,
        lastVerifiedAt: now,
      },
      {
        destinationRowId: second.id,
        verifiedFileIds: new Set([2]),
        verifiedBytes: 20,
        lastVerifiedAt: now,
      },
    ]);
    expect(getDestinationCoverageMap(db, first.id)).toEqual([
      { year: 2011, month: 7, count: 1 },
      { year: 2012, month: 1, count: 1 },
    ]);
    expect(getDestinationReplicaHealth(db, first.id)).toEqual({
      conflictFiles: 1,
      staleFiles: 1,
      missingFiles: 1,
    });
    expect(getDestinationCoverageMap(db, third.id)).toEqual([]);
    expect(getDestinationReplicaHealth(db, third.id)).toEqual({
      conflictFiles: 0,
      staleFiles: 0,
      missingFiles: 0,
    });
    expect(getDestinationOverlapBytes(db, third.id)).toBe(0);
    expect(getOverlapBytes(db)).toBe(20);
    expect(getDestinationOverlapBytes(db, first.id)).toBe(20);
    expect(getDestinationOverlapBytes(db, second.id)).toBe(20);
    expect(getCoverageSummary(db)).toEqual({
      sourceFiles: 5,
      sourceBytes: 180,
      partialFiles: 2,
      partialBytes: 30,
      partialPercent: 40,
      partialRemainderFiles: 3,
      partialRemainderBytes: 150,
      fullCopyFiles: 0,
      fullCopyBytes: 0,
      allDestinationFiles: 2,
      allDestinationBytes: 30,
      allDestinationPercent: 40,
      overlapBytes: 20,
      coverageAsOf: now,
    });

    db.prepare("UPDATE files SET size = 21 WHERE id = 2").run();
    expect(listVerifiedCoverage(db)[0]?.verifiedFileIds).toEqual(new Set([1]));
    expect(getOverlapBytes(db)).toBe(0);
    db.close();
  });
});
