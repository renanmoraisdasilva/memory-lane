import Database from "better-sqlite3";

export const DATABASE_CACHE_SIZE_KIB = 64 * 1024;

export interface OpenDatabaseOptions {
  busyTimeoutMs?: number;
  readonly?: boolean;
}

export function openDatabase(
  filePath: string,
  options: OpenDatabaseOptions = {},
): Database.Database {
  const readonly = options.readonly === true;
  const db = new Database(filePath, readonly ? { readonly: true } : undefined);
  db.pragma(`busy_timeout = ${String(options.busyTimeoutMs ?? 5000)}`);
  if (!readonly) {
    db.pragma("journal_mode = WAL");
  }
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");
  db.pragma(`cache_size = -${String(DATABASE_CACHE_SIZE_KIB)}`);
  return db;
}
