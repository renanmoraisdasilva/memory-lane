import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { CATALOG_SCHEMA_VERSION } from "../schema-version";
import { catalogMigrations } from "../migrations/catalog-migrations";
import { runMigrations } from "../migrations/runner";
import { ensureDriveIdentity } from "./catalog-repository";
import {
  beginAdoption,
  finishAdoption,
  getAdoptionByKey,
  getAdoptionByRowId,
  listAdoptions,
  markInterruptedAdoptions,
  setAdoptionStatus,
} from "./replication-adoption-repository";
import {
  listAdoptionReplicas,
  markUnseenReplicasMissing,
  saveAdoptionBatch,
} from "./replication-adoption-files-repository";
import { insertDestination, nextDestinationPriority } from "./replication-destination-repository";

const now = "2026-11-01T12:00:00.000Z";

function createDb(): { db: Database.Database; destinationId: number } {
  const db = new Database(":memory:");
  runMigrations(db, catalogMigrations);
  ensureDriveIdentity(
    db,
    {
      volumeId: toVolumeId("volume-1"),
      serialNumber: "SERIAL",
      label: "Archive",
      fileSystem: "NTFS",
      rootPath: "E:\\",
      letter: "E:",
    },
    CATALOG_SCHEMA_VERSION,
  );
  const file = db
    .prepare(
      `INSERT INTO files (path, name, size, state, last_seen_at)
       VALUES ('E:\\photos\\a.jpg', 'a.jpg', 10, 'present', ?) RETURNING id`,
    )
    .get(now) as { id: number };
  db.prepare(
    `INSERT INTO hashes (file_id, sha256, hashed_at, status)
     VALUES (?, ?, ?, 'complete')`,
  ).run(file.id, "a".repeat(64), now);
  const destination = insertDestination(db, {
    destinationId: "dest-1",
    volumeId: "volume-2",
    volumeSerial: "SERIAL-2",
    label: "Backup A",
    rootRelative: "",
    copyRootRelative: "Memory Lane/Archive",
    archiveFolderName: "Archive",
    goal: "extend_coverage",
    layout: "dedicated",
    localCatalogId: "local-1",
    localCatalogRelative: ".memorylane/catalog.db",
    sourceIndexRelative: null,
    allocationMode: "all_safe",
    allocationPercent: null,
    allocationBytes: null,
    reserveBytes: 1024,
    priority: nextDestinationPriority(db),
    identityConfidence: "confirmed",
    now,
  });
  return { db, destinationId: destination.id };
}

describe("replication adoption files repository", () => {
  it("persists replicas and orphans and marks unseen files missing", () => {
    const { db, destinationId } = createDb();
    saveAdoptionBatch(db, destinationId, {
      replicas: [
        {
          fileId: 1,
          relativePath: "Memory Lane\\Archive\\photos\\a.jpg",
          relativePathKey: "memory lane\\archive\\photos\\a.jpg",
          sourceRelativePath: "photos\\a.jpg",
          sourceRelativePathKey: "photos\\a.jpg",
          sizeBytes: 10,
          sha256: "a".repeat(64),
          status: "verified",
          sourceSizeAtVerify: 10,
          sourceModifiedAtFsAtVerify: now,
          destinationSizeAtVerify: 10,
          destinationModifiedAtFsAtVerify: now,
          lastCheckedAt: now,
          lastError: null,
        },
      ],
      orphans: [
        {
          relativePath: "extra.bin",
          relativePathKey: "extra.bin",
          sizeBytes: 3,
          sha256: "b".repeat(64),
          modifiedAtFs: now,
          classification: "extra",
          matchedSourceCount: 0,
          lastCheckedAt: now,
          lastError: null,
        },
      ],
      touchedReplicaFileIds: [],
      now,
    });

    expect(getAdoptionByRowId(db, destinationId)).toMatchObject({
      matchedFiles: 1,
      verifiedFiles: 1,
      extraFiles: 1,
      scannedFiles: 2,
    });
    expect(listAdoptionReplicas(db, destinationId)).toEqual([
      expect.objectContaining({ fileId: 1, status: "verified", sha256: "a".repeat(64) }),
    ]);

    markUnseenReplicasMissing(db, {
      destinationRowId: destinationId,
      seenFileIds: [],
      seenOrphanPathKeys: ["extra.bin"],
      now,
    });
    expect(listAdoptionReplicas(db, destinationId)[0]).toMatchObject({ status: "missing" });
    expect(getAdoptionByRowId(db, destinationId)).toMatchObject({
      verifiedFiles: 0,
      extraFiles: 1,
    });

    markUnseenReplicasMissing(db, {
      destinationRowId: destinationId,
      seenFileIds: [],
      seenOrphanPathKeys: [],
      now,
    });
    expect(
      db.prepare("SELECT status FROM replica_orphans WHERE relative_path_key = 'extra.bin'").get(),
    ).toEqual({ status: "missing" });
    db.close();
  });

  it("reports missing adoption rows and exercises session transitions", () => {
    const { db, destinationId } = createDb();
    expect(() => getAdoptionByRowId(db, 999)).toThrow();
    expect(() => getAdoptionByKey(db, "missing")).toThrow();
    expect(beginAdoption(db, destinationId, now)).toMatchObject({
      status: "scanning",
      startedAt: now,
    });
    expect(
      setAdoptionStatus(db, {
        destinationRowId: destinationId,
        status: "paused",
        now,
        errorMessage: null,
      }),
    ).toMatchObject({ status: "paused" });
    db.close();
  });

  it("finishes and interrupts adoption sessions", () => {
    const { db, destinationId } = createDb();
    expect(
      finishAdoption(db, {
        destinationRowId: destinationId,
        status: "complete",
        now,
        errorMessage: null,
      }),
    ).toMatchObject({ status: "complete", finishedAt: now });

    db.prepare("UPDATE replication_adoptions SET status = 'scanning' WHERE destination_id = ?").run(
      destinationId,
    );
    expect(markInterruptedAdoptions(db, "2026-11-02T00:00:00.000Z")).toBe(1);
    expect(getAdoptionByRowId(db, destinationId)).toMatchObject({
      status: "interrupted",
      finishedAt: "2026-11-02T00:00:00.000Z",
    });
    db.close();
  });

  it("lists adoption records for the activity indicator", () => {
    const { db, destinationId } = createDb();
    expect(listAdoptions(db)).toEqual([
      expect.objectContaining({ destinationKey: "dest-1", status: "idle" }),
    ]);
    beginAdoption(db, destinationId, now);
    expect(listAdoptions(db)).toEqual([
      expect.objectContaining({ destinationKey: "dest-1", status: "scanning", startedAt: now }),
    ]);
    db.close();
  });
});
