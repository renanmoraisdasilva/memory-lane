import { vi } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import type {
  AdoptionState,
  CoverageSummary,
  DestinationCandidate,
  DestinationDetail,
  DestinationSummary,
  ReplicationOverview,
  ReplicationPlan,
  ReplicationRunState,
  RunEventsPage,
} from "@shared/contracts/replication/types";
import type { ReplicationClient } from "../features/replication/replication-client";
import { promotionState } from "./replication-promotion-fixtures";

export { promotionState };

const volumeId = toVolumeId("volume-destination");

export const replicationDestination: DestinationSummary = {
  id: 1,
  destinationId: "dest-1",
  volumeId,
  label: "Backup A",
  letter: "F:",
  mount: "F:\\",
  fileSystem: "NTFS",
  goal: "extend_coverage",
  connection: "connected",
  identityConfidence: "confirmed",
  totalBytes: 2_000_000_000,
  freeBytes: 1_200_000_000,
  reserveBytes: 100_000_000,
  verifiedBytes: 400_000_000,
  verifiedFiles: 200,
  unverifiedFiles: 0,
  availableBytes: 900_000_000,
  lastSeenAt: "2026-11-01T12:00:00.000Z",
  lastVerifiedAt: "2026-11-01T12:00:00.000Z",
  priority: 0,
  fullCopyStatus: "not_applicable",
  fullCopyShortfallBytes: 0,
  fullCopyShortfallFiles: 0,
  attention: {
    onlyOnDriveFiles: 2,
    onlyOnDriveBytes: 1024,
    sourceMissingFiles: 0,
    sourceMissingBytes: 0,
  },
  isFirstInFillOrder: true,
};

export const idleAdoption: AdoptionState = {
  destinationId: "dest-1",
  status: "idle",
  startedAt: null,
  finishedAt: null,
  lastSavedAt: null,
  scannedFiles: 0,
  matchedFiles: 0,
  verifiedFiles: 0,
  conflictFiles: 0,
  staleFiles: 0,
  ambiguousFiles: 0,
  extraFiles: 0,
  unreadableFiles: 0,
  currentFile: null,
  totalFiles: null,
  etaSeconds: null,
  errorMessage: null,
  canPause: false,
  canResume: false,
};

export const completeAdoption: AdoptionState = {
  ...idleAdoption,
  status: "complete",
  startedAt: "2026-11-01T12:00:00.000Z",
  finishedAt: "2026-11-01T12:02:00.000Z",
  lastSavedAt: "2026-11-01T12:02:00.000Z",
  scannedFiles: 200,
  matchedFiles: 198,
  verifiedFiles: 198,
  extraFiles: 2,
  totalFiles: 200,
  etaSeconds: 0,
};

export const pausedAdoption: AdoptionState = {
  ...idleAdoption,
  status: "paused",
  startedAt: "2026-11-01T12:00:00.000Z",
  lastSavedAt: "2026-11-01T12:01:00.000Z",
  scannedFiles: 40,
  matchedFiles: 38,
  verifiedFiles: 38,
  totalFiles: 200,
  currentFile: "photos\\a.jpg",
  etaSeconds: 30,
  canResume: true,
};

export const replicationDetail: DestinationDetail = {
  ...replicationDestination,
  rootRelative: "",
  adoptionRootRelative: "",
  copyRootRelative: "Memory Lane\\Archive",
  layout: "dedicated",
  allocationMode: "all_safe",
  allocationPercent: null,
  allocationBytes: null,
  localCatalogRelative: ".memorylane\\catalog.db",
  localCatalogId: "local-1",
  localLibraryFiles: 200,
  localLibraryBytes: 400_000_000,
  cacheReady: true,
  sourceIndexRelative: ".memorylane\\replicas\\source\\index.db",
  sourceIndexUpdatedAt: "2026-11-01T12:02:00.000Z",
  coverageMap: [
    { year: 2011, month: 7, count: 10 },
    { year: 2012, month: null, count: 20 },
  ],
  overlapBytes: 1024,
  conflictFiles: 0,
  staleFiles: 1,
  missingFiles: 0,
  promotionReady: false,
  adoption: completeAdoption,
};

