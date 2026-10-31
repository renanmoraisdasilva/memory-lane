import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { runMigrations } from "../migrations/runner";
import { appMigrations } from "../migrations/app-migrations";
import { listRegisteredDrives, registerDrive } from "./app-repository";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  runMigrations(db, appMigrations);
  return db;
}

const identity = {
  volumeId: toVolumeId("volume-1"),
  serialNumber: "SERIAL-1",
  label: "Archive",
  fileSystem: "NTFS",
  rootPath: "E:\\",
  letter: "E:",
};

describe("app repository", () => {
  it("registers and lists drives", () => {
    const db = createDb();
    const created = registerDrive(db, {
      identity,
      lastSeenAt: "2026-01-01T00:00:00.000Z",
      catalogSchema: 1,
    });

    expect(created.volumeId).toBe(identity.volumeId);
    expect(created.label).toBe("Archive");
    expect(listRegisteredDrives(db)).toHaveLength(1);
    db.close();
  });

  it("upserts an existing volume", () => {
    const db = createDb();
    registerDrive(db, {
      identity,
      lastSeenAt: "2026-01-01T00:00:00.000Z",
      catalogSchema: 1,
    });
    const updated = registerDrive(db, {
      identity: { ...identity, label: "Archive renamed", letter: "F:" },
      lastSeenAt: "2026-01-02T00:00:00.000Z",
      catalogSchema: 1,
    });

    expect(updated.label).toBe("Archive renamed");
    expect(updated.lastLetter).toBe("F:");
    expect(listRegisteredDrives(db)).toHaveLength(1);
    db.close();
  });

  it("rejects a malformed registered drive row", () => {
    const db = createDb();
    db.prepare(
      `INSERT INTO registered_drives (volume_id, label, file_system, root_path, last_seen_at, catalog_schema)
       VALUES ('', 'Broken', 'NTFS', 'E:\\', '2026-01-01T00:00:00.000Z', 1)`,
    ).run();

    expect(() => listRegisteredDrives(db)).toThrow();
    db.close();
  });

  it("orders registered drives by most recently seen", () => {
    const db = createDb();
    registerDrive(db, {
      identity,
      lastSeenAt: "2026-01-01T00:00:00.000Z",
      catalogSchema: 1,
    });
    registerDrive(db, {
      identity: { ...identity, volumeId: toVolumeId("volume-2"), label: "Second" },
      lastSeenAt: "2026-02-01T00:00:00.000Z",
      catalogSchema: 1,
    });

    expect(listRegisteredDrives(db).map((drive) => drive.label)).toEqual(["Second", "Archive"]);
    db.close();
  });
});
