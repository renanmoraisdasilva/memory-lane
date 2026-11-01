import { randomUUID } from "node:crypto";
import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import { assertPathInside } from "../platform/path-guard";

export const SOURCE_INDEX_SCHEMA_VERSION = 1;

export interface SourceIndexFileInput {
  fileId: number;
  relativePath: string;
  sizeBytes: number;
  sha256: string | null;
  resolvedDate: string | null;
  mediaClass: string;
  replicaStatus: string | null;
  verifiedAt: string | null;
}

export interface WriteSourceIndexInput {
  destinationRoot: string;
  catalogId: string;
  sourceCatalogId: string;
  sourceLabel: string;
  sourceRoot: string;
  generatedAt: string;
  files: SourceIndexFileInput[];
}

export function sourceIndexRelativePath(catalogId: string): string {
  return path.join(".memorylane", "replicas", catalogId, "index.db");
}

export async function writeSourceIndex(input: WriteSourceIndexInput): Promise<string> {
  const relativePath = sourceIndexRelativePath(input.catalogId);
  const finalPath = path.resolve(input.destinationRoot, relativePath);
  assertPathInside(input.destinationRoot, finalPath);
  const directory = path.dirname(finalPath);
  assertPathInside(input.destinationRoot, directory);
  await mkdir(directory, { recursive: true });
  const tempPath = `${finalPath}.${randomUUID()}.tmp`;
  assertPathInside(input.destinationRoot, tempPath);

  const db = new Database(tempPath);
  try {
    db.pragma("journal_mode = DELETE");
    db.exec(`
      CREATE TABLE source_index_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
      CREATE TABLE source_files (
        file_id INTEGER PRIMARY KEY NOT NULL,
        relative_path TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        sha256 TEXT,
        resolved_date TEXT,
        media_class TEXT NOT NULL,
        replica_status TEXT,
        verified_at TEXT
      );
      CREATE INDEX idx_source_files_relative_path ON source_files(relative_path);
    `);
    const insertMeta = db.prepare("INSERT INTO source_index_meta (key, value) VALUES (?, ?)");
    const insertFile = db.prepare(
      `INSERT INTO source_files (
         file_id, relative_path, size_bytes, sha256, resolved_date, media_class,
         replica_status, verified_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    db.transaction(() => {
      insertMeta.run("schema_version", String(SOURCE_INDEX_SCHEMA_VERSION));
      insertMeta.run("source_catalog_id", input.sourceCatalogId);
      insertMeta.run("source_label", input.sourceLabel);
      insertMeta.run("source_root", input.sourceRoot);
      insertMeta.run("generated_at", input.generatedAt);
      for (const file of input.files) {
        insertFile.run(
          file.fileId,
          file.relativePath,
          file.sizeBytes,
          file.sha256,
          file.resolvedDate,
          file.mediaClass,
          file.replicaStatus,
          file.verifiedAt,
        );
      }
    })();
  } catch (error) {
    db.close();
    await rm(tempPath, { force: true });
    throw error;
  }
  db.close();
  await rm(finalPath, { force: true });
  await rename(tempPath, finalPath);
  return relativePath;
}
