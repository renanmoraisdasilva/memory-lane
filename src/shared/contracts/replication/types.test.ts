import { describe, expect, it } from "vitest";
import {
  AdoptionStateSchema,
  CoverageSummarySchema,
  DestinationCandidateSchema,
  DestinationDetailSchema,
  DestinationSummarySchema,
  RegisterDestinationParamsSchema,
  ReplicationOverviewSchema,
  ReplicationPlanSchema,
  UpdateDestinationParamsSchema,
} from "./types";

const destination = {
  id: 1,
  destinationId: "dest-1",
  volumeId: "volume-1",
  label: "Backup A",
  letter: "F:",
  mount: "F:\\",
  fileSystem: "NTFS",
  goal: "extend_coverage" as const,
  connection: "connected" as const,
  identityConfidence: "confirmed" as const,
  totalBytes: 1000,
  freeBytes: 500,
  reserveBytes: 100,
  verifiedBytes: 200,
  verifiedFiles: 2,
  availableBytes: 300,
  lastSeenAt: "2026-11-01T12:00:00.000Z",
  lastVerifiedAt: "2026-11-01T12:00:00.000Z",
  priority: 0,
  fullCopyStatus: "not_applicable" as const,
  fullCopyShortfallBytes: 0,
  fullCopyShortfallFiles: 0,
  attention: {
    onlyOnDriveFiles: 0,
    onlyOnDriveBytes: 0,
    sourceMissingFiles: 0,
    sourceMissingBytes: 0,
  },
  isFirstInFillOrder: true,
};

const adoption = {
  destinationId: "dest-1",
  status: "complete" as const,
  startedAt: "2026-11-01T12:00:00.000Z",
  finishedAt: "2026-11-01T12:01:00.000Z",
  lastSavedAt: "2026-11-01T12:01:00.000Z",
  scannedFiles: 3,
  matchedFiles: 2,
  verifiedFiles: 2,
  conflictFiles: 0,
  staleFiles: 0,
  ambiguousFiles: 0,
  extraFiles: 1,
  unreadableFiles: 0,
  currentFile: null,
  totalFiles: 3,
  etaSeconds: 0,
  errorMessage: null,
  canPause: false,
  canResume: false,
};

const coverage = {
  sourceFiles: 3,
  sourceBytes: 60,
  partialFiles: 2,
  partialBytes: 30,
  partialPercent: 66.67,
  partialRemainderFiles: 1,
  partialRemainderBytes: 30,
  fullCopyFiles: 0,
  fullCopyBytes: 0,
  allDestinationFiles: 2,
  allDestinationBytes: 30,
  allDestinationPercent: 66.67,
  overlapBytes: 0,
  coverageAsOf: "2026-11-01T12:00:00.000Z",
};

const plan = {
  sourceFiles: 3,
  sourceBytes: 60,
  undatedFiles: 0,
  fullCopy: null,
  partial: {
    kind: "partial" as const,
    rows: [
      {
        destination,
        adoptedFiles: 2,
        adoptedBytes: 30,
        newFiles: 1,
        newBytes: 30,
        newRangeStart: "2011-01-01T00:00:00.000Z",
        newRangeEnd: "2011-01-01T00:00:00.000Z",
        freeAfterBytes: 270,
        offline: false,
      },
    ],
  },
  remainder: { files: 0, bytes: 0, startDate: null },
  coverage: {
    fullCopyPercent: null,
    partialPercent: 100,
    allDestinationPercent: 100,
    hasFullCopy: false,
  },
  warnings: [{ code: "undated_files", severity: "warning" as const, message: "None." }],
  executionScopes: ["all_connected" as const, "partial_only" as const],
  planHash: "abc",
  canStart: true,
  blockedReason: null,
};

describe("replication contracts", () => {
  it("parses destination summaries, details, and adoption state", () => {
    expect(DestinationSummarySchema.parse(destination)).toMatchObject({
      destinationId: "dest-1",
      goal: "extend_coverage",
    });
    expect(
      DestinationDetailSchema.parse({
        ...destination,
        rootRelative: "",
        adoptionRootRelative: "",
        copyRootRelative: null,
        layout: "dedicated",
        allocationMode: "all_safe",
        allocationPercent: null,
        allocationBytes: null,
        localCatalogRelative: ".memorylane/catalog.db",
        localCatalogId: "local-1",
        localLibraryFiles: 3,
        localLibraryBytes: 30,
        cacheReady: true,
        sourceIndexRelative: ".memorylane/replicas/catalog/index.db",
        sourceIndexUpdatedAt: "2026-11-01T12:00:00.000Z",
        coverageMap: [{ year: 2011, month: 1, count: 2 }],
        overlapBytes: 0,
        conflictFiles: 0,
        staleFiles: 0,
        missingFiles: 0,
        promotionReady: false,
        adoption,
      }),
    ).toMatchObject({ adoption: { status: "complete" } });
    expect(AdoptionStateSchema.parse(adoption).totalFiles).toBe(3);
  });

  it("parses coverage, plans, and overviews", () => {
    expect(CoverageSummarySchema.parse(coverage).partialPercent).toBe(66.67);
    expect(ReplicationPlanSchema.parse(plan).partial?.rows).toHaveLength(1);
    expect(
      ReplicationOverviewSchema.parse({
        source: {
          label: "Archive",
          volumeId: "volume-1",
          fileCount: 3,
          bytes: 60,
          coverageAsOf: null,
          readOnly: true,
        },
        coverage,
        destinations: [destination],
        hasFullCopy: false,
        run: null,
      }).destinations,
    ).toEqual([destination]);
  });

  it("parses request params and rejects invalid values", () => {
    expect(
      RegisterDestinationParamsSchema.parse({
        volumeId: "volume-1",
        goal: "extend_coverage",
        reserveBytes: 1024,
      }),
    ).toMatchObject({ layout: "dedicated", allocationMode: "all_safe" });
    expect(
      UpdateDestinationParamsSchema.parse({
        destinationId: "dest-1",
        goal: "full_copy",
      }),
    ).toMatchObject({ goal: "full_copy" });
    expect(
      DestinationCandidateSchema.safeParse({
        volumeId: "volume-1",
        label: "Backup",
        letter: null,
        rootPath: "F:\\",
        fileSystem: "NTFS",
        totalBytes: 100,
        freeBytes: 50,
        hasMarker: false,
        markerCatalogId: null,
        isActiveSource: false,
        blockedReason: null,
      }).success,
    ).toBe(true);
    expect(
      RegisterDestinationParamsSchema.safeParse({ volumeId: "", goal: "full_copy" }).success,
    ).toBe(false);
  });
});
