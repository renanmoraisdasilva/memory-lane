import type Database from "better-sqlite3";
import { z } from "zod";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type {
  DestinationGoal,
  DestinationRecordStatus,
  FullCopyStatus,
  IdentityConfidence,
} from "@shared/contracts/replication/types";

const DestinationRowSchema = z.object({
  id: z.number().int().positive(),
  destination_id: z.string().min(1),
  volume_id: z.string().min(1),
  volume_serial: z.string().nullable(),
  label: z.string().min(1),
  root_relative: z.string(),
  copy_root_relative: z.string().nullable(),
  archive_folder_name: z.string().nullable(),
  replica_goal: z.enum(["extend_coverage", "full_copy"]),
  replica_layout: z.enum(["dedicated", "mirror_source"]),
  local_catalog_id: z.string().nullable(),
  local_catalog_relative: z.string().nullable(),
  source_index_relative: z.string().nullable(),
  source_index_updated_at: z.string().nullable(),
  allocation_mode: z.enum(["all_safe", "percent", "fixed"]),
  allocation_percent: z.number().nullable(),
  allocation_bytes: z.number().int().nonnegative().nullable(),
  reserve_bytes: z.number().int().nonnegative(),
  priority: z.number().int().nonnegative(),
  status: z.enum(["active", "retired", "lost"]),
  identity_confidence: z.enum(["confirmed", "probable", "needs_confirmation"]),
  full_copy_status: z.enum(["not_applicable", "in_progress", "complete", "incomplete"]),
  full_copy_shortfall_bytes: z.number().int().nonnegative(),
  full_copy_shortfall_files: z.number().int().nonnegative(),
  last_seen_at: z.string().nullable(),
  last_capacity_bytes: z.number().int().nonnegative().nullable(),
  last_free_bytes: z.number().int().nonnegative().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  verified_files: z.number().int().nonnegative(),
  verified_bytes: z.number().int().nonnegative(),
  only_on_drive_files: z.number().int().nonnegative(),
  only_on_drive_bytes: z.number().int().nonnegative(),
  source_missing_files: z.number().int().nonnegative(),
  source_missing_bytes: z.number().int().nonnegative(),
  last_verified_at: z.string().nullable(),
  conflict_files: z.number().int().nonnegative(),
  stale_files: z.number().int().nonnegative(),
  missing_files: z.number().int().nonnegative(),
  failed_files: z.number().int().nonnegative(),
});

export interface ReplicationDestinationRecord {
  id: number;
  destinationId: string;
  volumeId: string;
  volumeSerial: string | null;
  label: string;
  rootRelative: string;
  copyRootRelative: string | null;
  archiveFolderName: string | null;
  goal: DestinationGoal;
  layout: "dedicated" | "mirror_source";
  localCatalogId: string | null;
  localCatalogRelative: string | null;
  sourceIndexRelative: string | null;
  sourceIndexUpdatedAt: string | null;
  allocationMode: "all_safe" | "percent" | "fixed";
  allocationPercent: number | null;
  allocationBytes: number | null;
  reserveBytes: number;
  priority: number;
  status: DestinationRecordStatus;
  identityConfidence: IdentityConfidence;
  fullCopyStatus: FullCopyStatus;
  fullCopyShortfallBytes: number;
  fullCopyShortfallFiles: number;
  lastSeenAt: string | null;
  lastCapacityBytes: number | null;
  lastFreeBytes: number | null;
  createdAt: string;
  updatedAt: string;
  verifiedFiles: number;
  verifiedBytes: number;
  onlyOnDriveFiles: number;
  onlyOnDriveBytes: number;
  sourceMissingFiles: number;
  sourceMissingBytes: number;
  lastVerifiedAt: string | null;
  conflictFiles: number;
  staleFiles: number;
  missingFiles: number;
  failedFiles: number;
}

