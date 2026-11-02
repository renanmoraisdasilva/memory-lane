// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  DuplicateCleanupState,
  DuplicateCleanupSummary,
  DuplicateGroupsPage,
  MissingFile,
  MissingFilesPage,
  MovedCandidatesPage,
  MovedCandidatesParams,
  ValidationState,
} from "@shared/contracts/health";
import { createMockPhaseOneClient } from "../../lib/ipc-client.mock";
import { createMockDrives, mockCatalogSummary, mockVolumeIds } from "../../lib/mock-fixtures";
import { renderWithProviders } from "../../test/render";
import { createLibraryFixtureClient } from "../../test/library-fixtures";
import type { LibraryClient } from "../library/library-client";
import { HealthPage } from "./HealthPage";

const runningValidation: ValidationState = {
  sessionId: 1,
  status: "running",
  levels: ["existence", "hash"],
  total: 4,
  processed: 1,
  currentLevel: "existence",
  startedAt: "2026-10-31T12:00:00.000Z",
  finishedAt: null,
  errorMessage: null,
  report: null,
};

function renderHealth(libraryClient: LibraryClient = createLibraryFixtureClient()): void {
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
    initialEntries: ["/health"],
  });
}

afterEach(() => {
  cleanup();
});

const missingItem: MissingFile = {
  fileId: 7,
  name: "gone.jpg",
  path: "E:\\Archive\\gone.jpg",
  folder: "E:\\Archive",
  sizeBytes: 1024,
  mediaClass: "image",
  format: "JPG",
  lastPath: "E:\\Archive\\gone.jpg",
  lastSeenAt: "2026-10-31T12:00:00.000Z",
  reason: "scan",
  hasMovedCandidate: false,
  dismissedAt: null,
};

async function movedPage(params: MovedCandidatesParams): Promise<MovedCandidatesPage> {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 50;
  const count = Math.max(0, Math.min(limit, 120 - offset));
  return {
    items: Array.from({ length: count }, (_, index) => {
      const id = offset + index + 1;
      return {
        id,
        fileId: id + 1000,
        name: `moved-${id}.jpg`,
        oldPath: `C:\\archive\\old-${id}.jpg`,
        newPath: `C:\\archive\\new-${id}.jpg`,
        sizeBytes: 100,
        sha256: "hash",
      };
    }),
    total: 120,
  };
}

