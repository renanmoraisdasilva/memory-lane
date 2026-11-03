// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Route, Routes, useLocation } from "react-router-dom";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { createMockPhaseOneClient } from "../../lib/ipc-client.mock";
import { createMockDrives, mockCatalogSummary, mockVolumeIds } from "../../lib/mock-fixtures";
import { renderWithProviders } from "../../test/render";
import { createLibraryFixtureClient } from "../../test/library-fixtures";
import { MediaViewerPage } from "./MediaViewerPage";
import { ViewerShell } from "./ViewerShell";
import type { LibraryClient } from "./library-client";
import type { LibraryItemDetails } from "./types";

function LocationProbe(): React.JSX.Element {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

async function detailsFor(
  fileId: number,
  filter: "all" | "photos" | "videos" = "all",
  client: LibraryClient = createLibraryFixtureClient(),
): Promise<LibraryItemDetails> {
  return client.getItem({ fileId, filter });
}

function renderViewer(details: LibraryItemDetails, libraryClient: LibraryClient): void {
  renderWithProviders(
    <>
      <MediaViewerPage details={details} filter="photos" density="comfortable" />
      <LocationProbe />
    </>,
    {
      client: createMockPhaseOneClient({ scenario: "catalog" }),
      libraryClient,
      initialEntries: [`/library/item/${String(details.item.fileId)}?filter=photos`],
    },
  );
}

function readyDrive() {
  const drive = createMockDrives("catalog").find(
    (candidate) => candidate.volumeId === mockVolumeIds.ready,
  );
  if (drive === undefined) {
    throw new Error("The ready mock drive is missing");
  }
  return drive;
}

afterEach(() => {
  cleanup();
});

describe("MediaViewerPage", () => {
  it("[ML-REL-006] renders the photo state with metadata and actions", async () => {
    const client = createLibraryFixtureClient();
    const reveal = vi.spyOn(client, "revealItem");
    const details = await detailsFor(1, "photos", client);
    renderViewer(details, client);

    expect(screen.getByRole("heading", { name: "DSC_4910.JPG" })).toBeInTheDocument();
    expect(screen.getByText("1 of 8")).toBeInTheDocument();
    expect(screen.getAllByText(/2024/).length).toBeGreaterThan(0);
    expect(screen.getByText("JPEG")).toBeInTheDocument();
    expect(screen.getByText("E:\\Archive\\DSC_4910.JPG")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Photo zoom" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Reveal in Explorer" }));
    await waitFor(() => {
      expect(reveal).toHaveBeenCalledWith({ fileId: 1 });
    });
    expect(await screen.findByText("Revealed in Explorer.")).toBeInTheDocument();
  });

  it("[ML-REL-007] opens the date dialog and applies a year/month override", async () => {
    const client = createLibraryFixtureClient();
    const setDate = vi.spyOn(client, "setDate");
    const details = await detailsFor(1, "photos", client);
    renderViewer(details, client);

    await userEvent.click(screen.getByRole("button", { name: "Set date" }));
    const dialog = screen.getByRole("dialog", { name: "Set catalog date" });
    expect(dialog).toBeVisible();

    const year = within(dialog).getByLabelText("Year");
    await userEvent.clear(year);
    await userEvent.type(year, "2011");
    await userEvent.selectOptions(within(dialog).getByLabelText("Month"), "7");
    await userEvent.click(within(dialog).getByRole("button", { name: "Apply to catalog" }));

    await waitFor(() => {
      expect(setDate).toHaveBeenCalledWith({ fileIds: [1], year: 2011, month: 7 });
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Set catalog date" })).not.toBeInTheDocument();
    });
    expect(screen.getByText(/Catalog date updated/)).toBeInTheDocument();
  });

  it("[ML-VIDEO-001] [ML-REL-006] renders the video state with native controls and a poster", async () => {
    const client = createLibraryFixtureClient();
    const details = await detailsFor(2, "videos", client);
    const { container } = renderWithProviders(
      <MediaViewerPage details={details} filter="videos" density="comfortable" />,
      {
        client: createMockPhaseOneClient({ scenario: "catalog" }),
        libraryClient: client,
        initialEntries: ["/library/item/2?filter=videos"],
      },
    );

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("poster", "ml-media://thumbnail/2");
    expect(screen.getByText("Native controls · read-only original")).toBeInTheDocument();
    expect(screen.getByText("03:24")).toBeInTheDocument();
    expect(screen.getByText("Frame rate")).toBeInTheDocument();
    expect(screen.getByText("29.97 fps")).toBeInTheDocument();
  });

  it("[ML-LIB-005] keeps metadata visible and disables actions for a missing file", async () => {
    const client = createLibraryFixtureClient();
    const details = await detailsFor(7, "photos", client);
    renderViewer(details, client);

    expect(await screen.findByText("File missing")).toBeInTheDocument();
    expect(screen.getByText("JPEG")).toBeInTheDocument();
    expect(screen.getByText("E:\\Archive\\MISSING_001.JPG")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reveal in Explorer" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Open externally" })).toBeDisabled();
    expect(
      screen.getByText(/This file is not available on the connected drive/),
    ).toBeInTheDocument();
  });

  it("[ML-REL-015] shows an unsupported image message and can open it externally", async () => {
    const client = createLibraryFixtureClient();
    const open = vi.spyOn(client, "openItem");
    const details = await detailsFor(1, "photos", client);
    const { container } = renderWithProviders(
      <MediaViewerPage details={details} filter="photos" density="comfortable" />,
      {
        client: createMockPhaseOneClient({ scenario: "catalog" }),
        libraryClient: client,
        initialEntries: ["/library/item/1?filter=photos"],
      },
    );

    const image = container.querySelector("img");
    if (image === null) {
      throw new Error("The photo image is missing");
    }
    fireEvent.error(image);

    expect(await screen.findByText("This image cannot be displayed here")).toBeInTheDocument();
    const status = screen.getByRole("status");
    await userEvent.click(within(status).getByRole("button", { name: "Open externally" }));
    await waitFor(() => {
      expect(open).toHaveBeenCalledWith({ fileId: 1 });
    });
  });

  it("[ML-VIDEO-001] [ML-VIDEO-007] [ML-REL-015] shows a preparation failure when a video cannot be converted", async () => {
    const client = createLibraryFixtureClient();
    const details = await detailsFor(2, "videos", client);
    const { container } = renderWithProviders(
      <MediaViewerPage details={details} filter="videos" density="comfortable" />,
      {
        client: createMockPhaseOneClient({ scenario: "catalog" }),
        libraryClient: client,
        initialEntries: ["/library/item/2?filter=videos"],
      },
    );

    const video = container.querySelector("video");
    if (video === null) {
      throw new Error("The video element is missing");
    }
    fireEvent.error(video);

    expect(
      await screen.findByText("This video could not be prepared for playback"),
    ).toBeInTheDocument();
    const status = screen.getByRole("status");
    expect(within(status).getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(within(status).getByRole("button", { name: "Open externally" })).toBeInTheDocument();
  });

  it("[ML-VIDEO-001] prepares a compatible copy for WMV playback", async () => {
    const client = createLibraryFixtureClient();
    const details = await detailsFor(2, "videos", client);
    const wmv: LibraryItemDetails = {
      ...details,
      item: { ...details.item, name: "MOV_0428.WMV", format: "WMV" },
    };
    vi.spyOn(client, "prepareVideoProxy").mockResolvedValue({
      fileId: 2,
      status: "processing",
      progress: 0.4,
      mediaUrl: null,
      errorMessage: null,
    });
    vi.spyOn(client, "getVideoProxyState").mockResolvedValue({
      fileId: 2,
      status: "ready",
      progress: 1,
      mediaUrl: "ml-media://proxy/2",
      errorMessage: null,
    });

    const { container } = renderWithProviders(
      <MediaViewerPage details={wmv} filter="videos" density="comfortable" />,
      {
        client: createMockPhaseOneClient({ scenario: "catalog" }),
        libraryClient: client,
        initialEntries: ["/library/item/2?filter=videos"],
      },
    );

    expect(await screen.findByText("Preparing compatible playback")).toBeInTheDocument();
    await waitFor(
      () => {
        expect(container.querySelector("video")).toHaveAttribute("src", "ml-media://proxy/2");
      },
      { timeout: 3000 },
    );
  });

  it("shows a thumbnail placeholder for a video without a poster", async () => {
    const client = createLibraryFixtureClient();
    const details = await detailsFor(10, "videos", client);
    renderViewer(details, client);

    expect(await screen.findByText("Thumbnail unavailable")).toBeInTheDocument();
    expect(screen.getByText("01:15")).toBeInTheDocument();
    expect(screen.getByText("Not recorded")).toBeInTheDocument();
  });

  it("surfaces reveal and open errors", async () => {
    const client = createLibraryFixtureClient({
      failures: { reveal: new Error("Explorer could not reveal this file") },
    });
    const details = await detailsFor(1, "photos", client);
    renderViewer(details, client);

    await userEvent.click(screen.getByRole("button", { name: "Reveal in Explorer" }));

    expect(await screen.findByText("Explorer could not reveal this file")).toBeInTheDocument();
  });

  it("[ML-LIB-004] navigates with arrow keys and returns to the filtered library with Escape", async () => {
    const client = createLibraryFixtureClient();
    const details = await detailsFor(7, "photos", client);
    renderViewer(details, client);

    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/library/item/1?filter=photos");
    });

    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/library/item/8?filter=photos");
    });

    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/library?filter=photos");
    });
  });

  it("does not navigate with arrow keys while a media control has focus", async () => {
    const client = createLibraryFixtureClient();
    const details = await detailsFor(2, "videos", client);
    const { container } = renderWithProviders(
      <>
        <MediaViewerPage details={details} filter="videos" density="comfortable" />
        <LocationProbe />
      </>,
      {
        client: createMockPhaseOneClient({ scenario: "catalog" }),
        libraryClient: client,
        initialEntries: ["/library/item/2?filter=videos"],
      },
    );

    const video = container.querySelector("video");
    if (video === null) {
      throw new Error("The video element is missing");
    }
    fireEvent.keyDown(video, { key: "ArrowLeft" });

    expect(screen.getByTestId("location")).toHaveTextContent("/library/item/2?filter=videos");
  });

  it("shows the filename breadcrumb in the viewer shell", async () => {
    const client = createLibraryFixtureClient();
    const drive = readyDrive();
    renderWithProviders(
      <Routes>
        <Route path="/library/item/:fileId" element={<ViewerShell />} />
      </Routes>,
      {
        client: createMockPhaseOneClient({ scenario: "catalog" }),
        libraryClient: client,
        workspace: { drive, catalog: mockCatalogSummary(drive) },
        initialEntries: ["/library/item/1?filter=photos"],
      },
    );

    expect(await screen.findByRole("heading", { name: "DSC_4910.JPG" })).toBeInTheDocument();
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(breadcrumb).getByText("DSC_4910.JPG")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Memory Lane" })).toHaveAttribute(
      "href",
      "/library?filter=photos",
    );
  });

  it("shows a drive-disconnected state in the viewer shell", async () => {
    const client: LibraryClient = {
      ...createLibraryFixtureClient(),
      getItem: () =>
        Promise.reject(new AppError(APP_ERROR_CODES.DRIVE_NOT_FOUND, "The drive is disconnected")),
    };
    const drive = readyDrive();
    renderWithProviders(
      <Routes>
        <Route path="/library/item/:fileId" element={<ViewerShell />} />
      </Routes>,
      {
        client: createMockPhaseOneClient({ scenario: "catalog" }),
        libraryClient: client,
        workspace: { drive, catalog: mockCatalogSummary(drive) },
        initialEntries: ["/library/item/1?filter=photos"],
      },
    );

    expect(await screen.findByText("Drive unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
