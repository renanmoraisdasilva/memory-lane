import path from "node:path";
import type Database from "better-sqlite3";
import type {
  OtherFile,
  OtherFileCategory,
  OtherFileCategoryCounts,
  OtherFilesPage,
} from "@shared/contracts/other-files";
import { OtherFileCategoryCountsSchema, OtherFilesPageSchema } from "@shared/contracts/other-files";

const CATEGORY_EXPR = `CASE lower(COALESCE(extension, ''))
  WHEN 'pdf' THEN 'pdfs'
  WHEN 'doc' THEN 'documents'
  WHEN 'docx' THEN 'documents'
  WHEN 'odt' THEN 'documents'
  WHEN 'rtf' THEN 'documents'
  WHEN 'txt' THEN 'documents'
  WHEN 'md' THEN 'documents'
  WHEN 'xls' THEN 'spreadsheets'
  WHEN 'xlsx' THEN 'spreadsheets'
  WHEN 'ods' THEN 'spreadsheets'
  WHEN 'csv' THEN 'spreadsheets'
  WHEN 'ppt' THEN 'presentations'
  WHEN 'pptx' THEN 'presentations'
  WHEN 'odp' THEN 'presentations'
  WHEN 'mp3' THEN 'audio'
  WHEN 'wav' THEN 'audio'
  WHEN 'flac' THEN 'audio'
  WHEN 'aac' THEN 'audio'
  WHEN 'ogg' THEN 'audio'
  WHEN 'm4a' THEN 'audio'
  WHEN 'wma' THEN 'audio'
  WHEN 'opus' THEN 'audio'
  WHEN 'zip' THEN 'archives'
  WHEN 'rar' THEN 'archives'
  WHEN '7z' THEN 'archives'
  WHEN 'tar' THEN 'archives'
  WHEN 'gz' THEN 'archives'
  WHEN 'bz2' THEN 'archives'
  WHEN 'xz' THEN 'archives'
  ELSE 'other'
END`;

interface OtherFileRow {
  id: number;
  name: string;
  path: string;
  extension: string | null;
  format: string | null;
  mime: string | null;
  category: OtherFileCategory;
  size: number;
  modified_at_fs: string;
  state: "present" | "missing";
}

const EMPTY_COUNTS: OtherFileCategoryCounts = {
  all: 0,
  documents: 0,
  spreadsheets: 0,
  presentations: 0,
  pdfs: 0,
  audio: 0,
  archives: 0,
  other: 0,
};

function readCounts(db: Database.Database): OtherFileCategoryCounts {
  const rows = db
    .prepare(
      `SELECT (${CATEGORY_EXPR}) AS category, COUNT(*) AS count
       FROM files
       WHERE media_class = 'other'
       GROUP BY category`,
    )
    .all() as Array<{ category: OtherFileCategory; count: number }>;
  const counts = { ...EMPTY_COUNTS };
  for (const row of rows) {
    if (row.category !== "all") {
      counts[row.category] = row.count;
      counts.all += row.count;
    }
  }
  return OtherFileCategoryCountsSchema.parse(counts);
}

function toOtherFile(row: OtherFileRow): OtherFile {
  return {
    fileId: row.id,
    name: row.name,
    path: row.path,
    folder: path.dirname(row.path),
    extension: row.extension,
    format: row.format,
    mime: row.mime,
    category: row.category,
    sizeBytes: row.size,
    modifiedAtFs: row.modified_at_fs,
    state: row.state,
  };
}

export function getOtherFiles(
  db: Database.Database,
  category: OtherFileCategory,
  offset: number,
  limit: number,
): OtherFilesPage {
  const filter = category === "all" ? "" : `AND (${CATEGORY_EXPR}) = ?`;
  const params = category === "all" ? [] : [category];
  const totalRow = db
    .prepare(
      `SELECT COUNT(*) AS count FROM files
       WHERE media_class = 'other' ${filter}`,
    )
    .get(...params) as { count: number };
  const rows = db
    .prepare(
      `SELECT id, name, path, extension, format, mime,
              (${CATEGORY_EXPR}) AS category, size, modified_at_fs, state
       FROM files
       WHERE media_class = 'other' ${filter}
       ORDER BY name COLLATE NOCASE, id
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as OtherFileRow[];
  return OtherFilesPageSchema.parse({
    items: rows.map(toOtherFile),
    total: totalRow.count,
    counts: readCounts(db),
  });
}
