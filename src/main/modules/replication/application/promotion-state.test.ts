import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import type { ReplicationPlan } from "@shared/contracts/replication/types";
import type { ArchiveIdentity } from "../../../db/repositories/archive-identity-repository";
import type { ReplicationDestinationRecord } from "../../../db/repositories/replication-destination-repository";
import type { PromotionRecord } from "../../../db/repositories/replication-promotion-types";
import type { ReplicationRunRecord } from "../../../db/repositories/replication-run-types";
import type { DetectedDrive } from "../../drives/domain/drive";
import { WorkloadCoordinator } from "../../workloads/application/workload-coordinator";
import type { PromotionContext } from "./promotion-state";
import { buildPromotionState } from "./promotion-state";

const drive: DetectedDrive = {
  volumeId: toVolumeId("volume-destination"),
  serialNumber: "SERIAL",
  label: "Backup A",
  fileSystem: "NTFS",
  letter: "F:",
  rootPath: "F:\\",
  totalBytes: 4_000_000,
  freeBytes: 2_000_000,
  driveType: "removable",
  isExternal: true,
};

function summary(
  overrides: Partial<ReplicationPlan["fullCopy"]> = {},
): NonNullable<ReplicationPlan["fullCopy"]> {
  return {
    kind: "full_copy",
    destination: {
      id: 1,
      destinationId: "dest-1",
      volumeId: toVolumeId("volume-destination"),
      label: "Backup A",
      letter: "F:",
      mount: "F:\\",
      fileSystem: "NTFS",
      goal: "full_copy",
      connection: "connected",
      identityConfidence: "confirmed",
      totalBytes: 4_000_000,
      freeBytes: 2_000_000,
      reserveBytes: 0,
      verifiedBytes: 100,
      verifiedFiles: 10,
      availableBytes: 1_000_000,
      lastSeenAt: null,
      lastVerifiedAt: null,
      priority: 0,
      fullCopyStatus: "complete",
      fullCopyShortfallBytes: 0,
      fullCopyShortfallFiles: 0,
      attention: {
        onlyOnDriveFiles: 2,
        onlyOnDriveBytes: 20,
        sourceMissingFiles: 0,
        sourceMissingBytes: 0,
      },
      isFirstInFillOrder: false,
    },
    sourceFiles: 10,
    sourceBytes: 100,
    newFiles: 0,
    newBytes: 0,
    shortfallFiles: 0,
    shortfallBytes: 0,
    freeAfterBytes: 1_000_000,
    completeAfterRun: true,
    promotionReady: true,
    ...overrides,
  };
}

function plan(fullCopy: ReplicationPlan["fullCopy"]): ReplicationPlan {
  return {
    sourceFiles: 10,
    sourceBytes: 100,
    undatedFiles: 0,
    fullCopy,
    partial: null,
    remainder: { files: 0, bytes: 0, startDate: null },
    coverage: {
      fullCopyPercent: 100,
      partialPercent: 0,
      allDestinationPercent: 100,
      hasFullCopy: true,
    },
    warnings: [],
    executionScopes: [],
    planHash: "hash",
    canStart: false,
    blockedReason: null,
  };
}

function record(
  overrides: Partial<ReplicationDestinationRecord> = {},
): ReplicationDestinationRecord {
  return {
    id: 1,
    destinationId: "dest-1",
    volumeId: "volume-destination",
    volumeSerial: "SERIAL",
    label: "Backup A",
    rootRelative: "",
    copyRootRelative: "Memory Lane/Archive",
    archiveFolderName: "Archive",
    goal: "full_copy",
    layout: "dedicated",
    localCatalogId: "local-1",
    localCatalogRelative: ".memorylane/catalog.db",
    sourceIndexRelative: null,
    sourceIndexUpdatedAt: null,
    allocationMode: "all_safe",
    allocationPercent: null,
    allocationBytes: null,
    reserveBytes: 0,
    priority: 0,
    status: "active",
    identityConfidence: "confirmed",
    fullCopyStatus: "complete",
    fullCopyShortfallBytes: 0,
    fullCopyShortfallFiles: 0,
    lastSeenAt: null,
    lastCapacityBytes: null,
    lastFreeBytes: null,
    createdAt: "2026-11-01T12:00:00.000Z",
    updatedAt: "2026-11-01T12:00:00.000Z",
    verifiedFiles: 10,
    verifiedBytes: 100,
    onlyOnDriveFiles: 2,
    onlyOnDriveBytes: 20,
    sourceMissingFiles: 0,
    sourceMissingBytes: 0,
    lastVerifiedAt: null,
    conflictFiles: 0,
    staleFiles: 0,
    missingFiles: 0,
    failedFiles: 0,
    ...overrides,
  };
}

