import Database from "better-sqlite3";
import { toVolumeId } from "@shared/contracts/drives";
import { catalogMigrations } from "../migrations/catalog-migrations";
import { runMigrations } from "../migrations/runner";
import { ensureDriveIdentity } from "./catalog-repository";
import { rebuildDuplicateGroups } from "./health-repository";

const volumeId = toVolumeId("volume-1");

export const TEST_NOW = "2026-11-02T12:00:00.000Z";
export const TEST_ROOT_PATH = "E:\\archive";
export const TEST_QUARANTINE_ROOT = "E:\\archive\\.memorylane_quarantine";

export interface FileInput {
  path: string;
  size?: number;
  createdAt?: string;
  modifiedAt?: string;
  linkCount?: number;
  mediaClass?: "image" | "video" | "other";
}

export function createDb(): Database.Database {
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
      rootPath: "E:\\",
      letter: "E:",
    },
    12,
  );
  return db;
}

function insertFile(db: Database.Database, input: FileInput): number {
  const row = db
    .prepare(
      `INSERT INTO files (
        path, name, size, created_at_fs, modified_at_fs, link_count,
        media_class, state, last_seen_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'present', ?)
      RETURNING id`,
    )
    .get(
      input.path,
      input.path.split("\\").at(-1) ?? "file",
      input.size ?? 2048,
      input.createdAt ?? "2020-01-01T00:00:00.000Z",
      input.modifiedAt ?? "2020-01-01T00:00:00.000Z",
      input.linkCount ?? 1,
      input.mediaClass ?? "image",
      TEST_NOW,
    ) as { id: number };
  return row.id;
}

function addHash(db: Database.Database, fileId: number, sha256: string): void {
  db.prepare(
    "INSERT INTO hashes (file_id, sha256, hashed_at, status) VALUES (?, ?, ?, 'complete')",
  ).run(fileId, sha256, TEST_NOW);
}

function addOverride(db: Database.Database, fileId: number): void {
  db.prepare(
    "INSERT INTO date_overrides (file_id, year, month, created_at) VALUES (?, 2020, 1, ?)",
  ).run(fileId, TEST_NOW);
}

export function createDestination(db: Database.Database): number {
  const row = db
    .prepare(
      `INSERT INTO replica_destinations (
        destination_id, volume_id, label, replica_goal, reserve_bytes, priority, created_at, updated_at
      ) VALUES ('dest-1', 'volume-2', 'Backup A', 'extend_coverage', 1024, 1, ?, ?)
      RETURNING id`,
    )
    .get(TEST_NOW, TEST_NOW) as { id: number };
  db.prepare("INSERT INTO replication_adoptions (destination_id) VALUES (?)").run(row.id);
  return row.id;
}

function addVerifiedCoverage(
  db: Database.Database,
  destinationRowId: number,
  fileId: number,
  input: FileInput,
): void {
  const size = input.size ?? 2048;
  const modifiedAt = input.modifiedAt ?? "2020-01-01T00:00:00.000Z";
  db.prepare(
    `INSERT INTO replica_files (
      replica_id, file_id, relative_path, relative_path_key, source_relative_path,
      source_relative_path_key, size_bytes, sha256, status, verified_at,
      source_size_at_verify, source_modified_at_fs_at_verify
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'verified', ?, ?, ?)`,
  ).run(
    destinationRowId,
    fileId,
    `photos\\${fileId}.jpg`,
    `photos\\${fileId}.jpg`,
    `photos\\${fileId}.jpg`,
    `photos\\${fileId}.jpg`,
    size,
    "a".repeat(64),
    TEST_NOW,
    size,
    modifiedAt,
  );
}

export function insertGroup(
  db: Database.Database,
  sha: string,
  files: Array<{ input: FileInput; covered?: boolean; override?: boolean }>,
): number[] {
  const destination = db.prepare("SELECT id FROM replica_destinations LIMIT 1").get() as
    { id: number } | undefined;
  const destinationRowId = destination?.id ?? createDestination(db);
  const ids: number[] = [];
  for (const entry of files) {
    const fileId = insertFile(db, entry.input);
    addHash(db, fileId, sha);
    if (entry.covered === true) {
      addVerifiedCoverage(db, destinationRowId, fileId, entry.input);
    }
    if (entry.override === true) {
      addOverride(db, fileId);
    }
    ids.push(fileId);
  }
  rebuildDuplicateGroups(db);
  return ids;
}
