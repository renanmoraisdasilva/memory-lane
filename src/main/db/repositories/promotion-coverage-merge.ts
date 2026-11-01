import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { PromotionOldSourceFate } from "@shared/contracts/replication/types";
import { relativePathKey } from "../../platform/destination-path-policy";
import { refreshAdoptionCounters } from "./replication-adoption-repository";
import { nextDestinationPriority } from "./replication-destination-repository";

export interface PromotionOldDrive {
  volumeId: string;
  serialNumber: string | null;
  label: string;
  fileSystem: string;
}

export interface PromotionCoverageInput {
  source: Database.Database;
  destination: Database.Database;
  fileIdMap: Map<number, number>;
  promotedDestinationRowId: number;
  promotedDestinationKey: string;
  oldDrive: PromotionOldDrive;
  oldCatalogId: string;
  oldSourceRootRelative: string;
  oldSourceFits: boolean;
  oldSourceFate: PromotionOldSourceFate;
  partialFates: Array<{ destinationId: string; keep: boolean }>;
  now: string;
}

interface SourceReplicaFile {
  fileId: number;
  sourceRelativePath: string;
  relativePath: string;
  sizeBytes: number;
  sha256: string | null;
  sourceModifiedAtFs: string | null;
}

function sourcePresentFiles(input: PromotionCoverageInput): SourceReplicaFile[] {
  const rows = input.source
    .prepare(
      `SELECT rf.file_id, rf.source_relative_path, rf.relative_path, rf.size_bytes, rf.sha256,
              f.modified_at_fs AS source_modified_at_fs
       FROM replica_files rf
       JOIN files f ON f.id = rf.file_id
       WHERE rf.replica_id = ? AND rf.status = 'verified' AND f.state = 'present'`,
    )
    .all(input.promotedDestinationRowId) as Array<{
    file_id: number;
    source_relative_path: string;
    relative_path: string;
    size_bytes: number;
    sha256: string | null;
    source_modified_at_fs: string | null;
  }>;
  return rows.map((row) => ({
    fileId: row.file_id,
    sourceRelativePath: row.source_relative_path,
    relativePath: row.relative_path,
    sizeBytes: row.size_bytes,
    sha256: row.sha256,
    sourceModifiedAtFs: row.source_modified_at_fs,
  }));
}

function clearCoverage(destination: Database.Database): void {
  destination.exec(`
    DELETE FROM replica_files;
    DELETE FROM replica_orphans;
    DELETE FROM replication_adoptions;
    DELETE FROM replica_destinations;
    DELETE FROM replication_run_events;
    DELETE FROM replication_runs;
    DELETE FROM source_promotions;
  `);
}

interface DestinationRow {
  id: number;
  destination_id: string;
  volume_id: string;
  volume_serial: string | null;
  label: string;
  root_relative: string;
  copy_root_relative: string | null;
  archive_folder_name: string | null;
  replica_goal: "extend_coverage" | "full_copy";
  replica_layout: "dedicated" | "mirror_source";
  local_catalog_id: string | null;
  local_catalog_relative: string | null;
  source_index_relative: string | null;
  source_index_updated_at: string | null;
  allocation_mode: "all_safe" | "percent" | "fixed";
  allocation_percent: number | null;
  allocation_bytes: number | null;
  reserve_bytes: number;
  priority: number;
  status: "active" | "retired" | "lost";
  identity_confidence: "confirmed" | "probable" | "needs_confirmation";
  full_copy_status: "not_applicable" | "in_progress" | "complete" | "incomplete";
  full_copy_shortfall_bytes: number;
  full_copy_shortfall_files: number;
  last_seen_at: string | null;
  last_capacity_bytes: number | null;
  last_free_bytes: number | null;
}

