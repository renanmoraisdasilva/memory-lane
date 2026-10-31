import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { getSchemaVersion, runMigrations } from "./runner";
import type { Migration } from "./types";

const migrations: Migration[] = [
  { version: 1, name: "create items", sql: "CREATE TABLE items (id INTEGER PRIMARY KEY);" },
  {
    version: 2,
    name: "add name",
    sql: "ALTER TABLE items ADD COLUMN name TEXT NOT NULL DEFAULT '';",
  },
];

describe("migration runner", () => {
  it("applies migrations once and reports the version", () => {
    const db = new Database(":memory:");
    const first = runMigrations(db, migrations);

    expect(first).toEqual({ applied: 2, version: 2 });
    expect(getSchemaVersion(db)).toBe(2);
    expect(runMigrations(db, migrations)).toEqual({ applied: 0, version: 2 });
    db.close();
  });

  it("rejects a changed migration checksum", () => {
    const db = new Database(":memory:");
    runMigrations(db, migrations.slice(0, 1));
    const changed: Migration[] = [
      {
        version: 1,
        name: "create items",
        sql: "CREATE TABLE items (id INTEGER PRIMARY KEY, x TEXT);",
      },
    ];

    expect(() => runMigrations(db, changed)).toThrow(AppError);
    db.close();
  });

  it("rejects duplicate versions", () => {
    const db = new Database(":memory:");
    const duplicate = [
      ...migrations,
      { version: 2, name: "duplicate", sql: "SELECT 1;" } satisfies Migration,
    ];

    try {
      runMigrations(db, duplicate);
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(APP_ERROR_CODES.DB_ERROR);
    }
    db.close();
  });

  it("rolls back a failing migration", () => {
    const db = new Database(":memory:");
    const failing: Migration[] = [
      { version: 1, name: "broken", sql: "CREATE TABLE broken (id INTEGER; THIS IS NOT SQL;" },
    ];

    expect(() => runMigrations(db, failing)).toThrow();
    expect(getSchemaVersion(db)).toBe(0);
    db.close();
  });

  it("rejects an invalid version", () => {
    const db = new Database(":memory:");
    expect(() => runMigrations(db, [{ version: 0, name: "bad", sql: "SELECT 1" }])).toThrow(
      AppError,
    );
    db.close();
  });
});
