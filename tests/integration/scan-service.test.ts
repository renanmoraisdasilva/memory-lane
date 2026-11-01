import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { APP_ERROR_CODES } from "@shared/domain/errors";
import { QUICK_HASH_ALGORITHM } from "@shared/domain/hashing";
import { CATALOG_SCHEMA_VERSION } from "../../src/main/db/schema-version";
import { WorkloadCoordinator } from "../../src/main/modules/workloads/application/workload-coordinator";
import { createScanHarness, waitForComplete } from "./scan-harness";

function png(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(24);
  buffer.writeUInt32BE(0x89504e47, 0);
  buffer.writeUInt32BE(0x0d0a1a0a, 4);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function countRows(catalogPath: string, sql: string): number {
  const db = new Database(catalogPath, { readonly: true });
  try {
    const row = db.prepare(sql).get() as { count: number } | undefined;
    return row?.count ?? 0;
  } finally {
    db.close();
  }
}

describe("scan service integration", () => {
  it("catalogs a drive through all four stages and records the report", async () => {
    const harness = await createScanHarness();
    try {
      const photoPath = path.join(harness.drive.rootPath, "photo.png");
      const clipPath = path.join(harness.drive.rootPath, "clip.mp4");
      const nestedPath = path.join(harness.drive.rootPath, "nested");
      await writeFile(photoPath, png(1024, 768));
      await writeFile(clipPath, Buffer.alloc(2048, 1));
      await mkdir(nestedPath, { recursive: true });
      await writeFile(path.join(nestedPath, "notes.txt"), "notes");

      const started = await harness.scanService.startScan(harness.drive.volumeId, "max");
      expect(started.status).toBe("active");
      expect(started.mode).toBe("initial");

      const complete = await waitForComplete(harness.scanService, harness.drive);
      expect(complete.report).toEqual({
        newFiles: 3,
        changedFiles: 0,
        missingFiles: 0,
        movedCandidates: 0,
      });
      expect(complete.stages.every((stage) => stage.state === "complete")).toBe(true);
      expect(complete.currentStage).toBeNull();
      expect(complete.finishedAt).not.toBeNull();

      const summary = await harness.driveService.openCatalog(harness.drive.volumeId);
      expect(summary.fileCount).toBe(3);
      expect(summary.schemaVersion).toBe(CATALOG_SCHEMA_VERSION);

      const drives = await harness.driveService.listDrives();
      expect(drives[0]?.indexedFiles).toBe(3);
      expect(drives[0]?.lastScanAt).toBe(complete.finishedAt);
      expect(drives[0]?.isConnected).toBe(true);

      expect(countRows(harness.catalogPath, "SELECT COUNT(*) AS count FROM files")).toBe(3);
      expect(
        countRows(
          harness.catalogPath,
          "SELECT COUNT(*) AS count FROM file_metadata WHERE key = 'scan.metadata' AND value = 'ok'",
        ),
      ).toBe(3);
      expect(
        countRows(
          harness.catalogPath,
          "SELECT COUNT(*) AS count FROM hashes WHERE status = 'complete'",
        ),
      ).toBe(3);
      expect(countRows(harness.catalogPath, "SELECT COUNT(*) AS count FROM file_dates")).toBe(3);
      expect(countRows(harness.catalogPath, "SELECT COUNT(*) AS count FROM cache_entries")).toBe(2);
      expect(
        countRows(
          harness.catalogPath,
          "SELECT COUNT(*) AS count FROM files WHERE path LIKE '%.memorylane%'",
        ),
      ).toBe(0);

      expect((await readFile(photoPath)).equals(png(1024, 768))).toBe(true);
    } finally {
      await harness.dispose();
    }
  });

  it("detects new, changed, missing, and likely moved files on an incremental scan", async () => {
    const harness = await createScanHarness();
    try {
      const driveRoot = harness.drive.rootPath;
      const photoPath = path.join(driveRoot, "photo.png");
      const renamedPath = path.join(driveRoot, "photo-renamed.png");
      const clipPath = path.join(driveRoot, "clip.mp4");
      const notesPath = path.join(driveRoot, "nested", "notes.txt");
      await mkdir(path.dirname(notesPath), { recursive: true });
      await writeFile(photoPath, png(800, 600));
      await writeFile(clipPath, Buffer.alloc(2048, 1));
      await writeFile(notesPath, "notes");

      await harness.scanService.startScan(harness.drive.volumeId, "balanced");
      await waitForComplete(harness.scanService, harness.drive);

      await rename(photoPath, renamedPath);
      await writeFile(clipPath, Buffer.alloc(4096, 2));
      await writeFile(path.join(driveRoot, "new.txt"), "new");
      await rm(notesPath);

      const started = await harness.scanService.startScan(harness.drive.volumeId, "balanced");
      expect(started.mode).toBe("incremental");
      const complete = await waitForComplete(harness.scanService, harness.drive);

      expect(complete.report).toEqual({
        newFiles: 2,
        changedFiles: 1,
        missingFiles: 2,
        movedCandidates: 1,
      });

      const db = new Database(harness.catalogPath, { readonly: true });
      try {
        const moved = db
          .prepare(
            "SELECT old_path, new_path, sha256, state FROM moved_candidates ORDER BY id LIMIT 1",
          )
          .get() as
          { old_path: string; new_path: string; sha256: string; state: string } | undefined;
        expect(moved).toMatchObject({
          old_path: photoPath,
          new_path: renamedPath,
          state: "pending",
        });
        expect(moved?.sha256).toHaveLength(64);

        const missing = db
          .prepare("SELECT path FROM files WHERE state = 'missing' ORDER BY path")
          .all() as Array<{ path: string }>;
        expect(missing.map((row) => row.path).sort()).toEqual([notesPath, photoPath].sort());
      } finally {
        db.close();
      }
    } finally {
      await harness.dispose();
    }
  });

  it("uses quick hashes for large unique files and full hashes for duplicate candidates", async () => {
    const harness = await createScanHarness({
      hashPolicy: { thresholdBytes: 50, sampleBytes: 8 },
    });
    try {
      const driveRoot = harness.drive.rootPath;
      await writeFile(path.join(driveRoot, "small.png"), png(4, 4));
      await writeFile(path.join(driveRoot, "unique.mp4"), Buffer.alloc(120, 1));
      await writeFile(path.join(driveRoot, "dup-a.mp4"), Buffer.alloc(200, 2));
      await writeFile(path.join(driveRoot, "dup-b.mp4"), Buffer.alloc(200, 2));

      await harness.scanService.startScan(harness.drive.volumeId, "balanced");
      await waitForComplete(harness.scanService, harness.drive);

      expect(
        countRows(
          harness.catalogPath,
          "SELECT COUNT(*) AS count FROM hashes WHERE status = 'complete'",
        ),
      ).toBe(3);
      expect(countRows(harness.catalogPath, "SELECT COUNT(*) AS count FROM quick_hashes")).toBe(1);
      expect(
        countRows(
          harness.catalogPath,
          `SELECT COUNT(*) AS count FROM quick_hashes WHERE algorithm = '${QUICK_HASH_ALGORITHM}'`,
        ),
      ).toBe(1);
      expect(countRows(harness.catalogPath, "SELECT COUNT(*) AS count FROM duplicate_groups")).toBe(
        1,
      );
    } finally {
      await harness.dispose();
    }
  });

  it("rejects a scan while a replication workload is active", async () => {
    const workloads = new WorkloadCoordinator();
    const lease = workloads.acquire("replication", "run-1");
    const harness = await createScanHarness({ workloads });
    try {
      await expect(harness.scanService.startScan(harness.drive.volumeId)).rejects.toMatchObject({
        code: APP_ERROR_CODES.WORKLOAD_CONFLICT,
      });
    } finally {
      lease.release();
      await harness.dispose();
    }
  });
});
