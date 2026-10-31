// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OtherFilesPage as OtherFilesData } from "@shared/contracts/other-files";
import { createMockPhaseOneClient } from "../../lib/ipc-client.mock";
import { createMockDrives, mockCatalogSummary, mockVolumeIds } from "../../lib/mock-fixtures";
import { renderWithProviders } from "../../test/render";
import { createLibraryFixtureClient } from "../../test/library-fixtures";
import { OtherFilesPage } from "./OtherFilesPage";

const otherFiles: OtherFilesData = {
  total: 120,
  counts: {
    all: 120,
    documents: 40,
    spreadsheets: 20,
    presentations: 10,
    pdfs: 25,
    audio: 15,
    archives: 8,
    other: 2,
  },
  items: [
    {
      fileId: 1,
      name: "report.docx",
      path: "C:\\archive\\report.docx",
      folder: "C:\\archive",
      extension: "docx",
      format: "DOCX",
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      category: "documents",
      sizeBytes: 1024,
      modifiedAtFs: "2026-10-31T12:00:00.000Z",
      state: "present",
    },
    {
      fileId: 2,
      name: "manual.pdf",
      path: "C:\\archive\\manual.pdf",
      folder: "C:\\archive",
      extension: "pdf",
      format: "PDF",
      mime: "application/pdf",
      category: "pdfs",
      sizeBytes: 2048,
      modifiedAtFs: null,
      state: "present",
    },
    {
      fileId: 3,
      name: "gone.zip",
      path: "C:\\archive\\gone.zip",
      folder: "C:\\archive",
      extension: "zip",
      format: "ZIP",
      mime: "application/zip",
      category: "archives",
      sizeBytes: 4096,
      modifiedAtFs: "2026-10-31T12:00:00.000Z",
      state: "missing",
    },
  ],
};

function renderFiles(): ReturnType<typeof createLibraryFixtureClient> {
  const drive = createMockDrives("catalog").find(
    (candidate) => candidate.volumeId === mockVolumeIds.ready,
  );
  if (drive === undefined) {
    throw new Error("The ready mock drive is missing");
  }
  const client = createLibraryFixtureClient({ otherFiles });
  renderWithProviders(<OtherFilesPage />, {
    client: createMockPhaseOneClient({ scenario: "catalog" }),
    libraryClient: client,
    workspace: { drive, catalog: mockCatalogSummary(drive) },
    initialEntries: ["/files"],
  });
  return client;
}

afterEach(() => {
  cleanup();
});

describe("OtherFilesPage", () => {
  it("lists non-media files with categories and missing state", async () => {
    renderFiles();

    expect(await screen.findByRole("heading", { name: "Other files" })).toBeVisible();
    expect(await screen.findByText("report.docx")).toBeVisible();
    expect(screen.getByText("manual.pdf")).toBeVisible();
    expect(screen.getByText("gone.zip")).toBeVisible();
    expect(screen.getByText("Missing")).toBeVisible();
    expect(screen.getByText("1–50 of 120")).toBeVisible();
  });

  it("filters by category and pages through results", async () => {
    const client = renderFiles();
    const list = vi.spyOn(client, "getOtherFiles");
    await screen.findByText("report.docx");

    await userEvent.click(screen.getByRole("tab", { name: /PDFs/ }));
    await waitFor(() => {
      expect(list).toHaveBeenCalledWith({ category: "pdfs", offset: 0, limit: 50 });
    });

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(list).toHaveBeenCalledWith({ category: "pdfs", offset: 50, limit: 50 });
    });

    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    await waitFor(() => {
      expect(list).toHaveBeenCalledWith({ category: "pdfs", offset: 0, limit: 50 });
    });
  });

  it("opens and reveals present files", async () => {
    const client = renderFiles();
    const open = vi.spyOn(client, "openItem");
    const reveal = vi.spyOn(client, "revealItem");
    await screen.findByText("report.docx");

    await userEvent.click(screen.getByRole("button", { name: "Open report.docx" }));
    await waitFor(() => {
      expect(open).toHaveBeenCalledWith({ fileId: 1 });
    });

    await userEvent.click(screen.getByRole("button", { name: "Reveal report.docx in Explorer" }));
    await waitFor(() => {
      expect(reveal).toHaveBeenCalledWith({ fileId: 1 });
    });
  });
});
