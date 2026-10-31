import type Database from "better-sqlite3";
import { z } from "zod";
import type { DriveIdentity } from "@shared/contracts/drives";
import { VolumeIdSchema } from "@shared/contracts/drives";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { RegisteredDrive } from "../../modules/drives/domain/drive";

const RegisteredDriveRowSchema = z.object({
  id: z.number().int().positive(),
  volume_id: VolumeIdSchema,
  volume_serial: z.string().nullable(),
  label: z.string(),
  file_system: z.string(),
  root_path: z.string(),
  last_letter: z.string().nullable(),
  last_seen_at: z.string(),
  catalog_schema: z.number().int().nonnegative(),
  last_backup_at: z.string().nullable(),
});

export interface RegisterDriveInput {
  identity: DriveIdentity;
  lastSeenAt: string;
  catalogSchema: number;
}

function toRegisteredDrive(row: z.infer<typeof RegisteredDriveRowSchema>): RegisteredDrive {
  return {
    id: row.id,
    volumeId: row.volume_id,
    volumeSerial: row.volume_serial,
    label: row.label,
    fileSystem: row.file_system,
    rootPath: row.root_path,
    lastLetter: row.last_letter,
    lastSeenAt: row.last_seen_at,
    catalogSchema: row.catalog_schema,
    lastBackupAt: row.last_backup_at,
  };
}

function parseRow(row: unknown): RegisteredDrive {
  const parsed = RegisteredDriveRowSchema.safeParse(row);
  if (!parsed.success) {
    throw new AppError(APP_ERROR_CODES.DB_ERROR, "Invalid registered drive row", {
      issues: parsed.error.issues,
    });
  }
  return toRegisteredDrive(parsed.data);
}

const upsertDriveSql = `
  INSERT INTO registered_drives (
    volume_id,
    volume_serial,
    label,
    file_system,
    root_path,
    last_letter,
    last_seen_at,
    catalog_schema
  ) VALUES (
    @volumeId,
    @volumeSerial,
    @label,
    @fileSystem,
    @rootPath,
    @lastLetter,
    @lastSeenAt,
    @catalogSchema
  )
  ON CONFLICT(volume_id) DO UPDATE SET
    volume_serial = excluded.volume_serial,
    label = excluded.label,
    file_system = excluded.file_system,
    root_path = excluded.root_path,
    last_letter = excluded.last_letter,
    last_seen_at = excluded.last_seen_at,
    catalog_schema = excluded.catalog_schema
`;

export function registerDrive(db: Database.Database, input: RegisterDriveInput): RegisteredDrive {
  const row = db.prepare(`${upsertDriveSql} RETURNING *`).get({
    volumeId: input.identity.volumeId,
    volumeSerial: input.identity.serialNumber,
    label: input.identity.label,
    fileSystem: input.identity.fileSystem,
    rootPath: input.identity.rootPath,
    lastLetter: input.identity.letter,
    lastSeenAt: input.lastSeenAt,
    catalogSchema: input.catalogSchema,
  });

  return parseRow(row);
}

export function listRegisteredDrives(db: Database.Database): RegisteredDrive[] {
  const rows = db.prepare("SELECT * FROM registered_drives ORDER BY last_seen_at DESC").all();

  return rows.map(parseRow);
}
