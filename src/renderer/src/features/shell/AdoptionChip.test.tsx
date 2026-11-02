// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdoptionState } from "@shared/contracts/replication/types";
import { useActiveAdoptions } from "../replication/use-replication";
import { AdoptionChip } from "./AdoptionChip";

vi.mock("../replication/use-replication", () => ({
  useActiveAdoptions: vi.fn(),
}));

const mocked = vi.mocked(useActiveAdoptions);

function adoption(overrides: Partial<AdoptionState> = {}): AdoptionState {
  return {
    destinationId: "dest-1",
    status: "scanning",
    startedAt: "2026-11-01T12:00:00.000Z",
    finishedAt: null,
    lastSavedAt: "2026-11-01T12:00:10.000Z",
    scannedFiles: 42,
    matchedFiles: 40,
    verifiedFiles: 40,
    conflictFiles: 0,
    staleFiles: 0,
    ambiguousFiles: 2,
    extraFiles: 0,
    unreadableFiles: 0,
    currentFile: "photos/a.jpg",
    totalFiles: 100,
    etaSeconds: 30,
    errorMessage: null,
    canPause: true,
    canResume: false,
    ...overrides,
  };
}

function renderChip(states: AdoptionState[] | undefined) {
  mocked.mockReturnValue({ data: states } as ReturnType<typeof useActiveAdoptions>);
  return render(
    <MemoryRouter>
      <AdoptionChip />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AdoptionChip", () => {
  it("shows adoption progress and links to the destination", () => {
    renderChip([adoption()]);

    const link = screen.getByRole("link", { name: "Adopting drive · 42%" });
    expect(link).toBeVisible();
    expect(link).toHaveAttribute("href", "/backup/destinations/dest-1");
    expect(link).toHaveAttribute("title", "Open destination adoption");
  });

  it("omits the percentage until the destination scan is counted", () => {
    renderChip([adoption({ totalFiles: 0, scannedFiles: 0 })]);
    expect(screen.getByText("Adopting drive")).toBeVisible();
  });

  it("clamps progress to 100 percent", () => {
    renderChip([adoption({ scannedFiles: 200, totalFiles: 100 })]);
    expect(screen.getByText("Adopting drive · 100%")).toBeVisible();
  });

  it("shows paused and interrupted adoptions", () => {
    renderChip([adoption({ status: "paused", canPause: false, canResume: true })]);
    expect(screen.getByText("Adoption paused")).toBeVisible();
    cleanup();
    renderChip([adoption({ status: "interrupted", canPause: false, canResume: true })]);
    expect(screen.getByText("Adoption interrupted")).toBeVisible();
  });

  it("prefers a running adoption when several need attention", () => {
    renderChip([
      adoption({ destinationId: "dest-paused", status: "paused" }),
      adoption({ destinationId: "dest-scan", status: "scanning" }),
    ]);
    expect(screen.getByRole("link", { name: /Adopting drive/ })).toHaveAttribute(
      "href",
      "/backup/destinations/dest-scan",
    );
  });

  it("renders nothing when no adoption is active", () => {
    renderChip([]);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