const identity: ArchiveIdentity = {
  catalogId: "catalog-1",
  label: "4TB Archive",
  role: "source",
  previousLocalCatalogId: null,
  sourceCatalogId: null,
  sourceLabel: null,
  sourceRootRelative: "",
  libraryScope: "whole_catalog_root",
  activeSourceVolumeId: "volume-source",
  promotedAt: null,
  demotedAt: null,
  lastIndexedAt: null,
  createdAt: "2026-11-01T12:00:00.000Z",
  schemaVersion: 7,
};

function promotion(overrides: Partial<PromotionRecord> = {}): PromotionRecord {
  return {
    id: 4,
    catalogId: "catalog-1",
    fromVolumeId: "volume-source",
    toVolumeId: "volume-destination",
    status: "verified",
    startedAt: "2026-11-01T12:00:00.000Z",
    completedAt: null,
    rolledBackAt: null,
    fromSourceRootRelative: "",
    toSourceRootRelative: "Memory Lane/Archive",
    sourceSnapshotPath: null,
    destinationSnapshotPath: null,
    verifiedFiles: 10,
    verifiedBytes: 100,
    shortfallFiles: 0,
    shortfallBytes: 0,
    errorMessage: null,
    ...overrides,
  };
}

function context(overrides: Partial<PromotionContext> = {}): PromotionContext {
  const destination = record();
  return {
    execution: {
      plan: plan(summary()),
      partial: [],
      fullCopy: null,
    },
    record: destination,
    records: [destination],
    identity,
    drives: [drive],
    drive,
    run: null,
    latestPromotion: null,
    rollbackWindowOpen: false,
    ...overrides,
  };
}

describe("promotion state", () => {
  it("maps an eligible complete full copy", () => {
    const state = buildPromotionState(context(), new WorkloadCoordinator());
    expect(state).toMatchObject({
      status: "planned",
      canPromote: true,
      verified: false,
      destinationId: "dest-1",
      counts: {
        sourceFiles: 10,
        verifiedFiles: 10,
        destinationOnlyFiles: 2,
      },
    });
    expect(state.oldSource.fitsFullCopy).toBe(false);
    expect(state.canRollback).toBe(false);
  });

  it("reports blockers for a missing job, offline drive, and active run", () => {
    const noJob = buildPromotionState(
      context({ execution: { plan: plan(null), partial: [], fullCopy: null } }),
      new WorkloadCoordinator(),
    );
    expect(noJob.canPromote).toBe(false);
    expect(noJob.blockedReason).toMatch(/not the planned full-copy target/);

    const offline = buildPromotionState(
      context({ drive: undefined, drives: [] }),
      new WorkloadCoordinator(),
    );
    expect(offline.connected).toBe(false);
    expect(offline.blockedReason).toMatch(/Connect the full-copy destination/);

    const run = {
      status: "paused",
    } as ReplicationRunRecord;
    const paused = buildPromotionState(context({ run }), new WorkloadCoordinator());
    expect(paused.blockedReason).toMatch(/running or paused/);
  });

  it("shows verified and completed promotion rollback state", () => {
    const verified = buildPromotionState(
      context({ latestPromotion: promotion() }),
      new WorkloadCoordinator(),
    );
    expect(verified.verified).toBe(true);
    expect(verified.canRollback).toBe(false);

    const completed = buildPromotionState(
      context({
        latestPromotion: promotion({
          status: "completed",
          completedAt: "2026-11-01T12:05:00.000Z",
        }),
        rollbackWindowOpen: true,
      }),
      new WorkloadCoordinator(),
    );
    expect(completed.status).toBe("completed");
    expect(completed.canRollback).toBe(true);
    expect(completed.previousSourceVolumeId).toBe(toVolumeId("volume-source"));
  });

  it("unlocks rollback only before the first change and lists partial destinations", () => {
    const partial = record({
      id: 2,
      destinationId: "dest-2",
      label: "Backup B",
      goal: "extend_coverage",
      volumeId: "volume-partial",
      priority: 1,
    });
    const completed = buildPromotionState(
      context({
        records: [record(), partial],
        latestPromotion: promotion({ status: "completed" }),
        rollbackWindowOpen: false,
      }),
      new WorkloadCoordinator(),
    );
    expect(completed.canRollback).toBe(false);
    expect(completed.rollbackBlockedReason).toMatch(/before the first change/);
    expect(completed.partialDestinations).toEqual([
      expect.objectContaining({ destinationId: "dest-2", label: "Backup B" }),
    ]);
  });
});
