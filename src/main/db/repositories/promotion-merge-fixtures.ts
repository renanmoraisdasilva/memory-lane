import Database from "better-sqlite3";
import { toVolumeId } from "@shared/contracts/drives";
import { CATALOG_SCHEMA_VERSION } from "../schema-version";
import { catalogMigrations } from "../migrations/catalog-migrations";
import { runMigrations } from "../migrations/runner";
import { ensureDriveIdentity } from "./catalog-repository";
import { ensureDestinationIdentity } from "./archive-identity-repository";
import { insertDestination } from "./replication-destination-repository";
export const now = "2026-11-01T12:00:00.000Z";
export const sourceCatalogPath = "C:\\old\\.memorylane\\catalog.db";
export const destinationCatalogPath = "C:\\new\\.memorylane\\catalog.db";

export function seedSource(): Database.Database {
  const db = new Database(":memory:");
  runMigrations(db, catalogMigrations);
  ensureDriveIdentity(
    db,
    {
      volumeId: toVolumeId("volume-old"),
      serialNumber: "OLD",
      label: "Old Source",
      fileSystem: "NTFS",
      rootPath: "C:\\old",
      letter: "C:",
    },
    CATALOG_SCHEMA_VERSION,
  );
  insertSourceFiles(db);
  const partialId = insertPartialDestination(db);
  insertPromotedDestination(db, partialId);
  return db;
}

function insertSourceFiles(db: Database.Database): void {
  db.prepare(
    `UPDATE archive_identity
     SET catalog_id = 'catalog-1', label = 'Archive', role = 'source',
         source_root_relative = '', library_scope = 'whole_catalog_root',
         active_source_volume_id = 'volume-old', created_at = ?, schema_version = ?
     WHERE id = 1`,
  ).run(now, CATALOG_SCHEMA_VERSION);
  const insertFile = db.prepare(
    `INSERT INTO files (
       id, path, name, extension, size, created_at_fs, modified_at_fs, media_class,
       format, mime, state, missing_since, last_seen_at, width, height, duration_seconds,
       frame_rate, source_membership, relative_path
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, 'source', NULL)`,
  );
  insertFile.run(
    1,
    "C:\\old\\photos\\a.jpg",
    "a.jpg",
    "jpg",
    10,
    now,
    now,
    "image",
    "jpeg",
    "image/jpeg",
    "present",
    null,
    now,
  );
  insertFile.run(
    2,
    "C:\\old\\notes\\b.txt",
    "b.txt",
    "txt",
    20,
    now,
    now,
    "other",
    null,
    "text/plain",
    "present",
    null,
    now,
  );
  insertFile.run(
    3,
    "C:\\old\\photos\\c.jpg",
    "c.jpg",
    "jpg",
    30,
    now,
    now,
    "image",
    "jpeg",
    "image/jpeg",
    "missing",
    now,
    now,
  );
  insertFile.run(
    4,
    "C:\\old\\photos\\d.jpg",
    "d.jpg",
    "jpg",
    40,
    now,
    now,
    "image",
    "jpeg",
    "image/jpeg",
    "present",
    null,
    now,
  );
  db.prepare(
    `INSERT INTO files (
       path, name, extension, size, created_at_fs, modified_at_fs, media_class,
       state, last_seen_at, source_membership, relative_path
     ) VALUES ('C:\\old\\local-only.jpg', 'local-only.jpg', 'jpg', 5, ?, ?, 'image',
       'present', ?, 'local_only', NULL)`,
  ).run(now, now, now);
  insertSourceDetails(db);
}