function copyDestinationRow(
  destination: Database.Database,
  old: DestinationRow,
  input: PromotionCoverageInput,
  goal: DestinationRow["replica_goal"],
): number {
  const fate = input.partialFates.find((item) => item.destinationId === old.destination_id);
  const status =
    fate !== undefined && !fate.keep ? "retired" : old.status === "lost" ? "lost" : old.status;
  const row = destination
    .prepare(
      `INSERT INTO replica_destinations (
         destination_id, volume_id, volume_serial, label, root_relative, copy_root_relative,
         archive_folder_name, replica_goal, replica_layout, local_catalog_id,
         local_catalog_relative, source_index_relative, source_index_updated_at,
         allocation_mode, allocation_percent, allocation_bytes, reserve_bytes, priority,
         status, identity_confidence, full_copy_status, full_copy_shortfall_bytes,
         full_copy_shortfall_files, last_seen_at, last_capacity_bytes, last_free_bytes,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
    )
    .get(
      old.destination_id,
      old.volume_id,
      old.volume_serial,
      old.label,
      old.root_relative,
      old.copy_root_relative,
      old.archive_folder_name,
      goal,
      old.replica_layout,
      old.local_catalog_id,
      old.local_catalog_relative,
      old.source_index_relative,
      old.source_index_updated_at,
      old.allocation_mode,
      old.allocation_percent,
      old.allocation_bytes,
      old.reserve_bytes,
      old.priority,
      status,
      old.identity_confidence,
      old.full_copy_status,
      old.full_copy_shortfall_bytes,
      old.full_copy_shortfall_files,
      old.last_seen_at,
      old.last_capacity_bytes,
      old.last_free_bytes,
      input.now,
      input.now,
    ) as { id: number };
  destination.prepare("INSERT INTO replication_adoptions (destination_id) VALUES (?)").run(row.id);
  return row.id;
}

function copyReplicaFiles(input: {
  source: Database.Database;
  destination: Database.Database;
  oldReplicaId: number;
  newReplicaId: number;
  fileIdMap: Map<number, number>;
}): void {
  const { source, destination } = input;
  const rows = source
    .prepare("SELECT * FROM replica_files WHERE replica_id = ?")
    .all(input.oldReplicaId) as Array<Record<string, unknown>>;
  const insert = destination.prepare(
    `INSERT OR REPLACE INTO replica_files (
       replica_id, file_id, relative_path, relative_path_key, source_relative_path,
       source_relative_path_key, size_bytes, sha256, status, source_size_at_verify,
       source_modified_at_fs_at_verify, destination_size_at_verify,
       destination_modified_at_fs_at_verify, discovered_at, copied_at, verified_at,
       last_checked_at, last_error
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const row of rows) {
    const oldFileId = Number(row.file_id);
    const fileId = input.fileIdMap.get(oldFileId);
    if (fileId === undefined) {
      continue;
    }
    insert.run(
      input.newReplicaId,
      fileId,
      row.relative_path,
      row.relative_path_key,
      row.source_relative_path,
      row.source_relative_path_key,
      row.size_bytes,
      row.sha256,
      row.status,
      row.source_size_at_verify,
      row.source_modified_at_fs_at_verify,
      row.destination_size_at_verify,
      row.destination_modified_at_fs_at_verify,
      row.discovered_at,
      row.copied_at,
      row.verified_at,
      row.last_checked_at,
      row.last_error,
    );
  }
}

function copyOrphans(
  source: Database.Database,
  destination: Database.Database,
  oldReplicaId: number,
  newReplicaId: number,
): void {
  const rows = source
    .prepare("SELECT * FROM replica_orphans WHERE replica_id = ?")
    .all(oldReplicaId) as Array<Record<string, unknown>>;
  const insert = destination.prepare(
    `INSERT OR REPLACE INTO replica_orphans (
       replica_id, relative_path, relative_path_key, size_bytes, sha256, modified_at_fs,
       classification, matched_source_count, status, discovered_at, last_checked_at, last_error
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const row of rows) {
    insert.run(
      newReplicaId,
      row.relative_path,
      row.relative_path_key,
      row.size_bytes,
      row.sha256,
      row.modified_at_fs,
      row.classification,
      row.matched_source_count,
      row.status,
      row.discovered_at,
      row.last_checked_at,
      row.last_error,
    );
  }
}

function oldSourceGoal(input: PromotionCoverageInput): DestinationRow["replica_goal"] {
  if (input.oldSourceFate === "extend_coverage") {
    return "extend_coverage";
  }
  return input.oldSourceFits ? "full_copy" : "extend_coverage";
}

function oldSourceFullCopyStatus(
  goal: DestinationRow["replica_goal"],
): DestinationRow["full_copy_status"] {
  return goal === "full_copy" ? "complete" : "not_applicable";
}

function insertOldSourceReplica(
  input: PromotionCoverageInput,
  replicaId: number,
  file: SourceReplicaFile,
  insert: Database.Statement,
): void {
  const fileId = input.fileIdMap.get(file.fileId);
  if (fileId === undefined) {
    return;
  }
  const key = relativePathKey(file.sourceRelativePath);
  insert.run(
    replicaId,
    fileId,
    file.sourceRelativePath,
    key,
    file.sourceRelativePath,
    key,
    file.sizeBytes,
    file.sha256,
    "verified",
    file.sizeBytes,
    file.sourceModifiedAtFs,
    file.sizeBytes,
    file.sourceModifiedAtFs,
    input.now,
    input.now,
    input.now,
    input.now,
  );
}

function insertOldSourceDestination(
  input: PromotionCoverageInput,
  presentFiles: SourceReplicaFile[],
): number {
  const goal = oldSourceGoal(input);
  const status = input.oldSourceFate === "retire" ? "retired" : "active";
  const fullCopyStatus = oldSourceFullCopyStatus(goal);
  const priority = nextDestinationPriority(input.destination);
  const row = input.destination
    .prepare(
      `INSERT INTO replica_destinations (
         destination_id, volume_id, volume_serial, label, root_relative, copy_root_relative,
         archive_folder_name, replica_goal, replica_layout, local_catalog_id,
         local_catalog_relative, source_index_relative, source_index_updated_at,
         allocation_mode, allocation_percent, allocation_bytes, reserve_bytes, priority,
         status, identity_confidence, full_copy_status, full_copy_shortfall_bytes,
         full_copy_shortfall_files, last_seen_at, last_capacity_bytes, last_free_bytes,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, 'mirror_source', ?, '.memorylane/catalog.db',
         NULL, NULL, 'all_safe', NULL, NULL, 0, ?, ?, 'confirmed', ?, 0, 0, ?, NULL, NULL, ?, ?)
       RETURNING id`,
    )
    .get(
      randomUUID(),
      input.oldDrive.volumeId,
      input.oldDrive.serialNumber,
      input.oldDrive.label,
      input.oldSourceRootRelative,
      goal,
      input.oldCatalogId,
      priority,
      status,
      fullCopyStatus,
      input.now,
      input.now,
      input.now,
    ) as { id: number };
  input.destination
    .prepare("INSERT INTO replication_adoptions (destination_id) VALUES (?)")
    .run(row.id);
  const insertReplica = input.destination.prepare(
    `INSERT INTO replica_files (
       replica_id, file_id, relative_path, relative_path_key, source_relative_path,
       source_relative_path_key, size_bytes, sha256, status, source_size_at_verify,
       source_modified_at_fs_at_verify, destination_size_at_verify,
       destination_modified_at_fs_at_verify, discovered_at, copied_at, verified_at,
       last_checked_at, last_error
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
  );
  for (const file of presentFiles) {
    insertOldSourceReplica(input, row.id, file, insertReplica);
  }
  refreshAdoptionCounters(input.destination, row.id);
  return row.id;
}

export function mergePromotionCoverage(input: PromotionCoverageInput): void {
  clearCoverage(input.destination);
  const presentFiles = sourcePresentFiles(input);
  const rows = input.source
    .prepare("SELECT * FROM replica_destinations ORDER BY priority ASC, id ASC")
    .all() as DestinationRow[];
  for (const row of rows) {
    if (row.id === input.promotedDestinationRowId) {
      continue;
    }
    const newId = copyDestinationRow(input.destination, row, input, row.replica_goal);
    copyReplicaFiles({
      source: input.source,
      destination: input.destination,
      oldReplicaId: row.id,
      newReplicaId: newId,
      fileIdMap: input.fileIdMap,
    });
    copyOrphans(input.source, input.destination, row.id, newId);
    refreshAdoptionCounters(input.destination, newId);
  }
  insertOldSourceDestination(input, presentFiles);
}
