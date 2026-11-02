import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { createCleanupDbHandlers, quarantineRootFor } from "./cleanup-db-handlers";
import type { CleanupDbMethod } from "./cleanup-worker-protocol";
import { catalogMigrations } from "./migrations/catalog-migrations";
import { runMigrations } from "./migrations/runner";
import { ensureDriveIdentity } from "./repositories/catalog-repository";

const volumeId = toVolumeId("volume-1");
const now = "2026-11-02T12:00:00.000Z";
const catalogPath = "C:\\archive\\.memorylane\\catalog.db";

function createHandler() {
  const db = new Database(":memory:");
  runMigrations(db, catalogMigrations);
  ensureDriveIdentity(
    db,
    {
      volumeId,
      serialNumber: "SERIAL",
      label: "Archive",
      fileSystem: "NTFS",
      rootPath: "C:\\",
      letter: "C:",
    },
    11,
  );
  const handler = createCleanupDbHandlers({
    getCatalog: () => db,
    getCatalogPath: () => catalogPath,
  });
  return { db, handler };
}

describe("cleanup DB handlers", () => {
  it("derives the catalog root and quarantine root", () => {
    expect(quarantineRootFor(catalogPath)).toBe("C:\\archive\\.memorylane_quarantine");
    const { db, handler } = createHandler();
    expect(handler.handle("cleanup.getSummary", {})).toMatchObject({
      totalGroups: 0,
      eligibleGroups: 0,
      rootPath: "C:\\archive",
      quarantineRoot: "C:\\archive\\.memorylane_quarantine",
    });
    expect(handler.handle("cleanup.getState", { now })).toMatchObject({ status: "idle" });
    expect(handler.handle("cleanup.getQuarantinePath", {})).toBeNull();
    db.close();
  });

  it("starts and finishes a cleanup run", () => {
    const { db, handler } = createHandler();
    const started = handler.handle("cleanup.start", {
      startedAt: now,
      keeperRule: "oldest-created-then-shorter-path",
      rootPath: "C:\\archive",
      groupsTotal: 2,
      filesTotal: 3,
      bytesTotal: 4096,
      quarantinePath: "C:\\archive\\.memorylane_quarantine\\run-1",
      journalPath: "C:\\archive\\.memorylane_quarantine\\run-1\\journal.jsonl",
    }) as { runId: number; status: string };
    expect(started).toMatchObject({ status: "running" });

    expect(
      handler.handle("cleanup.finish", {
        runId: started.runId,
        status: "complete",
        groupsProcessed: 2,
        groupsSkipped: 0,
        filesMoved: 3,
        filesSkipped: 0,
        bytesMoved: 4096,
        finishedAt: now,
        errorMessage: null,
      }),
    ).toMatchObject({ status: "complete", filesMoved: 3 });
    expect(handler.handle("cleanup.getQuarantinePath", {})).toBe(
      "C:\\archive\\.memorylane_quarantine\\run-1",
    );
    db.close();
  });

  it("rejects unknown methods and invalid params", () => {
    const { db, handler } = createHandler();
    try {
      handler.handle("cleanup.nope" as CleanupDbMethod, {});
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(APP_ERROR_CODES.INVALID_REQUEST);
    }
    expect(() => handler.handle("cleanup.finish", { runId: 1 })).toThrow();
    db.close();
  });
});