function insertSourceDetails(db: Database.Database): void {
  db.prepare(
    `INSERT INTO hashes (file_id, sha256, hashed_at, status, source_size_at_hash, source_modified_at_fs_at_hash)
     VALUES (1, ?, ?, 'complete', 10, ?)`,
  ).run("a".repeat(64), now, now);
  db.prepare(
    `INSERT INTO file_dates (file_id, resolved_date, precision, source, confidence, original_value, is_override)
     VALUES (1, '1999-07-01T00:00:00', 'month', 'user', 1, '1999-07', 1)`,
  ).run();
  db.prepare(
    `INSERT INTO date_overrides (file_id, year, month, created_at, reverted_at)
     VALUES (1, 1999, 7, ?, NULL)`,
  ).run(now);
  db.prepare(
    "INSERT INTO file_metadata (file_id, key, value, source, extracted_at) VALUES (1, 'camera', 'X', 'exif', ?)",
  ).run(now);
  const group = db
    .prepare(
      "INSERT INTO duplicate_groups (sha256, file_count, total_bytes) VALUES (?, 2, 20) RETURNING id",
    )
    .get("a".repeat(64)) as { id: number };
  db.prepare("INSERT INTO duplicate_members (group_id, file_id) VALUES (?, 1)").run(group.id);
  db.prepare("INSERT INTO duplicate_members (group_id, file_id) VALUES (?, 2)").run(group.id);
  db.prepare(
    "INSERT INTO missing_files (file_id, last_path, last_seen_at, reason) VALUES (3, 'C:\\old\\photos\\c.jpg', ?, 'missing')",
  ).run(now);
}

function insertPartialDestination(db: Database.Database): number {
  const partial = insertDestination(db, {
    destinationId: "dest-partial",
    volumeId: "volume-partial",
    volumeSerial: "PARTIAL",
    label: "Backup B",
    rootRelative: "",
    copyRootRelative: "Memory Lane/Archive",
    archiveFolderName: "Archive",
    goal: "extend_coverage",
    layout: "dedicated",
    localCatalogId: "local-partial",
    localCatalogRelative: ".memorylane/catalog.db",
    sourceIndexRelative: null,
    allocationMode: "all_safe",
    allocationPercent: null,
    allocationBytes: null,
    reserveBytes: 0,
    priority: 0,
    identityConfidence: "confirmed",
    now,
  });
  return partial.id;
}

