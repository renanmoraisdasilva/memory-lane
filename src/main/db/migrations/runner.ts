import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { Migration } from "./types";

interface AppliedMigrationRow {
  version: number;
  checksum: string;
}

function checksum(sql: string): string {
  return createHash("sha256").update(sql).digest("hex");
}

function ensureMigrationTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
}

function readApplied(db: Database.Database): Map<number, string> {
  const rows = db.prepare("SELECT version, checksum FROM schema_migrations").all() as
    AppliedMigrationRow[] | [];
  return new Map(rows.map((row) => [row.version, row.checksum]));
}

function validateMigrations(migrations: Migration[]): void {
  const versions = new Set<number>();
  for (const migration of migrations) {
    if (!Number.isInteger(migration.version) || migration.version < 1) {
      throw new AppError(APP_ERROR_CODES.DB_ERROR, "Migration version must be a positive integer");
    }
    if (versions.has(migration.version)) {
      throw new AppError(
        APP_ERROR_CODES.DB_ERROR,
        `Duplicate migration version ${migration.version}`,
      );
    }
    versions.add(migration.version);
  }
}

export function runMigrations(
  db: Database.Database,
  migrations: Migration[],
): { applied: number; version: number } {
  ensureMigrationTable(db);
  validateMigrations(migrations);

  const applied = readApplied(db);
  const ordered = [...migrations].sort((left, right) => left.version - right.version);
  let appliedCount = 0;

  for (const migration of ordered) {
    const expected = checksum(migration.sql);
    const existing = applied.get(migration.version);

    if (existing !== undefined) {
      if (existing !== expected) {
        throw new AppError(
          APP_ERROR_CODES.DB_ERROR,
          `Migration ${migration.version} checksum does not match the applied migration`,
        );
      }
      continue;
    }

    const apply = db.transaction(() => {
      db.exec(migration.sql);
      db.prepare(
        "INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)",
      ).run(migration.version, migration.name, expected, new Date().toISOString());
    });

    apply();
    appliedCount += 1;
  }

  return { applied: appliedCount, version: getSchemaVersion(db) };
}

export function getSchemaVersion(db: Database.Database): number {
  ensureMigrationTable(db);
  const row = db.prepare("SELECT MAX(version) AS version FROM schema_migrations").get() as
    { version: number | null } | undefined;
  return row?.version ?? 0;
}
