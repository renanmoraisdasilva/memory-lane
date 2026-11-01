import type Database from "better-sqlite3";
import { z } from "zod";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { PromotionStatusSchema } from "@shared/contracts/replication/types";
import type { InsertPromotionInput, PromotionRecord } from "./replication-promotion-types";

const PromotionRowSchema = z.object({
  id: z.number().int().positive(),
  catalog_id: z.string().min(1),
  from_volume_id: z.string().nullable(),
  to_volume_id: z.string().nullable(),
  status: PromotionStatusSchema,
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  rolled_back_at: z.string().nullable(),
  from_source_root_relative: z.string().nullable(),
  to_source_root_relative: z.string().nullable(),
  source_snapshot_path: z.string().nullable(),
  destination_snapshot_path: z.string().nullable(),
  verified_files: z.number().int().nonnegative(),
  verified_bytes: z.number().int().nonnegative(),
  shortfall_files: z.number().int().nonnegative(),
  shortfall_bytes: z.number().int().nonnegative(),
  error_message: z.string().nullable(),
});

function parsePromotion(row: unknown): PromotionRecord {
  const parsed = PromotionRowSchema.safeParse(row);
  if (!parsed.success) {
    throw new AppError(APP_ERROR_CODES.DB_ERROR, "Promotion row is invalid", {
      issues: parsed.error.issues,
    });
  }
  const data = parsed.data;
  return {
    id: data.id,
    catalogId: data.catalog_id,
    fromVolumeId: data.from_volume_id,
    toVolumeId: data.to_volume_id,
    status: data.status,
    startedAt: data.started_at,
    completedAt: data.completed_at,
    rolledBackAt: data.rolled_back_at,
    fromSourceRootRelative: data.from_source_root_relative,
    toSourceRootRelative: data.to_source_root_relative,
    sourceSnapshotPath: data.source_snapshot_path,
    destinationSnapshotPath: data.destination_snapshot_path,
    verifiedFiles: data.verified_files,
    verifiedBytes: data.verified_bytes,
    shortfallFiles: data.shortfall_files,
    shortfallBytes: data.shortfall_bytes,
    errorMessage: data.error_message,
  };
}

export function insertPromotion(
  db: Database.Database,
  input: InsertPromotionInput,
): PromotionRecord {
  const row = db
    .prepare(
      `INSERT INTO source_promotions (
         catalog_id, from_volume_id, to_volume_id, status, started_at, completed_at,
         rolled_back_at, from_source_root_relative, to_source_root_relative,
         source_snapshot_path, destination_snapshot_path, verified_files, verified_bytes,
         shortfall_files, shortfall_bytes, error_message
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .get(
      input.catalogId,
      input.fromVolumeId,
      input.toVolumeId,
      input.status,
      input.startedAt,
      input.completedAt,
      input.rolledBackAt,
      input.fromSourceRootRelative,
      input.toSourceRootRelative,
      input.sourceSnapshotPath,
      input.destinationSnapshotPath,
      input.verifiedFiles,
      input.verifiedBytes,
      input.shortfallFiles,
      input.shortfallBytes,
      input.errorMessage,
    );
  return parsePromotion(row);
}

export function getPromotion(db: Database.Database, promotionId: number): PromotionRecord {
  const row = db.prepare("SELECT * FROM source_promotions WHERE id = ?").get(promotionId);
  if (row === undefined) {
    throw new AppError(APP_ERROR_CODES.PROMOTION_BLOCKED, "Promotion was not found", {
      promotionId,
    });
  }
  return parsePromotion(row);
}

export function getLatestPromotionForDestination(
  db: Database.Database,
  toVolumeId: string,
): PromotionRecord | null {
  const row = db
    .prepare(
      `SELECT * FROM source_promotions
       WHERE to_volume_id = ?
       ORDER BY id DESC LIMIT 1`,
    )
    .get(toVolumeId);
  return row === undefined ? null : parsePromotion(row);
}

export function getLatestCompletedPromotion(db: Database.Database): PromotionRecord | null {
  const row = db
    .prepare(
      `SELECT * FROM source_promotions
       WHERE status = 'completed'
       ORDER BY id DESC LIMIT 1`,
    )
    .get();
  return row === undefined ? null : parsePromotion(row);
}
