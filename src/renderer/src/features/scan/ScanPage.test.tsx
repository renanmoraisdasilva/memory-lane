// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { createMockPhaseOneClient } from "../../lib/ipc-client.mock";
import { createMockDrives, mockCatalogSummary, mockVolumeIds } from "../../lib/mock-fixtures";
import { createScanFixture } from "../../lib/mock-scan-controller";
import { renderWithProviders } from "../../test/render";
import { createLibraryFixtureClient } from "../../test/library-fixtures";
import type { LibraryClient } from "../library/library-client";
import type { PhaseOneClient } from "../../lib/phase-one-client";
import { ScanPage } from "./ScanPage";
import type { ScanState, ScanStatus } from "./types";

function readyDrive() {
  const drive = createMockDrives("catalog").find(
    (candidate) => candidate.volumeId === mockVolumeIds.ready,
  );
  if (drive === undefined) {
    throw new Error("The ready mock drive is missing");
  }
  return drive;
}

function fixture(status: ScanStatus): ScanState {
  const drive = readyDrive();
  return createScanFixture(status, drive.label, drive.volumeId);
}

function renderScan(
  state: ScanState | null,
  overrides: Partial<PhaseOneClient> = {},
  libraryClient: LibraryClient = createLibraryFixtureClient(),
): { drive: ReturnType<typeof readyDrive>; client: PhaseOneClient } {
  const drive = readyDrive();
  const base = createMockPhaseOneClient({
    scenario: "catalog",
    scanStates: state === null ? {} : { [drive.volumeId]: state },
  });
  const client: PhaseOneClient = { ...base, ...overrides };
  renderWithProviders(<ScanPage />, {
    client,
    libraryClient,
    workspace: { drive, catalog: mockCatalogSummary(drive) },
    initialEntries: ["/scan"],
  });
  return { drive, client };
}

afterEach(() => {
  cleanup();
});

describe("ScanPage", () => {
  it("shows the idle state with a working start action", async () => {
    renderScan(null);

    expect(await screen.findByRole("heading", { name: "Ready to scan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start scan" })).toBeInTheDocument();
    expect(screen.getByText("Available while you scan")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Balanced/ })).toBeChecked();
  });

  it("shows the active state with stages and a pause action", async () => {
    renderScan(fixture("active"));

    expect(
      await screen.findByRole("heading", { name: "Scanning WD My Passport 2TB" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "2. Extract metadata" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    expect(screen.getByText("83,000 / 97,902 files")).toBeInTheDocument();
  });

  it("pauses and resumes the scan", async () => {
    renderScan(fixture("active"));

    await userEvent.click(await screen.findByRole("button", { name: "Pause" }));

    expect(
      await screen.findByRole("heading", { name: "Background processing paused" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Resume scan" }));

    expect(
      await screen.findByRole("heading", { name: "Scanning WD My Passport 2TB" }),
    ).toBeInTheDocument();
  });

  it("changes the processing intensity", async () => {
    renderScan(fixture("active"));

    const max = await screen.findByRole("radio", { name: /Max/ });
    await userEvent.click(max);

    await waitFor(() => {
      expect(max).toBeChecked();
    });
  });

  it("shows the paused state with resume guidance", async () => {
    renderScan(fixture("paused"));

    expect(
      await screen.findByRole("heading", { name: "Background processing paused" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No work is lost")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resume scan" })).toBeInTheDocument();
  });

  it("shows the interrupted state with manual resume and switch-drive actions", async () => {
    renderScan(fixture("interrupted"));

    expect(await screen.findByRole("heading", { name: /Scan stopped/ })).toBeInTheDocument();
    expect(screen.getByText("Why resume is manual")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch drive" })).toBeInTheDocument();
  });

  it("shows the completion report and starts another scan", async () => {
    renderScan(fixture("complete"));

    expect(await screen.findByRole("heading", { name: "Scan complete" })).toBeInTheDocument();
    expect(screen.getByText("3,240")).toBeInTheDocument();
    expect(screen.getByText("Changed files")).toBeInTheDocument();
    expect(screen.getByText("Missing files")).toBeInTheDocument();
    expect(screen.getByText("Likely moved")).toBeInTheDocument();
    expect(screen.getByText("What's ready now")).toBeInTheDocument();
    expect(screen.getByText("Scan report")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Open Memory Lane" })).toHaveAttribute(
      "href",
      "/library",
    );

    await userEvent.click(screen.getByRole("button", { name: "Scan again" }));

    expect(await screen.findByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("hides the library handoff when the catalog contains no media", async () => {
    renderScan(fixture("complete"), {}, createLibraryFixtureClient({ items: [] }));

    expect(await screen.findByRole("heading", { name: "Scan complete" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("link", { name: "Open Memory Lane" })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Scan again" })).toBeInTheDocument();
  });

  it("shows the error state with resume, retry, and switch-drive actions", async () => {
    renderScan(fixture("error"));

    expect(await screen.findByRole("heading", { name: "Scan unavailable" })).toBeInTheDocument();
    expect(
      screen.getByText("The drive was disconnected before the catalog stage completed."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resume scan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry status" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch drive" })).toBeInTheDocument();
  });

  it("communicates an unknown stage total honestly", async () => {
    const active = fixture("active");
    const stages = active.stages.map((stage) =>
      stage.id === "metadata" ? { ...stage, total: null } : stage,
    );
    renderScan({ ...active, stages });

    expect(
      await screen.findByText(/83,000 processed · total being discovered/),
    ).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Extract metadata progress" })).toHaveAttribute(
      "aria-valuetext",
      "Total being discovered",
    );
  });

  it("shows a loading state while scan status is fetched", () => {
    renderScan(null, { getScanState: () => new Promise<ScanState | null>(() => undefined) });

    expect(screen.getByText("Checking scan status…")).toBeInTheDocument();
  });

  it("shows a drive-unavailable state when the scan query fails", async () => {
    renderScan(fixture("active"), {
      getScanState: () => Promise.reject(new Error("The drive is not connected")),
    });

    expect(await screen.findByText("Drive unavailable")).toBeInTheDocument();
    expect(screen.getByText(/The drive is not connected/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry status" })).toBeInTheDocument();
  });

  it("shows scan details and the read-only context", async () => {
    renderScan(fixture("active"));

    expect(await screen.findByText("Scan details")).toBeInTheDocument();
    expect(screen.getByText(/Read-only access/)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText(/\.memorylane\\catalog\.db/)).toBeInTheDocument();
  });
});
