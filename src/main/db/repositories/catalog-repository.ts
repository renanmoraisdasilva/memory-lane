import type Database from "better-sqlite3";
import { z } from "zod";
import type { CatalogSummary, DriveIdentity, VolumeId } from "@shared/contracts/drives";
import { VolumeIdSchema } from "@shared/contracts/drives";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { getSchemaVersion } from "../migrations/runner";

const CatalogIdentityRowSchema = z.object({
  volume_id: VolumeIdSchema,
  volume_serial: z.string().nullable(),
  label: z.string(),
  file_system: z.string(),
  catalog_schema: z.number().int().nonnegative(),
});

export interface CatalogDriveIdentity {
  volumeId: VolumeId;
  serialNumber: string | null;
  label: string;
  fileSystem: string;
  catalogSchema: number;
}

function parseIdentity(row: unknown): CatalogDriveIdentity {
  const parsed = CatalogIdentityRowSchema.safeParse(row);
  if (!parsed.success) {
    throw new AppError(APP_ERROR_CODES.CATALOG_MISMATCH, "Catalog identity is invalid", {
      issues: parsed.error.issues,
    });
  }
  return {
    volumeId: parsed.data.volume_id,
    serialNumber: parsed.data.volume_serial,
    label: parsed.data.label,
    fileSystem: parsed.data.file_system,
    catalogSchema: parsed.data.catalog_schema,
  };
}

export function ensureDriveIdentity(
  db: Database.Database,
  identity: DriveIdentity,
  schemaVersion: number,
): CatalogDriveIdentity {
  const existing = db.prepare("SELECT * FROM drive_identity WHERE id = 1").get();

  if (existing === undefined) {
    const created = db
      .prepare(
        `INSERT INTO drive_identity (
          id, volume_id, volume_serial, label, file_system, catalog_schema, created_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?)
        RETURNING *`,
      )
      .get(
        identity.volumeId,
        identity.serialNumber,
        identity.label,
        identity.fileSystem,
        schemaVersion,
        new Date().toISOString(),
      );

    return parseIdentity(created);
  }

  const catalogIdentity = parseIdentity(existing);
  if (catalogIdentity.volumeId !== identity.volumeId) {
    throw new AppError(
      APP_ERROR_CODES.CATALOG_MISMATCH,
      "This catalog belongs to a different drive",
      { expectedVolumeId: catalogIdentity.volumeId, actualVolumeId: identity.volumeId },
    );
  }

  if (catalogIdentity.catalogSchema < schemaVersion) {
    db.prepare("UPDATE drive_identity SET catalog_schema = ? WHERE id = 1").run(schemaVersion);
    return { ...catalogIdentity, catalogSchema: schemaVersion };
  }

  return catalogIdentity;
}

export function readDriveIdentity(db: Database.Database): CatalogDriveIdentity {
  const row = db.prepare("SELECT * FROM drive_identity WHERE id = 1").get();
  if (row === undefined) {
    throw new AppError(APP_ERROR_CODES.CATALOG_MISMATCH, "Catalog has no drive identity");
  }
  return parseIdentity(row);
}

export function getCatalogSummary(db: Database.Database, catalogPath: string): CatalogSummary {
  const identity = readDriveIdentity(db);
  const countRow = db.prepare("SELECT COUNT(*) AS count FROM files").get() as
    { count: number } | undefined;

  return {
    catalogPath,
    driveLabel: identity.label,
    volumeId: identity.volumeId,
    schemaVersion: getSchemaVersion(db),
    fileCount: countRow?.count ?? 0,
    openedAt: new Date().toISOString(),
  };
}
