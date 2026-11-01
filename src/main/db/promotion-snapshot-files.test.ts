import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { toVolumeId } from "@shared/contracts/drives";
import { afterEach, describe, expect, it } from "vitest";
import { catalogMigrations } from "./migrations/catalog-migrations";
import { runMigrations } from "./migrations/runner";
import { ensureDriveIdentity } from "./repositories/catalog-repository";
import {
  catalogRoot,
  readIdentityFromCatalog,
  readRollbackMarker,
  removeRollbackMarker,
  snapshotPaths,
  writeRollbackMarker,
} from "./promotion-snapshot-files";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function root(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "memory-lane-promotion-snapshot-"));
  roots.push(directory);
  return directory;
}

describe("promotion snapshot files", () => {
  it("writes, reads, and removes the rollback marker", async () => {
    const directory = await root();
    expect(readRollbackMarker(directory)).toBeNull();
    writeRollbackMarker(directory, {
      schemaVersion: 1,
      promotionId: 4,
      catalogId: "catalog-1",
      openedAt: "2026-11-01T12:00:00.000Z",
      available: true,
    });
    expect(readRollbackMarker(directory)).toMatchObject({ promotionId: 4, available: true });
    removeRollbackMarker(directory);
    expect(readRollbackMarker(directory)).toBeNull();
  });

  it("rejects invalid marker JSON and creates snapshot directories", async () => {
    const directory = await root();
    const markerPath = path.join(directory, ".memorylane", "promotion-rollback.json");
    writeRollbackMarker(directory, {
      schemaVersion: 1,
      promotionId: 1,
      catalogId: "catalog-1",
      openedAt: "2026-11-01T12:00:00.000Z",
      available: true,
    });
    const fs = await import("node:fs/promises");
    await fs.writeFile(markerPath, "not-json", "utf8");
    expect(readRollbackMarker(directory)).toBeNull();
    await fs.writeFile(markerPath, JSON.stringify({ schemaVersion: 2 }), "utf8");
    expect(readRollbackMarker(directory)).toBeNull();

    const snapshots = snapshotPaths(
      path.join(directory, "source", ".memorylane", "catalog.db"),
      path.join(directory, "destination", ".memorylane", "catalog.db"),
    );
    expect(snapshots.source).toContain("source-");
    expect(snapshots.destination).toContain("destination-");
    await expect(fs.stat(snapshots.sourceDirectory)).resolves.toBeDefined();
    await expect(fs.stat(snapshots.destinationDirectory)).resolves.toBeDefined();
    expect(catalogRoot(path.join(directory, "a", ".memorylane", "catalog.db"))).toBe(
      path.join(directory, "a"),
    );
  });

  it("reads a catalog drive identity and rejects a catalog without one", async () => {
    const directory = await root();
    const catalogPath = path.join(directory, ".memorylane", "catalog.db");
    await mkdir(path.dirname(catalogPath), { recursive: true });
    const db = new Database(catalogPath);
    runMigrations(db, catalogMigrations);
    ensureDriveIdentity(
      db,
      {
        volumeId: toVolumeId("volume-1"),
        serialNumber: "SERIAL",
        label: "Archive",
        fileSystem: "NTFS",
        rootPath: directory,
        letter: null,
      },
      7,
    );
    db.close();
    expect(readIdentityFromCatalog(catalogPath)).toMatchObject({
      volumeId: toVolumeId("volume-1"),
      label: "Archive",
      letter: null,
    });

    const emptyPath = path.join(directory, "empty", "catalog.db");
    await import("node:fs/promises").then((fs) =>
      fs.mkdir(path.dirname(emptyPath), { recursive: true }),
    );
    const empty = new Database(emptyPath);
    empty.exec(
      "CREATE TABLE drive_identity (id INTEGER PRIMARY KEY, volume_id TEXT, volume_serial TEXT, label TEXT, file_system TEXT)",
    );
    empty.close();
    expect(() => readIdentityFromCatalog(emptyPath)).toThrow(/drive identity/);
  });
});
