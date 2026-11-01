import type Database from "better-sqlite3";
import { z } from "zod";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";

const ArchiveIdentityRowSchema = z.object({
  catalog_id: z.string().min(1),
  label: z.string().min(1),
  role: z.enum(["source", "destination_library", "demoted_source"]),
  previous_local_catalog_id: z.string().nullable(),
  source_catalog_id: z.string().nullable(),
  source_label: z.string().nullable(),
  source_root_relative: z.string(),
  library_scope: z.enum(["source_root", "whole_catalog_root"]),
  active_source_volume_id: z.string().nullable(),
  promoted_at: z.string().nullable(),
  demoted_at: z.string().nullable(),
  last_indexed_at: z.string().nullable(),
  created_at: z.string(),
  schema_version: z.number().int().nonnegative(),
});

export interface ArchiveIdentity {
  catalogId: string;
  label: string;
  role: "source" | "destination_library" | "demoted_source";
  previousLocalCatalogId: string | null;
  sourceCatalogId: string | null;
  sourceLabel: string | null;
  sourceRootRelative: string;
  libraryScope: "source_root" | "whole_catalog_root";
  activeSourceVolumeId: string | null;
  promotedAt: string | null;
  demotedAt: string | null;
  lastIndexedAt: string | null;
  createdAt: string;
  schemaVersion: number;
}

function parseIdentity(row: unknown): ArchiveIdentity {
  const parsed = ArchiveIdentityRowSchema.safeParse(row);
  if (!parsed.success) {
    throw new AppError(APP_ERROR_CODES.CATALOG_MISMATCH, "Archive identity is invalid", {
      issues: parsed.error.issues,
    });
  }
  return {
    catalogId: parsed.data.catalog_id,
    label: parsed.data.label,
    role: parsed.data.role,
    previousLocalCatalogId: parsed.data.previous_local_catalog_id,
    sourceCatalogId: parsed.data.source_catalog_id,
    sourceLabel: parsed.data.source_label,
    sourceRootRelative: parsed.data.source_root_relative,
    libraryScope: parsed.data.library_scope,
    activeSourceVolumeId: parsed.data.active_source_volume_id,
    promotedAt: parsed.data.promoted_at,
    demotedAt: parsed.data.demoted_at,
    lastIndexedAt: parsed.data.last_indexed_at,
    createdAt: parsed.data.created_at,
    schemaVersion: parsed.data.schema_version,
  };
}

export function readArchiveIdentity(db: Database.Database): ArchiveIdentity {
  const row = db.prepare("SELECT * FROM archive_identity WHERE id = 1").get();
  if (row === undefined) {
    throw new AppError(APP_ERROR_CODES.CATALOG_MISMATCH, "Catalog has no archive identity");
  }
  return parseIdentity(row);
}

export function ensureDestinationIdentity(
  db: Database.Database,
  input: {
    catalogId: string;
    sourceCatalogId: string;
    sourceLabel: string;
    label: string;
    now: string;
    schemaVersion: number;
  },
): ArchiveIdentity {
  const existing = db.prepare("SELECT * FROM archive_identity WHERE id = 1").get();
  if (existing === undefined) {
    db.prepare(
      `INSERT INTO archive_identity (
        id, catalog_id, label, role, source_catalog_id, source_label,
        source_root_relative, library_scope, active_source_volume_id, created_at, schema_version
      ) VALUES (1, ?, ?, 'destination_library', ?, ?, '', 'whole_catalog_root', NULL, ?, ?)`,
    ).run(
      input.catalogId,
      input.label,
      input.sourceCatalogId,
      input.sourceLabel,
      input.now,
      input.schemaVersion,
    );
  } else {
    db.prepare(
      `UPDATE archive_identity
       SET previous_local_catalog_id = catalog_id, catalog_id = ?,
           label = ?, role = 'destination_library', source_catalog_id = ?, source_label = ?,
           source_root_relative = '', library_scope = 'whole_catalog_root',
           active_source_volume_id = NULL, schema_version = ?
       WHERE id = 1`,
    ).run(
      input.catalogId,
      input.label,
      input.sourceCatalogId,
      input.sourceLabel,
      input.schemaVersion,
    );
  }
  return readArchiveIdentity(db);
}