export const replicationCoverage: CoverageSummary = {
  sourceFiles: 250,
  sourceBytes: 640_000_000,
  partialFiles: 200,
  partialBytes: 400_000_000,
  partialPercent: 80,
  partialRemainderFiles: 50,
  partialRemainderBytes: 240_000_000,
  fullCopyFiles: 0,
  fullCopyBytes: 0,
  allDestinationFiles: 200,
  allDestinationBytes: 400_000_000,
  allDestinationPercent: 80,
  overlapBytes: 0,
  coverageAsOf: "2026-11-01T12:00:00.000Z",
};

export const replicationOverview: ReplicationOverview = {
  source: {
    label: "4TB Archive",
    volumeId: toVolumeId("volume-source"),
    fileCount: 250,
    bytes: 640_000_000,
    coverageAsOf: "2026-11-01T12:00:00.000Z",
    readOnly: true,
  },
  coverage: replicationCoverage,
  destinations: [replicationDestination],
  hasFullCopy: false,
  run: null,
};

const fullCopyDestination: DestinationSummary = {
  ...replicationDestination,
  id: 2,
  destinationId: "dest-2",
  volumeId: toVolumeId("volume-full"),
  label: "8TB Archive",
  letter: "H:",
  goal: "full_copy",
  fullCopyStatus: "incomplete",
  fullCopyShortfallBytes: 100,
  fullCopyShortfallFiles: 2,
  priority: 1,
  isFirstInFillOrder: false,
};

export const replicationPlan: ReplicationPlan = {
  sourceFiles: 250,
  sourceBytes: 640_000_000,
  undatedFiles: 4,
  fullCopy: {
    kind: "full_copy",
    destination: fullCopyDestination,
    sourceFiles: 250,
    sourceBytes: 640_000_000,
    newFiles: 50,
    newBytes: 240_000_000,
    shortfallFiles: 2,
    shortfallBytes: 100,
    freeAfterBytes: 0,
    completeAfterRun: false,
    promotionReady: false,
  },
  partial: {
    kind: "partial",
    rows: [
      {
        destination: replicationDestination,
        adoptedFiles: 200,
        adoptedBytes: 400_000_000,
        newFiles: 50,
        newBytes: 240_000_000,
        newRangeStart: "2013-01-01T00:00:00.000Z",
        newRangeEnd: "2014-01-01T00:00:00.000Z",
        freeAfterBytes: 660_000_000,
        offline: false,
      },
    ],
  },
  remainder: { files: 0, bytes: 0, startDate: null },
  coverage: {
    fullCopyPercent: 99,
    partialPercent: 100,
    allDestinationPercent: 100,
    hasFullCopy: true,
  },
  warnings: [
    {
      code: "undated_files",
      severity: "warning",
      message: "4 files have no reliable date and will be planned last.",
    },
  ],
  executionScopes: ["all_connected", "full_copy_only", "partial_only"],
  planHash: "abcdef1234567890",
  canStart: true,
  blockedReason: null,
};

const candidates: DestinationCandidate[] = [
  {
    volumeId,
    label: "Backup A",
    letter: "F:",
    rootPath: "F:\\",
    fileSystem: "NTFS",
    totalBytes: 2_000_000_000,
    freeBytes: 1_200_000_000,
    hasMarker: false,
    markerCatalogId: null,
    isActiveSource: false,
    blockedReason: null,
  },
  {
    volumeId: toVolumeId("volume-source"),
    label: "4TB Archive",
    letter: "E:",
    rootPath: "E:\\",
    fileSystem: "NTFS",
    totalBytes: 4_000_000_000,
    freeBytes: 2_000_000_000,
    hasMarker: false,
    markerCatalogId: null,
    isActiveSource: true,
    blockedReason: "This drive is the active source archive.",
  },
];

