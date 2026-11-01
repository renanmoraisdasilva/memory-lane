import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { CATALOG_SCHEMA_VERSION } from "../schema-version";
import { runMigrations } from "../migrations/runner";
import { catalogMigrations } from "../migrations/catalog-migrations";
import { ensureDriveIdentity } from "./catalog-repository";
import { ensureDestinationIdentity, readArchiveIdentity } from "./archive-identity-repository";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  runMigrations(db, catalogMigrations);
  ensureDriveIdentity(
    db,
    {
      volumeId: toVolumeId("volume-1"),
      serialNumber: "SERIAL",
      label: "Backup A",
      fileSystem: "NTFS",
      rootPath: "F:\\",
      letter: "F:",
    },
    CATALOG_SCHEMA_VERSION,
  );
  return db;
}

describe("archive identity repository", () => {
  it("reads the source identity created by the migration", () => {
    const db = createDb();
    const identity = readArchiveIdentity(db);
    expect(identity.role).toBe("source");
    expect(identity.catalogId).toMatch(/^[0-9a-f-]{36}$/);
    expect(identity.activeSourceVolumeId).toBe("volume-1");
    db.close();
  });

  it("turns a catalog into a destination library", () => {
    const db = createDb();
    const identity = ensureDestinationIdentity(db, {
      catalogId: "local-1",
      sourceCatalogId: "source-1",
      sourceLabel: "4TB Archive",
      label: "Backup A",
      now: "2026-11-01T12:00:00.000Z",
      schemaVersion: CATALOG_SCHEMA_VERSION,
    });
    expect(identity).toMatchObject({
      catalogId: "local-1",
      role: "destination_library",
      sourceCatalogId: "source-1",
      sourceLabel: "4TB Archive",
      sourceRootRelative: "",
      activeSourceVolumeId: null,
    });
    db.close();
  });

  it("rejects a catalog without archive identity", () => {
    const db = createDb();
    db.prepare("DELETE FROM archive_identity").run();
    expect(() => readArchiveIdentity(db)).toThrow();
    db.close();
  });

  it("rejects an invalid archive identity row", () => {
    const db = createDb();
    db.prepare("UPDATE archive_identity SET catalog_id = ''").run();
    expect(() => readArchiveIdentity(db)).toThrow();
    db.close();
  });

  it("creates a destination identity when the row is missing", () => {
    const db = createDb();
    db.prepare("DELETE FROM archive_identity").run();
    const identity = ensureDestinationIdentity(db, {
      catalogId: "local-1",
      sourceCatalogId: "source-1",
      sourceLabel: "4TB Archive",
      label: "Backup A",
      now: "2026-11-01T12:00:00.000Z",
      schemaVersion: CATALOG_SCHEMA_VERSION,
    });
    expect(identity).toMatchObject({
      catalogId: "local-1",
      role: "destination_library",
      sourceCatalogId: "source-1",
      sourceRootRelative: "",
      activeSourceVolumeId: null,
    });
    db.close();
  });

  it("tracks the previous local catalog id when re-registering", () => {
    const db = createDb();
    const first = ensureDestinationIdentity(db, {
      catalogId: "local-1",
      sourceCatalogId: "source-1",
      sourceLabel: "4TB Archive",
      label: "Backup A",
      now: "2026-11-01T12:00:00.000Z",
      schemaVersion: CATALOG_SCHEMA_VERSION,
    });
    const second = ensureDestinationIdentity(db, {
      catalogId: "local-2",
      sourceCatalogId: "source-1",
      sourceLabel: "4TB Archive",
      label: "Backup A",
      now: "2026-11-02T12:00:00.000Z",
      schemaVersion: CATALOG_SCHEMA_VERSION,
    });
    expect(first.catalogId).toBe("local-1");
    expect(second.previousLocalCatalogId).toBe("local-1");
    expect(second.catalogId).toBe("local-2");
    db.close();
  });
});