describe("HealthPage", () => {
  it("switches between missing files, duplicates, and validation", async () => {
    renderHealth();

    expect(await screen.findByText("No missing files")).toBeVisible();
    await userEvent.click(screen.getByRole("tab", { name: /Duplicates/ }));
    expect(await screen.findByText("No exact duplicates")).toBeVisible();
    await userEvent.click(screen.getByRole("tab", { name: "Validation" }));
    expect(await screen.findByRole("heading", { name: "Validation levels" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Run validation" })).toBeEnabled();
  });

  it("paginates likely moved files and requires an explicit selection", async () => {
    const client = createLibraryFixtureClient();
    const getMoved = vi.fn(movedPage);
    client.getMoved = getMoved;
    client.getHealthSummary = async () => ({
      duplicateGroups: 0,
      duplicateFiles: 0,
      duplicateBytes: 0,
      missingFiles: 0,
      movedCandidates: 120,
      lastValidationAt: null,
    });
    renderHealth(client);

    expect(await screen.findByText("Page 1 of 3")).toBeVisible();
    expect(screen.getByRole("button", { name: "Confirm selected" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Select page" }));
    expect(screen.getByRole("button", { name: "Confirm selected (50)" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(getMoved).toHaveBeenLastCalledWith({ offset: 50, limit: 50 });
    });
    expect(await screen.findByText("Page 2 of 3")).toBeVisible();
    expect(screen.getByRole("button", { name: "Confirm selected" })).toBeDisabled();
  });

  it("selects all missing files and disregards them", async () => {
    const client = createLibraryFixtureClient();
    const page: MissingFilesPage = {
      items: [missingItem, { ...missingItem, fileId: 8, name: "also-gone.jpg" }],
      total: 2,
      fileIds: [7, 8],
      dismissedTotal: 0,
    };
    const getMissing = vi.fn(async () => page);
    const dismissMissing = vi.fn(async () => ({ updated: 2, skipped: 0 }));
    client.getMissing = getMissing;
    client.dismissMissing = dismissMissing;
    renderHealth(client);

    await userEvent.click(await screen.findByRole("button", { name: "Select all (2)" }));
    await userEvent.click(screen.getByRole("button", { name: "Disregard these files (2)" }));
    await waitFor(() => {
      expect(dismissMissing).toHaveBeenCalledWith({ fileIds: [7, 8] });
    });
  });

  it("shows disregarded missing files and restores them", async () => {
    const client = createLibraryFixtureClient();
    const activePage: MissingFilesPage = {
      items: [],
      total: 0,
      fileIds: [],
      dismissedTotal: 1,
    };
    const dismissedPage: MissingFilesPage = {
      items: [{ ...missingItem, dismissedAt: "2026-11-01T12:00:00.000Z" }],
      total: 1,
      fileIds: [7],
      dismissedTotal: 1,
    };
    client.getMissing = async (params) => (params.dismissedOnly ? dismissedPage : activePage);
    const restoreMissing = vi.fn(async () => ({ updated: 1, skipped: 0 }));
    client.restoreMissing = restoreMissing;
    renderHealth(client);

    await userEvent.click(await screen.findByRole("button", { name: "Show disregarded (1)" }));
    await userEvent.click(await screen.findByRole("button", { name: "Select all (1)" }));
    await userEvent.click(screen.getByRole("button", { name: "Restore selected (1)" }));
    await waitFor(() => {
      expect(restoreMissing).toHaveBeenCalledWith({ fileIds: [7] });
    });
  });

  it("shows keeper badges and starts a confirmed cleanup", async () => {
    const client = createLibraryFixtureClient();
    const firstDate = "2020-01-01T00:00:00.000Z";
    const secondDate = "2024-01-01T00:00:00.000Z";
    const page: DuplicateGroupsPage = {
      groups: [
        {
          groupId: 1,
          sha256: "a".repeat(64),
          fileCount: 2,
          totalBytes: 4096,
          files: [
            {
              fileId: 1,
              name: "sample-photo.jpg",
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
              path: "X:\\Demo\\Archive\\sample-photo.jpg",
              folder: "X:\\Demo\\Archive",
              createdAtFs: firstDate,
              modifiedAtFs: firstDate,
              hasVerifiedReplica: true,
              hasDateOverride: false,
            },
            {
              fileId: 2,
              name: "sample-photo.jpg",
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
              path: "X:\\Demo\\Backup\\sample-photo.jpg",
              folder: "X:\\Demo\\Backup",
              createdAtFs: secondDate,
              modifiedAtFs: secondDate,
              hasVerifiedReplica: false,
              hasDateOverride: false,
            },
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
      groupsWithoutCoverage: 1,
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
      rootPath: "X:\\Demo",
      quarantineRoot: "X:\\Demo\\.memorylane_quarantine",
    };
    const running: DuplicateCleanupState = {
      runId: 1,
      status: "running",
      groupsTotal: 1,
      groupsProcessed: 0,
      groupsSkipped: 0,
      groupsWithoutCoverage: 0,
      filesTotal: 1,
      filesMoved: 0,
      filesSkipped: 0,
      bytesTotal: 2048,
      bytesMoved: 0,
      currentPath: null,
      quarantinePath: "X:\\Demo\\.memorylane_quarantine\\run-1",
      cancelRequested: false,
      errorMessage: null,
      startedAt: "2026-11-02T12:00:00.000Z",
      finishedAt: null,
    };
    client.getDuplicates = async () => page;
    client.getCleanupSummary = async () => summary;
    const start = vi.spyOn(client, "startCleanup").mockResolvedValue(running);
    renderHealth(client);

    await userEvent.click(await screen.findByRole("tab", { name: /Duplicates/ }));
    expect(await screen.findByText("2 exact copies")).toBeVisible();
    expect(screen.getByText("KEEP")).toBeVisible();
    expect(screen.getByText("MOVE")).toBeVisible();
    expect(await screen.findByText(/groups have no verified backup/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Move duplicates to quarantine" }));
    expect(
      await screen.findByRole("dialog", { name: "Move duplicates to quarantine?" }),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: /Move 1 file/ }));
    await waitFor(() => {
      expect(start).toHaveBeenCalledTimes(1);
    });
  });

  it("starts a whole-catalog validation with the selected levels", async () => {
    const client = createLibraryFixtureClient();
    const start = vi.spyOn(client, "startValidation").mockResolvedValue(runningValidation);
    const drive = createMockDrives("catalog").find(
      (candidate) => candidate.volumeId === mockVolumeIds.ready,
    );
    if (drive === undefined) {
      throw new Error("The ready mock drive is missing");
    }
    renderWithProviders(<HealthPage />, {
      client: createMockPhaseOneClient({ scenario: "catalog" }),
      libraryClient: client,
      workspace: { drive, catalog: mockCatalogSummary(drive) },
      initialEntries: ["/health?tab=validation"],
    });

    await userEvent.click(await screen.findByRole("button", { name: "Run validation" }));
    await waitFor(() => {
      expect(start).toHaveBeenCalledWith({
        levels: ["existence", "metadata", "hash", "metadataRefresh"],
      });
    });
  });
});
