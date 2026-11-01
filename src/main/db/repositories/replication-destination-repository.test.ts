import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { CATALOG_SCHEMA_VERSION } from "../schema-version";
import { catalogMigrations } from "../migrations/catalog-migrations";
import { runMigrations } from "../migrations/runner";
import { ensureDriveIdentity } from "./catalog-repository";
import {
  findDestinationByDestinationId,
  findDestinationByVolume,
  getDestination,
  insertDestination,
  listDestinations,
  nextDestinationPriority,
  updateDestination,
} from "./replication-destination-repository";

const now = "2026-11-01T12:00:00.000Z";

function createDb(): Database.Database {
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
  return db;
}

function insertFile(db: Database.Database, state: "present" | "missing" = "present"): number {
  const row = db
    .prepare(
      `INSERT INTO files (path, name, size, modified_at_fs, state, last_seen_at)
       VALUES (?, 'a.jpg', 100, ?, ?, ?) RETURNING id`,
    )
    .get(`E:\\photos\\${state}-${Math.random()}.jpg`, now, state, now) as { id: number };
  return row.id;
}

function insertDestinationRow(db: Database.Database) {
  return insertDestination(db, {
    destinationId: "dest-1",
    volumeId: "volume-2",
    volumeSerial: "SERIAL-2",
    label: "Backup A",
    rootRelative: "",
    copyRootRelative: "Memory Lane/4TB Archive",
    archiveFolderName: "4TB Archive",
    goal: "extend_coverage",
    layout: "dedicated",
    localCatalogId: "local-1",
    localCatalogRelative: ".memorylane/catalog.db",
    sourceIndexRelative: ".memorylane/replicas/source/index.db",
    allocationMode: "all_safe",
    allocationPercent: null,
    allocationBytes: null,
    reserveBytes: 1024,
    priority: nextDestinationPriority(db),
    identityConfidence: "confirmed",
    now,
  });
}

describe("replication destination repository", () => {
  it("inserts, lists, finds, and updates destinations", () => {
    const db = createDb();
    const created = insertDestinationRow(db);

    expect(created).toMatchObject({
      destinationId: "dest-1",
      label: "Backup A",
      goal: "extend_coverage",
      priority: 0,
      status: "active",
    });
    expect(listDestinations(db)).toHaveLength(1);
    expect(findDestinationByDestinationId(db, "dest-1")?.id).toBe(created.id);
    expect(findDestinationByDestinationId(db, "missing")).toBeNull();

    const updated = updateDestination(db, created.id, {
      goal: "full_copy",
      allocationMode: "percent",
      allocationPercent: 50,
      priority: 3,
    });
    expect(updated).toMatchObject({
      goal: "full_copy",
      allocationMode: "percent",
      allocationPercent: 50,
      priority: 3,
    });
    expect(getDestination(db, created.id).goal).toBe("full_copy");

    const fullyUpdated = updateDestination(db, created.id, {
      goal: "extend_coverage",
      allocationMode: "fixed",
      allocationPercent: null,
      allocationBytes: 8192,
      reserveBytes: 512,
      priority: 1,
      layout: "mirror_source",
      status: "retired",
    });
    expect(fullyUpdated).toMatchObject({
      goal: "extend_coverage",
      allocationMode: "fixed",
      allocationPercent: null,
      allocationBytes: 8192,
      reserveBytes: 512,
      priority: 1,
      layout: "mirror_source",
      status: "retired",
    });

    const unchanged = updateDestination(db, created.id, {});
    expect(unchanged).toMatchObject({
      goal: "extend_coverage",
      allocationMode: "fixed",
      allocationBytes: 8192,
      status: "retired",
    });
    expect(() => getDestination(db, 999)).toThrow();
    expect(findDestinationByVolume(db, "volume-2")?.id).toBe(created.id);
    expect(findDestinationByVolume(db, "volume-3")).toBeNull();
    db.close();
  });

  it("counts verified, orphan, and source-missing replicas", () => {
    const db = createDb();
    const destination = insertDestinationRow(db);
    const presentFile = insertFile(db);
    const missingFile = insertFile(db, "missing");

    db.prepare(
      `INSERT INTO replica_files (
        replica_id, file_id, relative_path, relative_path_key, source_relative_path,
        source_relative_path_key, size_bytes, sha256, status, verified_at
      ) VALUES (?, ?, 'a.jpg', 'a.jpg', 'photos/a.jpg', 'photos/a.jpg', 100, 'abc', 'verified', ?)`,
    ).run(destination.id, presentFile, now);
    db.prepare(
      `INSERT INTO replica_files (
        replica_id, file_id, relative_path, relative_path_key, source_relative_path,
        source_relative_path_key, size_bytes, sha256, status, verified_at
      ) VALUES (?, ?, 'b.jpg', 'b.jpg', 'photos/b.jpg', 'photos/b.jpg', 100, 'def', 'verified', ?)`,
    ).run(destination.id, missingFile, now);
    db.prepare(
      `INSERT INTO replica_orphans (
        replica_id, relative_path, relative_path_key, size_bytes, classification,
        discovered_at
      ) VALUES (?, 'extra.jpg', 'extra.jpg', 50, 'extra', ?)`,
    ).run(destination.id, now);

    const record = getDestination(db, destination.id);
    expect(record).toMatchObject({
      verifiedFiles: 2,
      verifiedBytes: 200,
      onlyOnDriveFiles: 1,
      onlyOnDriveBytes: 50,
      sourceMissingFiles: 1,
      sourceMissingBytes: 100,
      lastVerifiedAt: now,
    });
    db.close();
  });
});
