// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ValidationState } from "@shared/contracts/health";
import { createMockPhaseOneClient } from "../../lib/ipc-client.mock";
import { createMockDrives, mockCatalogSummary, mockVolumeIds } from "../../lib/mock-fixtures";
import { renderWithProviders } from "../../test/render";
import { createLibraryFixtureClient } from "../../test/library-fixtures";
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

function renderHealth(): void {
  const drive = createMockDrives("catalog").find(
    (candidate) => candidate.volumeId === mockVolumeIds.ready,
  );
  if (drive === undefined) {
    throw new Error("The ready mock drive is missing");
  }
  renderWithProviders(<HealthPage />, {
    client: createMockPhaseOneClient({ scenario: "catalog" }),
    libraryClient: createLibraryFixtureClient(),
    workspace: { drive, catalog: mockCatalogSummary(drive) },
    initialEntries: ["/health"],
  });
}

afterEach(() => {
  cleanup();
});

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
