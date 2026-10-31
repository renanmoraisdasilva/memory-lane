// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLocation } from "react-router-dom";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { createMockPhaseOneClient } from "../../lib/ipc-client.mock";
import { createMockDrives, mockCatalogSummary, mockVolumeIds } from "../../lib/mock-fixtures";
import { renderWithProviders } from "../../test/render";
import {
  createLargeLibraryFixture,
  createLibraryFixtureClient,
  libraryFixtureItems,
} from "../../test/library-fixtures";
import { LibraryPage } from "./LibraryPage";
import type { LibraryClient } from "./library-client";
import type { LibrarySummary } from "./types";

function readyDrive() {
  const drive = createMockDrives("catalog").find(
    (candidate) => candidate.volumeId === mockVolumeIds.ready,
  );
  if (drive === undefined) {
    throw new Error("The ready mock drive is missing");
  }
  return drive;
}

function LocationProbe(): React.JSX.Element {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderLibrary(
  libraryClient: LibraryClient = createLibraryFixtureClient(),
  initialEntries: string[] = ["/library"],
): void {
  const drive = readyDrive();
  renderWithProviders(
    <>
      <LibraryPage />
      <LocationProbe />
    </>,
    {
      client: createMockPhaseOneClient({ scenario: "catalog" }),
      libraryClient,
      workspace: { drive, catalog: mockCatalogSummary(drive) },
      initialEntries,
    },
  );
}

afterEach(() => {
  cleanup();
});

describe("LibraryPage", () => {
  it("shows a loading state while the summary loads", () => {
    const base = createLibraryFixtureClient();
    renderLibrary({
      ...base,
      getSummary: () => new Promise<LibrarySummary>(() => undefined),
    });

    expect(screen.getByText("Loading Memory Lane…")).toBeInTheDocument();
    expect(screen.getByText("Loading library summary…")).toBeInTheDocument();
  });

  it("shows the populated timeline with header, filters, density, and grouped media", async () => {
    renderLibrary();

    expect(await screen.findByRole("heading", { name: "Memory Lane" })).toBeInTheDocument();
    expect(screen.getByText(/photos and videos/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Comfortable" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await screen.findByText("August 2024")).toBeInTheDocument();
    expect((await screen.findAllByText("Day")).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "DSC_4910.JPG, photo" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "MOV_0428.MP4, video" })).toBeInTheDocument();
    expect(screen.getByText("03:24")).toBeInTheDocument();
  });

  it("filters to photos and updates the timeline query", async () => {
    const client = createLibraryFixtureClient();
    const timelineSpy = vi.spyOn(client, "getTimeline");
    renderLibrary(client);

    await screen.findByRole("link", { name: "DSC_4910.JPG, photo" });
    await userEvent.click(screen.getByRole("button", { name: "Photos" }));

    await waitFor(() => {
      expect(timelineSpy).toHaveBeenCalledWith(expect.objectContaining({ filter: "photos" }));
    });
    await waitFor(() => {
      expect(screen.queryByRole("link", { name: /MP4, video/ })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Photos" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the empty-filter state when a filter has no media", async () => {
    renderLibrary(
      createLibraryFixtureClient({
        items: libraryFixtureItems.filter((item) => item.mediaClass === "image"),
      }),
    );

    await screen.findByRole("heading", { name: "Memory Lane" });
    await userEvent.click(screen.getByRole("button", { name: "Videos" }));

    expect(await screen.findByText("No videos in this catalog")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Show all media" }));
    expect(await screen.findByRole("link", { name: "DSC_4910.JPG, photo" })).toBeInTheDocument();
  });

  it("shows the no-media state for a catalog without photos or videos", async () => {
    renderLibrary(createLibraryFixtureClient({ items: [] }));

    expect(await screen.findByText("No photos or videos yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open Scan & processing/ })).toBeInTheDocument();
  });

  it("shows a drive-unavailable state when the summary fails", async () => {
    const base = createLibraryFixtureClient();
    renderLibrary({
      ...base,
      getSummary: () =>
        Promise.reject(new AppError(APP_ERROR_CODES.DRIVE_NOT_FOUND, "The drive is disconnected")),
    });

    expect(await screen.findByText("Drive unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("navigates by year and adjacent month", async () => {
    const client = createLibraryFixtureClient();
    const timelineSpy = vi.spyOn(client, "getTimeline");
    renderLibrary(client);

    await screen.findByRole("heading", { name: "Memory Lane" });
    await userEvent.click(await screen.findByRole("button", { name: "2024" }));

    await waitFor(() => {
      expect(timelineSpy).toHaveBeenCalledWith(expect.objectContaining({ year: 2024 }));
    });

    await userEvent.click(screen.getByRole("button", { name: "Next month" }));

    await waitFor(() => {
      expect(timelineSpy).toHaveBeenCalledWith(expect.objectContaining({ year: 2024, month: 6 }));
    });
    expect(screen.getByText("June 2024")).toBeInTheDocument();
  });

  it("changes density and keeps the selected density in the URL", async () => {
    renderLibrary();

    await screen.findByRole("heading", { name: "Memory Lane" });
    await userEvent.click(screen.getByRole("button", { name: "Dense" }));

    expect(screen.getByRole("button", { name: "Dense" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("location")).toHaveTextContent("density=dense");
    expect(screen.getByRole("link", { name: "DSC_4910.JPG, photo" })).toBeInTheDocument();
  });

  it("renders thumbnail skeletons, ready images, and failed placeholders", async () => {
    const pending = libraryFixtureItems.find((item) => item.fileId === 8);
    const failed = libraryFixtureItems.find((item) => item.fileId === 9);
    if (pending === undefined || failed === undefined) {
      throw new Error("The thumbnail fixtures are missing");
    }
    renderLibrary(createLibraryFixtureClient({ items: [pending, failed] }));

    const pendingTile = await screen.findByRole("link", { name: "PENDING_001.JPG, photo" });
    expect(pendingTile).toHaveAttribute("data-thumbnail-state", "skeleton");

    const failedTile = screen.getByRole("link", { name: "FAILED_001.JPG, photo" });
    expect(failedTile).toHaveAttribute("data-thumbnail-state", "failed");
    expect(within(failedTile).getByText("Preview unavailable")).toBeInTheDocument();
  });

  it("removes the skeleton when a thumbnail image loads", async () => {
    const item = libraryFixtureItems.find((candidate) => candidate.fileId === 1);
    if (item === undefined) {
      throw new Error("The ready thumbnail fixture is missing");
    }
    renderLibrary(createLibraryFixtureClient({ items: [item] }));

    const tile = await screen.findByRole("link", { name: "DSC_4910.JPG, photo" });
    expect(tile).toHaveAttribute("data-thumbnail-state", "skeleton");
    const image = tile.querySelector("img");
    if (image === null) {
      throw new Error("The thumbnail image is missing");
    }
    fireEvent.load(image);
    await waitFor(() => {
      expect(tile).toHaveAttribute("data-thumbnail-state", "ready");
    });
  });

  it("shows missing and video badges on tiles", async () => {
    renderLibrary();

    const missingTile = await screen.findByRole("link", {
      name: /MISSING_001.JPG, photo, missing file/,
    });
    expect(within(missingTile).getByText("Missing")).toBeInTheDocument();
    expect(screen.getByText("03:24")).toBeInTheDocument();
  });

  it("only mounts a bounded number of tiles for a large fixture", async () => {
    const items = createLargeLibraryFixture(500);
    renderLibrary(createLibraryFixtureClient({ items }));

    await screen.findByRole("heading", { name: "Memory Lane" });
    const tiles = await screen.findAllByRole("link", { name: /, (photo|video)/ });
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.length).toBeLessThan(80);
  });
});