function insertPromotedDestination(db: Database.Database, partialId: number): void {
  const promoted = insertDestination(db, {
    destinationId: "dest-full",
    volumeId: "volume-new",
    volumeSerial: "NEW",
    label: "Backup A",
    rootRelative: "",
    copyRootRelative: null,
    archiveFolderName: null,
    goal: "full_copy",
    layout: "mirror_source",
    localCatalogId: "local-1",
    localCatalogRelative: ".memorylane/catalog.db",
    sourceIndexRelative: null,
    allocationMode: "all_safe",
    allocationPercent: null,
    allocationBytes: null,
    reserveBytes: 0,
    priority: 1,
    identityConfidence: "confirmed",
    now,
  });
  db.prepare(
    `INSERT INTO replica_files (
       replica_id, file_id, relative_path, relative_path_key, source_relative_path,
       source_relative_path_key, size_bytes, sha256, status, destination_size_at_verify,
       destination_modified_at_fs_at_verify, discovered_at, copied_at, verified_at,
       last_checked_at
     ) VALUES (?, 1, 'photos\\a.jpg', 'photos\\a.jpg', 'photos\\a.jpg', 'photos\\a.jpg',
       10, ?, 'verified', 10, ?, ?, ?, ?, ?)`,
  ).run(promoted.id, "a".repeat(64), now, now, now, now, now);
  db.prepare(
    `INSERT INTO replica_files (
       replica_id, file_id, relative_path, relative_path_key, source_relative_path,
       source_relative_path_key, size_bytes, sha256, status, destination_size_at_verify,
       destination_modified_at_fs_at_verify, discovered_at, copied_at, verified_at,
       last_checked_at
     ) VALUES (?, 2, 'notes\\b.txt', 'notes\\b.txt', 'notes\\b.txt', 'notes\\b.txt',
       20, NULL, 'discovered', 20, ?, ?, NULL, NULL, ?)`,
  ).run(promoted.id, now, now, now);
  db.prepare(
    `INSERT INTO replica_files (
       replica_id, file_id, relative_path, relative_path_key, source_relative_path,
       source_relative_path_key, size_bytes, sha256, status, destination_size_at_verify,
       destination_modified_at_fs_at_verify, discovered_at, copied_at, verified_at,
       last_checked_at
     ) VALUES (?, 4, 'photos\\d.jpg', 'photos\\d.jpg', 'photos\\d.jpg', 'photos\\d.jpg',
       40, NULL, 'discovered', 40, ?, ?, NULL, NULL, ?)`,
  ).run(promoted.id, now, now, now);
  db.prepare(
    `INSERT INTO replica_files (
       replica_id, file_id, relative_path, relative_path_key, source_relative_path,
       source_relative_path_key, size_bytes, sha256, status, destination_size_at_verify,
       destination_modified_at_fs_at_verify, discovered_at, copied_at, verified_at,
       last_checked_at
     ) VALUES (?, 1, 'Memory Lane\\Archive\\photos\\a.jpg', 'memory lane\\archive\\photos\\a.jpg',
       'photos\\a.jpg', 'photos\\a.jpg', 10, ?, 'verified', 10, ?, ?, ?, ?, ?)`,
  ).run(partialId, "a".repeat(64), now, now, now, now, now);
  db.prepare(
    `INSERT INTO replica_orphans (
       replica_id, relative_path, relative_path_key, size_bytes, sha256, modified_at_fs,
       classification, matched_source_count, status, discovered_at, last_checked_at
     ) VALUES (?, 'extra.txt', 'extra.txt', 5, NULL, ?, 'extra', 0, 'present', ?, ?)`,
  ).run(partialId, now, now, now);
  db.prepare(
    `INSERT INTO replica_files (
       replica_id, file_id, relative_path, relative_path_key, source_relative_path,
       source_relative_path_key, size_bytes, sha256, status, destination_size_at_verify,
       destination_modified_at_fs_at_verify, discovered_at, copied_at, verified_at,
       last_checked_at
     ) VALUES (?, 5, 'local-only.jpg', 'local-only.jpg', 'local-only.jpg', 'local-only.jpg',
       5, ?, 'verified', 5, ?, ?, ?, ?, ?)`,
  ).run(partialId, "e".repeat(64), now, now, now, now, now);
  db.prepare(
    `INSERT INTO replica_files (
       replica_id, file_id, relative_path, relative_path_key, source_relative_path,
       source_relative_path_key, size_bytes, sha256, status, destination_size_at_verify,
       destination_modified_at_fs_at_verify, discovered_at, copied_at, verified_at,
       last_checked_at
     ) VALUES (?, 5, 'local-only.jpg', 'local-only.jpg', 'local-only.jpg', 'local-only.jpg',
       5, ?, 'verified', 5, ?, ?, ?, ?, ?)`,
  ).run(promoted.id, "e".repeat(64), now, now, now, now, now);
}

export function seedDestination(): Database.Database {
  const db = new Database(":memory:");
  runMigrations(db, catalogMigrations);
  ensureDriveIdentity(
    db,
    {
      volumeId: toVolumeId("volume-new"),
      serialNumber: "NEW",
      label: "Backup A",
      fileSystem: "NTFS",
      rootPath: "C:\\new",
      letter: "C:",
    },
    CATALOG_SCHEMA_VERSION,
  );
  ensureDestinationIdentity(db, {
    catalogId: "local-1",
    sourceCatalogId: "catalog-1",
    sourceLabel: "Archive",
    label: "Backup A",
    now,
    schemaVersion: CATALOG_SCHEMA_VERSION,
  });
  db.prepare(
    `INSERT INTO files (path, name, size, state, last_seen_at, source_membership, relative_path)
     VALUES ('C:\\new\\Outside.txt', 'Outside.txt', 5, 'present', ?, 'local_only', 'Outside.txt')`,
  ).run(now);
  db.prepare(
    `INSERT INTO files (path, name, size, state, last_seen_at, source_membership, relative_path)
     VALUES ('C:\\new\\photos\\a.jpg', 'a.jpg', 10, 'present', ?, 'local_only', 'photos\\a.jpg')`,
  ).run(now);
  db.prepare("INSERT INTO duplicate_groups (sha256, file_count, total_bytes) VALUES (?, 0, 0)").run(
    "a".repeat(64),
  );
  return db;
}