const SELECT_DESTINATION = `
  SELECT
    d.*,
    (SELECT COUNT(*) FROM replica_files rf
      WHERE rf.replica_id = d.id AND rf.status = 'verified') AS verified_files,
    (SELECT COALESCE(SUM(f.size), 0) FROM replica_files rf
      JOIN files f ON f.id = rf.file_id
      WHERE rf.replica_id = d.id AND rf.status = 'verified') AS verified_bytes,
    (SELECT COUNT(*) FROM replica_orphans o
      WHERE o.replica_id = d.id AND o.status = 'present') AS only_on_drive_files,
    (SELECT COALESCE(SUM(o.size_bytes), 0) FROM replica_orphans o
      WHERE o.replica_id = d.id AND o.status = 'present') AS only_on_drive_bytes,
    (SELECT COUNT(*) FROM replica_files rf
      JOIN files f ON f.id = rf.file_id
      WHERE rf.replica_id = d.id AND rf.status = 'verified' AND f.state = 'missing')
      AS source_missing_files,
    (SELECT COALESCE(SUM(f.size), 0) FROM replica_files rf
      JOIN files f ON f.id = rf.file_id
      WHERE rf.replica_id = d.id AND rf.status = 'verified' AND f.state = 'missing')
      AS source_missing_bytes,
    (SELECT MAX(rf.verified_at) FROM replica_files rf
      WHERE rf.replica_id = d.id AND rf.status = 'verified') AS last_verified_at,
    (SELECT COUNT(*) FROM replica_files rf
      WHERE rf.replica_id = d.id AND rf.status = 'conflict') AS conflict_files,
    (SELECT COUNT(*) FROM replica_files rf
      WHERE rf.replica_id = d.id AND rf.status = 'stale') AS stale_files,
    (SELECT COUNT(*) FROM replica_files rf
      WHERE rf.replica_id = d.id AND rf.status = 'missing') AS missing_files,
    (SELECT COUNT(*) FROM replica_files rf
      WHERE rf.replica_id = d.id AND rf.status = 'failed') AS failed_files
  FROM replica_destinations d
`;

function parseRow(row: unknown): ReplicationDestinationRecord {
  const parsed = DestinationRowSchema.safeParse(row);
  if (!parsed.success) {
    throw new AppError(APP_ERROR_CODES.DB_ERROR, "Destination row is invalid", {
      issues: parsed.error.issues,
    });
  }
  const data = parsed.data;
  return {
    id: data.id,
    destinationId: data.destination_id,
    volumeId: data.volume_id,
    volumeSerial: data.volume_serial,
    label: data.label,
    rootRelative: data.root_relative,
    copyRootRelative: data.copy_root_relative,
    archiveFolderName: data.archive_folder_name,
    goal: data.replica_goal,
    layout: data.replica_layout,
    localCatalogId: data.local_catalog_id,
    localCatalogRelative: data.local_catalog_relative,
    sourceIndexRelative: data.source_index_relative,
    sourceIndexUpdatedAt: data.source_index_updated_at,
    allocationMode: data.allocation_mode,
    allocationPercent: data.allocation_percent,
    allocationBytes: data.allocation_bytes,
    reserveBytes: data.reserve_bytes,
    priority: data.priority,
    status: data.status,
    identityConfidence: data.identity_confidence,
    fullCopyStatus: data.full_copy_status,
    fullCopyShortfallBytes: data.full_copy_shortfall_bytes,
    fullCopyShortfallFiles: data.full_copy_shortfall_files,
    lastSeenAt: data.last_seen_at,
    lastCapacityBytes: data.last_capacity_bytes,
    lastFreeBytes: data.last_free_bytes,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    verifiedFiles: data.verified_files,
    verifiedBytes: data.verified_bytes,
    onlyOnDriveFiles: data.only_on_drive_files,
    onlyOnDriveBytes: data.only_on_drive_bytes,
    sourceMissingFiles: data.source_missing_files,
    sourceMissingBytes: data.source_missing_bytes,
    lastVerifiedAt: data.last_verified_at,
    conflictFiles: data.conflict_files,
    staleFiles: data.stale_files,
    missingFiles: data.missing_files,
    failedFiles: data.failed_files,
  };
}

export interface InsertDestinationInput {
  destinationId: string;
  volumeId: string;
  volumeSerial: string | null;
  label: string;
  rootRelative: string;
  copyRootRelative: string | null;
  archiveFolderName: string | null;
  goal: DestinationGoal;
  layout: "dedicated" | "mirror_source";
  localCatalogId: string | null;
  localCatalogRelative: string | null;
  sourceIndexRelative: string | null;
  allocationMode: "all_safe" | "percent" | "fixed";
  allocationPercent: number | null;
  allocationBytes: number | null;
  reserveBytes: number;
  priority: number;
  identityConfidence: IdentityConfidence;
  now: string;
}

export interface UpdateDestinationInput {
  goal?: DestinationGoal;
  allocationMode?: "all_safe" | "percent" | "fixed";
  allocationPercent?: number | null;
  allocationBytes?: number | null;
  reserveBytes?: number;
  priority?: number;
  layout?: "dedicated" | "mirror_source";
  status?: DestinationRecordStatus;
}

