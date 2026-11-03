// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  DuplicateCleanupState,
  DuplicateCleanupSummary,
  DuplicateGroupsPage,
  HealthFile,
} from "@shared/contracts/health";
import { createMockPhaseOneClient } from "../../lib/ipc-client.mock";
import { createMockDrives, mockCatalogSummary, mockVolumeIds } from "../../lib/mock-fixtures";
import { createLibraryFixtureClient } from "../../test/library-fixtures";
import { renderWithProviders } from "../../test/render";
import type { LibraryClient } from "../library/library-client";
import { HealthPage } from "./HealthPage";

function healthFile(fileId: number, name: string, path: string, createdAtFs: string): HealthFile {
  return {
    fileId,
    name,
    mediaClass: "image",
    format: "JPG",
    sizeBytes: 2048,
    width: 100,
    height: 100,
    durationSeconds: null,
    date: { value: null, precision: null, source: null, isOverride: false },
    thumbnailStatus: "ready",
    thumbnailUrl: null,
    isMissing: false,
    isDuplicate: true,
    path,
    folder: path.slice(0, path.lastIndexOf("\\")),
    createdAtFs,
    modifiedAtFs: createdAtFs,
    hasVerifiedReplica: fileId === 1,
    hasDateOverride: false,
  };
}

const page: DuplicateGroupsPage = {
  groups: [
    {
      groupId: 1,
      sha256: "a".repeat(64),
      fileCount: 2,
      totalBytes: 4096,
      files: [
        healthFile(1, "sample.jpg", "E:\\Demo\\Archive\\sample.jpg", "2020-01-01T00:00:00.000Z"),
        healthFile(2, "sample.jpg", "E:\\Demo\\Backup\\sample.jpg", "2024-01-01T00:00:00.000Z"),
      ],
      keeperFileId: 1,
      keeperReason: "oldest created",
      eligible: true,
      skipReason: null,
      excessBytes: 2048,
    },
  ],
  totalGroups: 1,
  totalFiles: 2,
  totalBytes: 4096,
  totalExcessBytes: 2048,
};

const summary: DuplicateCleanupSummary = {
  totalGroups: 1,
  totalFiles: 2,
  totalDuplicateBytes: 4096,
  eligibleGroups: 1,
  skippedGroups: 0,
  groupsWithoutCoverage: 0,
  filesToMove: 1,
  bytesToMove: 2048,
  keepers: 1,
  skipCounts: {
    notAGroup: 0,
    empty: 0,
    belowMinimumSize: 0,
    candidateDateOverride: 0,
    multipleDateOverrides: 0,
    hardLink: 0,
  },
  minimumFileSizeBytes: 1024,
  rootPath: "E:\\Demo",
  quarantineRoot: "E:\\Demo\\.memorylane_quarantine",
};

const idleState: DuplicateCleanupState = {
  runId: null,
  status: "idle",
  groupsTotal: 0,
  groupsProcessed: 0,
  groupsSkipped: 0,
  groupsWithoutCoverage: 0,
  filesTotal: 0,
  filesMoved: 0,
  filesSkipped: 0,
  bytesTotal: 0,
  bytesMoved: 0,
  currentPath: null,
  quarantinePath: null,
  cancelRequested: false,
  errorMessage: null,
  startedAt: null,
  finishedAt: null,
};

const runningState: DuplicateCleanupState = {
  ...idleState,
  runId: 1,
  status: "running",
  groupsTotal: 1,
  filesTotal: 1,
  bytesTotal: 2048,
  quarantinePath: "E:\\Demo\\.memorylane_quarantine\\run-1",
  startedAt: "2026-11-02T12:00:00.000Z",
};

const completeState: DuplicateCleanupState = {
  ...runningState,
  status: "complete",
  groupsProcessed: 1,
  filesMoved: 1,
  bytesMoved: 2048,
  finishedAt: "2026-11-02T12:01:00.000Z",
};

function renderHealth(libraryClient: LibraryClient): void {
  const drive = createMockDrives("catalog").find(
    (candidate) => candidate.volumeId === mockVolumeIds.ready,
  );
  if (drive === undefined) {
    throw new Error("The ready mock drive is missing");
  }
  renderWithProviders(<HealthPage />, {
    client: createMockPhaseOneClient({ scenario: "catalog" }),
    libraryClient,
    workspace: { drive, catalog: mockCatalogSummary(drive) },
    initialEntries: ["/health?tab=duplicates"],
  });
}

afterEach(() => {
  cleanup();
});

describe("duplicate cleanup refresh", () => {
  it("refreshes duplicates after the cleanup dialog is dismissed", async () => {
    const client = createLibraryFixtureClient();
    let phase: "idle" | "running" | "complete" = "idle";
    const getDuplicates = vi.fn(async () => page);
    client.getDuplicates = getDuplicates;
    client.getCleanupSummary = async () => summary;
    client.getCleanupState = async () => {
      if (phase === "running") {
        return runningState;
      }
      return phase === "complete" ? completeState : idleState;
    };
    client.startCleanup = async () => {
      phase = "running";
      return runningState;
    };
    renderHealth(client);

    expect(await screen.findByText("2 exact copies")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Move duplicates to quarantine" }));
    await userEvent.click(await screen.findByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: /Move 1 file/ }));
    expect(
      await screen.findByRole("dialog", { name: "Moving duplicates to quarantine" }),
    ).toBeVisible();

    phase = "complete";
    expect(
      await screen.findByRole("dialog", { name: "Cleanup complete" }, { timeout: 4_000 }),
    ).toBeVisible();
    await waitFor(() => {
      expect(getDuplicates.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    const callsBeforeDone = getDuplicates.mock.calls.length;

    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => {
      expect(getDuplicates.mock.calls.length).toBeGreaterThan(callsBeforeDone);
    });
  });
});
