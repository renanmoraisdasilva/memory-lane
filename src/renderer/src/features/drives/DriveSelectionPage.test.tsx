// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLocation } from "react-router-dom";
import type { DriveSelectionItem } from "./types";
import { DriveSelectionPage } from "./DriveSelectionPage";
import { createMockPhaseOneClient } from "../../lib/ipc-client.mock";
import { mockVolumeIds } from "../../lib/mock-fixtures";
import { renderWithProviders } from "../../test/render";

function LocationProbe(): React.JSX.Element {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function renderGate(client = createMockPhaseOneClient({ scenario: "catalog" })): void {
  renderWithProviders(
    <>
      <DriveSelectionPage />
      <LocationProbe />
    </>,
    { client },
  );
}

function cardFor(name: RegExp): HTMLElement {
  return screen.getByRole("article", { name });
}

afterEach(() => {
  cleanup();
});

describe("DriveSelectionPage", () => {
  it("opens an existing catalog and navigates to the library", async () => {
    renderGate();

    const card = await screen.findByRole("article", { name: /WD My Passport 2TB/ });
    expect(within(card).getByText("Catalog found")).toBeInTheDocument();

    await userEvent.click(within(card).getByRole("button", { name: /Open Memory Lane on/ }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/library");
    });
  });

  it("[ML-REL-003] sets up a new catalog and starts the first scan", async () => {
    const base = createMockPhaseOneClient({ scenario: "mixed" });
    const initializeCatalog = vi.fn(base.initializeCatalog);
    const startScan = vi.fn(base.startScan);
    renderGate({ ...base, initializeCatalog, startScan });

    const card = await screen.findByRole("article", { name: /Samsung T7 Shield/ });
    await userEvent.click(within(card).getByRole("button", { name: /Set up a new catalog on/ }));

    const dialog = screen.getByRole("dialog", { name: "Set up a new archive" });
    expect(within(dialog).getByText("F:\\.memorylane\\catalog.db")).toBeInTheDocument();
    expect(within(dialog).getByText("F:\\.memorylane\\cache")).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Start first scan" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/scan");
    });
    expect(initializeCatalog).toHaveBeenCalledWith(mockVolumeIds.fresh);
    expect(startScan).toHaveBeenCalledWith(mockVolumeIds.fresh);
  });

  it("shows an offline registered drive with a disabled action and a reason", async () => {
    renderGate(createMockPhaseOneClient({ scenario: "mixed" }));

    const card = await screen.findByRole("article", { name: /Seagate Backup Plus 4TB/ });
    expect(within(card).getByText("Not connected")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Reconnect to browse" })).toBeDisabled();
    expect(
      within(card).getByText(/Connect this drive, then choose Rescan drives/),
    ).toBeInTheDocument();
    expect(within(card).queryByText(/volume type is not supported/i)).not.toBeInTheDocument();
  });

  it("shows the no-external-drive empty state", async () => {
    renderGate(createMockPhaseOneClient({ scenario: "empty" }));

    expect(await screen.findByText("No external drives detected")).toBeInTheDocument();
    expect(screen.getByText(/Connect an external drive, then rescan/)).toBeInTheDocument();
  });

  it("keeps the Windows system drive visible but unsupported", async () => {
    renderGate(createMockPhaseOneClient({ scenario: "catalog" }));

    const card = await screen.findByRole("article", { name: /Windows \(C:\)/ });
    expect(
      within(card).getByText(
        "Windows system drive. Memory Lane only catalogs external volumes, so this drive cannot be opened or set up.",
      ),
    ).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Not supported" })).toBeDisabled();
  });

  it("[ML-REL-003] confirms a changed drive letter", async () => {
    const base = createMockPhaseOneClient({ scenario: "letter-change" });
    const confirmDriveLetter = vi.fn(base.confirmDriveLetter);
    renderGate({ ...base, confirmDriveLetter });

    const card = await screen.findByRole("article", { name: /Archive Passport 2TB/ });
    await userEvent.click(within(card).getByRole("button", { name: "Review new letter" }));

    const dialog = screen.getByRole("dialog", { name: "This drive has a new letter" });
    expect(within(dialog).getByText("G:\\.memorylane\\catalog.db")).toBeInTheDocument();
    expect(within(dialog).getByText("H:\\.memorylane\\catalog.db")).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Update to H:" }));

    expect(await screen.findByText(/Catalog root updated to H:/)).toBeInTheDocument();
    expect(confirmDriveLetter).toHaveBeenCalledWith(mockVolumeIds.letterChange);
  });

  it("shows a loading state while drives are listed", () => {
    const base = createMockPhaseOneClient({ scenario: "mixed" });
    renderGate({
      ...base,
      listDrives: () => new Promise<DriveSelectionItem[]>(() => undefined),
    });

    expect(screen.getByText("Scanning Windows volumes and registered drives…")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Looking for drives…" })).toBeInTheDocument();
  });

  it("shows a drive-list error with a retry action", async () => {
    const base = createMockPhaseOneClient({ scenario: "mixed" });
    renderGate({ ...base, listDrives: () => Promise.reject(new Error("Storage service offline")) });

    expect(await screen.findByText("Storage service offline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("labels connected and offline drives", async () => {
    renderGate(createMockPhaseOneClient({ scenario: "mixed" }));

    const ready = await screen.findByRole("article", { name: /WD My Passport 2TB/ });
    const fresh = cardFor(/Samsung T7 Shield/);
    expect(within(ready).getByText("Connected")).toBeInTheDocument();
    expect(within(fresh).getByText("No catalog")).toBeInTheDocument();
  });
});
