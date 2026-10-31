import path from "node:path";
import type Database from "better-sqlite3";
import { z } from "zod";
import type { LibraryDateMutationResult, LibraryUndatedPage } from "@shared/contracts/library";
import { LibraryUndatedPageSchema } from "@shared/contracts/library";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { LIBRARY_SELECT, parseLibraryRow, toLibraryItem } from "./library-query";

const UndatedCursorSchema = z.object({ id: z.number().int().positive() });

interface UndatedCursor {
  id: number;
}

interface DateOverrideInput {
  fileIds: number[];
  year: number;
  month: number | null;
  now: string;
}

function encodeUndatedCursor(cursor: UndatedCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeUndatedCursor(value: string): UndatedCursor {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    return UndatedCursorSchema.parse(parsed);
  } catch {
    throw new AppError(APP_ERROR_CODES.INVALID_REQUEST, "The undated cursor is invalid");
  }
}

function countUndated(db: Database.Database): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM files f
       LEFT JOIN file_dates fd ON fd.file_id = f.id
       WHERE f.media_class IN ('image', 'video') AND fd.resolved_date IS NULL`,
    )
    .get() as { count: number } | undefined;
  return row?.count ?? 0;
}

export function getUndatedItems(
  db: Database.Database,
  cursor: string | null,
  limit: number,
): LibraryUndatedPage {
  const afterId = cursor === null ? 0 : decodeUndatedCursor(cursor).id;
  const rows = db
    .prepare(
      `${LIBRARY_SELECT}
       WHERE f.media_class IN ('image', 'video')
         AND fd.resolved_date IS NULL
         AND f.id > ?
       ORDER BY f.id ASC
       LIMIT ?`,
    )
    .all(afterId, limit + 1);

  const parsed = rows.map((row) => parseLibraryRow(row));
  const pageRows = parsed.slice(0, limit);
  const last = pageRows[pageRows.length - 1];
  return LibraryUndatedPageSchema.parse({
    items: pageRows.map((row) => ({
      ...toLibraryItem(row),
      folder: path.dirname(row.file_path),
    })),
    nextCursor:
      parsed.length > limit && last !== undefined ? encodeUndatedCursor({ id: last.id }) : null,
    total: countUndated(db),
  });
}

function resolvedDateFor(year: number, month: number | null): string {
  return month === null
    ? `${String(year)}-01-01T00:00:00`
    : `${String(year)}-${String(month).padStart(2, "0")}-01T00:00:00`;
}

function originalValueFor(year: number, month: number | null): string {
  return month === null ? String(year) : `${String(year)}-${String(month).padStart(2, "0")}`;
}

export function setDateOverride(
  db: Database.Database,
  input: DateOverrideInput,
): LibraryDateMutationResult {
  const exists = db.prepare(
    "SELECT id FROM files WHERE id = ? AND media_class IN ('image', 'video')",
  );
  const revert = db.prepare(
    "UPDATE date_overrides SET reverted_at = ? WHERE file_id = ? AND reverted_at IS NULL",
  );
  const insertOverride = db.prepare(
    `INSERT INTO date_overrides (file_id, year, month, created_at)
     VALUES (?, ?, ?, ?)`,
  );
  const upsertDate = db.prepare(
    `INSERT INTO file_dates (
       file_id, resolved_date, precision, source, confidence, original_value,
       is_override, override_id
     ) VALUES (?, ?, ?, 'manual', 1, ?, 1, ?)
     ON CONFLICT(file_id) DO UPDATE SET
       resolved_date = excluded.resolved_date,
       precision = excluded.precision,
       source = 'manual',
       confidence = 1,
       original_value = excluded.original_value,
       is_override = 1,
       override_id = excluded.override_id`,
  );

  const save = db.transaction(() => {
    let updated = 0;
    const resolvedDate = resolvedDateFor(input.year, input.month);
    const precision = input.month === null ? "year" : "month";
    const originalValue = originalValueFor(input.year, input.month);
    for (const fileId of input.fileIds) {
      if (exists.get(fileId) === undefined) {
        continue;
      }
      revert.run(input.now, fileId);
      const result = insertOverride.run(fileId, input.year, input.month, input.now);
      upsertDate.run(
        fileId,
        resolvedDate,
        precision,
        originalValue,
        Number(result.lastInsertRowid),
      );
      updated += 1;
    }
    return updated;
  });

  return { updated: save() };
}

export function clearDateOverride(
  db: Database.Database,
  fileIds: number[],
  now: string,
): LibraryDateMutationResult {
  const exists = db.prepare(
    "SELECT id FROM files WHERE id = ? AND media_class IN ('image', 'video')",
  );
  const revert = db.prepare(
    "UPDATE date_overrides SET reverted_at = ? WHERE file_id = ? AND reverted_at IS NULL",
  );
  const restore = db.prepare(
    `UPDATE file_dates SET
       resolved_date = extracted_date,
       precision = extracted_precision,
       source = extracted_source,
       confidence = extracted_confidence,
       original_value = extracted_original_value,
       is_override = 0,
       override_id = NULL
     WHERE file_id = ?`,
  );

  const save = db.transaction(() => {
    let updated = 0;
    for (const fileId of fileIds) {
      if (exists.get(fileId) === undefined) {
        continue;
      }
      revert.run(now, fileId);
      const result = restore.run(fileId);
      if (result.changes > 0) {
        updated += 1;
      }
    }
    return updated;
  });

  return { updated: save() };
}