export function nextDestinationPriority(db: Database.Database): number {
  const row = db
    .prepare("SELECT COALESCE(MAX(priority), -1) + 1 AS priority FROM replica_destinations")
    .get() as { priority: number } | undefined;
  return row?.priority ?? 0;
}

export function insertDestination(
  db: Database.Database,
  input: InsertDestinationInput,
): ReplicationDestinationRecord {
  const insert = db.transaction(() => {
    const row = db
      .prepare(
        `INSERT INTO replica_destinations (
          destination_id, volume_id, volume_serial, label, root_relative, copy_root_relative,
          archive_folder_name, replica_goal, replica_layout, local_catalog_id,
          local_catalog_relative, source_index_relative, allocation_mode, allocation_percent,
          allocation_bytes, reserve_bytes, priority, identity_confidence, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id`,
      )
      .get(
        input.destinationId,
        input.volumeId,
        input.volumeSerial,
        input.label,
        input.rootRelative,
        input.copyRootRelative,
        input.archiveFolderName,
        input.goal,
        input.layout,
        input.localCatalogId,
        input.localCatalogRelative,
        input.sourceIndexRelative,
        input.allocationMode,
        input.allocationPercent,
        input.allocationBytes,
        input.reserveBytes,
        input.priority,
        input.identityConfidence,
        input.now,
        input.now,
      ) as { id: number };

    db.prepare("INSERT INTO replication_adoptions (destination_id) VALUES (?)").run(row.id);
    return row.id;
  });

  return getDestination(db, insert());
}

export function listDestinations(db: Database.Database): ReplicationDestinationRecord[] {
  const rows = db.prepare(`${SELECT_DESTINATION} ORDER BY d.priority ASC, d.id ASC`).all();
  return rows.map(parseRow);
}

export function getDestination(
  db: Database.Database,
  destinationId: number,
): ReplicationDestinationRecord {
  const row = db.prepare(`${SELECT_DESTINATION} WHERE d.id = ?`).get(destinationId);
  if (row === undefined) {
    throw new AppError(APP_ERROR_CODES.DESTINATION_NOT_FOUND, "Destination was not found", {
      destinationId,
    });
  }
  return parseRow(row);
}

export function findDestinationByDestinationId(
  db: Database.Database,
  destinationId: string,
): ReplicationDestinationRecord | null {
  const row = db.prepare(`${SELECT_DESTINATION} WHERE d.destination_id = ?`).get(destinationId);
  return row === undefined ? null : parseRow(row);
}

export function findDestinationByVolume(
  db: Database.Database,
  volumeId: string,
): ReplicationDestinationRecord | null {
  const row = db
    .prepare(`${SELECT_DESTINATION} WHERE d.volume_id = ? ORDER BY d.id ASC LIMIT 1`)
    .get(volumeId);
  return row === undefined ? null : parseRow(row);
}

export function updateDestination(
  db: Database.Database,
  destinationId: number,
  input: UpdateDestinationInput,
): ReplicationDestinationRecord {
  const current = getDestination(db, destinationId);
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE replica_destinations
     SET replica_goal = ?, allocation_mode = ?, allocation_percent = ?, allocation_bytes = ?,
         reserve_bytes = ?, priority = ?, replica_layout = ?, status = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    input.goal ?? current.goal,
    input.allocationMode ?? current.allocationMode,
    input.allocationPercent === undefined ? current.allocationPercent : input.allocationPercent,
    input.allocationBytes === undefined ? current.allocationBytes : input.allocationBytes,
    input.reserveBytes ?? current.reserveBytes,
    input.priority ?? current.priority,
    input.layout ?? current.layout,
    input.status ?? current.status,
    now,
    destinationId,
  );
  return getDestination(db, destinationId);
}

export function updateFullCopyStatus(
  db: Database.Database,
  destinationId: number,
  input: {
    status: FullCopyStatus;
    shortfallFiles: number;
    shortfallBytes: number;
    now: string;
  },
): void {
  db.prepare(
    `UPDATE replica_destinations
     SET full_copy_status = ?, full_copy_shortfall_files = ?, full_copy_shortfall_bytes = ?,
         last_full_copy_check_at = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    input.status,
    input.shortfallFiles,
    input.shortfallBytes,
    input.now,
    input.now,
    destinationId,
  );
}
