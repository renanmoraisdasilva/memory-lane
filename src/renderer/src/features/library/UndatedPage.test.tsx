// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockPhaseOneClient } from "../../lib/ipc-client.mock";
import { createMockDrives, mockCatalogSummary, mockVolumeIds } from "../../lib/mock-fixtures";
import { renderWithProviders } from "../../test/render";
import { createLibraryFixtureClient, libraryFixtureItems } from "../../test/library-fixtures";
import { UndatedPage } from "./UndatedPage";
import type { LibraryUndatedItem } from "./types";

function readyDrive() {
  const drive = createMockDrives("catalog").find(
    (candidate) => candidate.volumeId === mockVolumeIds.ready,
  );
  if (drive === undefined) {
    throw new Error("The ready mock drive is missing");
  }
  return drive;
}

function undatedItem(): LibraryUndatedItem {
  const item = libraryFixtureItems[0];
  if (item === undefined) {
    throw new Error("The library fixture is missing");
  }
  return {
    ...item,
    date: { value: null, precision: null, source: null, isOverride: false },
    folder: "E:\\Archive\\Undated",
  };
}

function renderUndated(
  client = createLibraryFixtureClient({ undatedItems: [undatedItem()] }),
): void {
  const drive = readyDrive();
  renderWithProviders(<UndatedPage />, {
    client: createMockPhaseOneClient({ scenario: "catalog" }),
    libraryClient: client,
    workspace: { drive, catalog: mockCatalogSummary(drive) },
    initialEntries: ["/undated"],
  });
}

afterEach(() => {
  cleanup();
});

describe("UndatedPage", () => {
  it("selects undated items and assigns a year/month date", async () => {
    const client = createLibraryFixtureClient({ undatedItems: [undatedItem()] });
    const setDate = vi.spyOn(client, "setDate");
    renderUndated(client);

    expect(
      await screen.findByRole("heading", { name: "Items without a resolved date" }),
    ).toBeVisible();
    expect(await screen.findByText(/1 items need a date/)).toBeVisible();
    expect(await screen.findByLabelText("Select DSC_4910.JPG")).not.toBeChecked();

    await userEvent.click(screen.getByLabelText("Select DSC_4910.JPG"));
    expect(screen.getByText(/1 visible · 1 selected/)).toBeVisible();

    await userEvent.type(screen.getByLabelText("Year"), "2011");
    await userEvent.selectOptions(screen.getByLabelText("Month"), "7");
    expect(screen.getByText("July 2011")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Apply to catalog" }));

    await waitFor(() => {
      expect(setDate).toHaveBeenCalledWith({ fileIds: [1], year: 2011, month: 7 });
    });
    expect(await screen.findByText("No items need a date")).toBeVisible();
  });

  it("shows an empty state when every media item has a date", async () => {
    renderUndated(createLibraryFixtureClient({ undatedItems: [] }));

    expect(await screen.findByText("No items need a date")).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to Memory Lane" })).toHaveAttribute(
      "href",
      "/library",
    );
  });
});
