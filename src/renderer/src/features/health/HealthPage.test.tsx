// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
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
