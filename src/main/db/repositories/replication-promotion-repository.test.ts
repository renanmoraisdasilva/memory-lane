import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { catalogMigrations } from "../migrations/catalog-migrations";
import { runMigrations } from "../migrations/runner";
import {
  getLatestCompletedPromotion,
  getLatestPromotionForDestination,
  getPromotion,
  insertPromotion,
} from "./replication-promotion-repository";

function setup(): Database.Database {
  const db = new Database(":memory:");
  runMigrations(db, catalogMigrations);
  return db;
}

const base = {
  catalogId: "catalog-1",
  fromVolumeId: "volume-old",
  toVolumeId: "volume-new",
  startedAt: "2026-11-01T12:00:00.000Z",
  completedAt: "2026-11-01T12:00:00.000Z",
  rolledBackAt: null,
  fromSourceRootRelative: "",
  toSourceRootRelative: "Memory Lane/Archive",
  sourceSnapshotPath: "C:\\old\\.memorylane\\promotion-snapshots\\source.db",
  destinationSnapshotPath: "C:\\new\\.memorylane\\promotion-snapshots\\destination.db",
  verifiedFiles: 10,
  verifiedBytes: 100,
  shortfallFiles: 0,
  shortfallBytes: 0,
  errorMessage: null,
} as const;

describe("replication promotion repository", () => {
  it("stores and finds the latest completed and latest per-destination promotion", () => {
    const db = setup();
    expect(getLatestCompletedPromotion(db)).toBeNull();
    const completed = insertPromotion(db, { ...base, status: "completed" });
    expect(completed).toMatchObject({ status: "completed", verifiedFiles: 10 });
    expect(getPromotion(db, completed.id)).toEqual(completed);
    expect(getLatestCompletedPromotion(db)?.id).toBe(completed.id);
    expect(getLatestPromotionForDestination(db, "volume-new")?.id).toBe(completed.id);
    expect(getLatestPromotionForDestination(db, "volume-missing")).toBeNull();

    const verified = insertPromotion(db, { ...base, status: "verified", completedAt: null });
    expect(getLatestPromotionForDestination(db, "volume-new")?.id).toBe(verified.id);
    expect(getLatestCompletedPromotion(db)?.id).toBe(completed.id);
    expect(() => getPromotion(db, 999)).toThrow(/not found/);
    db.close();
  });
});
