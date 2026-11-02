// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
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
