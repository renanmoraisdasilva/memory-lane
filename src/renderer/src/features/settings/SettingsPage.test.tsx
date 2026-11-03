// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockPhaseOneClient } from "../../lib/ipc-client.mock";
import { createMockDrives, mockCatalogSummary, mockVolumeIds } from "../../lib/mock-fixtures";
import { renderWithProviders } from "../../test/render";
import { createLibraryFixtureClient } from "../../test/library-fixtures";
import { settingsFixture } from "../../test/phase-five-fixtures";
import { SettingsPage } from "./SettingsPage";

function renderSettings(): ReturnType<typeof createLibraryFixtureClient> {
  const drive = createMockDrives("catalog").find(
    (candidate) => candidate.volumeId === mockVolumeIds.ready,
  );
  if (drive === undefined) {
    throw new Error("The ready mock drive is missing");
  }
  const client = createLibraryFixtureClient({
    settings: {
      ...settingsFixture,
      backup: {
        ...settingsFixture.backup,
        lastBackupAt: "2026-10-31T11:45:00.000Z",
        lastStatus: "success",
        lastBytes: 2 * 1024 ** 2,
      },
    },
  });
  renderWithProviders(<SettingsPage />, {
    client: createMockPhaseOneClient({ scenario: "catalog" }),
    libraryClient: client,
    workspace: { drive, catalog: mockCatalogSummary(drive) },
    initialEntries: ["/settings"],
  });
  return client;
}

afterEach(() => {
  cleanup();
});

describe("SettingsPage", () => {
  it("[ML-SET-001] [ML-SET-012] [ML-REL-001] [ML-REL-010] shows storage, catalog, backup, and app information", async () => {
    renderSettings();

    expect(await screen.findByRole("heading", { name: "Storage and app details" })).toBeVisible();
    expect(screen.getByText("C:\\archive\\cache")).toBeVisible();
    expect(screen.getByText("C:\\archive\\catalog.db")).toBeVisible();
    expect(screen.getByText("Last backup succeeded")).toBeVisible();
    expect(screen.getByText("Offline by design")).toBeVisible();
    expect(screen.getByRole("link", { name: /Open scan & processing/ })).toHaveAttribute(
      "href",
      "/scan",
    );
  });

  it("[ML-LIB-010] [ML-SET-002] [ML-REL-010] confirms cache clearing and reports the result", async () => {
    const client = renderSettings();
    const clear = vi.spyOn(client, "clearCache");
    await screen.findByRole("heading", { name: "Storage and app details" });

    await userEvent.click(screen.getByRole("button", { name: "Clear generated cache" }));
    const dialog = screen.getByRole("dialog", { name: "Clear generated cache?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Clear cache" }));

    expect(await screen.findByText("Cache cleared")).toBeVisible();
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("[ML-SET-006] [ML-REL-010] runs a backup on demand and surfaces failures", async () => {
    const client = renderSettings();
    const backup = vi.spyOn(client, "runBackup");
    await screen.findByRole("heading", { name: "Storage and app details" });

    await userEvent.click(screen.getByRole("button", { name: "Back up now" }));
    expect(await screen.findByText("Backup complete")).toBeVisible();
    expect(backup).toHaveBeenCalledTimes(1);

    vi.spyOn(client, "clearCache").mockRejectedValueOnce(new Error("Cache is locked"));
    await userEvent.click(screen.getByRole("button", { name: "Clear generated cache" }));
    const dialog = screen.getByRole("dialog", { name: "Clear generated cache?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Clear cache" }));
    await waitFor(() => {
      expect(screen.getByText("Cache is locked")).toBeVisible();
    });
  });
});