export const runningRun: ReplicationRunState = {
  id: 1,
  status: "running",
  scope: "partial_only",
  planRevision: 1,
  planHash: "abcdef1234567890",
  startedAt: "2026-11-01T12:00:00.000Z",
  finishedAt: null,
  pausedAt: null,
  resumedAt: null,
  stopRequestedAt: null,
  lastHeartbeatAt: "2026-11-01T12:01:00.000Z",
  currentDestinationId: "dest-1",
  currentDestinationLabel: "Backup A",
  currentFile: "photos\\a.jpg",
  plannedFiles: 50,
  plannedBytes: 240_000_000,
  copiedFiles: 10,
  copiedBytes: 48_000_000,
  verifiedFiles: 10,
  verifiedBytes: 48_000_000,
  failedFiles: 0,
  failedBytes: 0,
  staleFiles: 0,
  staleBytes: 0,
  remainderFiles: 0,
  remainderBytes: 0,
  percent: 20,
  speedBytesPerSecond: 10_000_000,
  etaSeconds: 19,
  order: [
    {
      destinationId: "dest-1",
      label: "Backup A",
      kind: "partial",
      priority: 0,
      state: "active",
      plannedFiles: 50,
      plannedBytes: 240_000_000,
    },
  ],
  errors: [],
  capabilities: {
    canPause: true,
    canResume: false,
    canStop: true,
    canEditPlan: false,
    canAddDestination: true,
    canPromote: false,
    canSwitchSource: false,
    lockedReason: "Backup is running.",
  },
  errorMessage: null,
};

export const pausedRun: ReplicationRunState = {
  ...runningRun,
  status: "paused",
  pausedAt: "2026-11-01T12:01:00.000Z",
  capabilities: {
    ...runningRun.capabilities,
    canPause: false,
    canResume: true,
    canEditPlan: true,
    lockedReason: "Backup is paused.",
  },
};

export const runEvents: RunEventsPage = {
  events: [
    {
      id: 1,
      runId: 1,
      at: "2026-11-01T12:00:00.000Z",
      type: "started",
      planRevision: 1,
      note: "Backup started",
    },
  ],
  nextCursor: null,
};

export function createReplicationFixtureClient(
  overrides: Partial<ReplicationClient> = {},
): ReplicationClient {
  return {
    getOverview: vi.fn(() => Promise.resolve(replicationOverview)),
    listDestinationCandidates: vi.fn(() => Promise.resolve(candidates)),
    listDestinations: vi.fn(() => Promise.resolve([replicationDestination])),
    getDestination: vi.fn(() => Promise.resolve(replicationDetail)),
    registerDestination: vi.fn(() => Promise.resolve(replicationDetail)),
    updateDestination: vi.fn(() => Promise.resolve(replicationDetail)),
    getAdoptionState: vi.fn(() => Promise.resolve(completeAdoption)),
    getActiveAdoptions: vi.fn(() => Promise.resolve([])),
    startAdoption: vi.fn(() => Promise.resolve(completeAdoption)),
    pauseAdoption: vi.fn(() => Promise.resolve(pausedAdoption)),
    resumeAdoption: vi.fn(() => Promise.resolve(completeAdoption)),
    getPlan: vi.fn(() => Promise.resolve(replicationPlan)),
    getCoverage: vi.fn(() => Promise.resolve(replicationCoverage)),
    getRunState: vi.fn(() => Promise.resolve(null)),
    startRun: vi.fn(() => Promise.resolve(runningRun)),
    pauseRun: vi.fn(() => Promise.resolve(pausedRun)),
    resumeRun: vi.fn(() => Promise.resolve(runningRun)),
    requestStop: vi.fn(() => Promise.resolve(runningRun)),
    replan: vi.fn(() => Promise.resolve(pausedRun)),
    getRunEvents: vi.fn(() => Promise.resolve(runEvents)),
    getPromotion: vi.fn(() => Promise.resolve(promotionState)),
    verifyPromotion: vi.fn(() =>
      Promise.resolve({ ...promotionState, status: "verified" as const, verified: true }),
    ),
    applyPromotion: vi.fn(() =>
      Promise.resolve({
        ...promotionState,
        status: "completed" as const,
        verified: true,
        completedAt: "2026-11-01T12:05:00.000Z",
        canPromote: false,
        canRollback: true,
        rollbackBlockedReason: null,
      }),
    ),
    rollbackPromotion: vi.fn(() =>
      Promise.resolve({
        ...promotionState,
        status: "rolled_back" as const,
        rolledBackAt: "2026-11-01T12:06:00.000Z",
        canPromote: false,
        canRollback: false,
        blockedReason: "The promotion was rolled back.",
      }),
    ),
    ...overrides,
  };
}
