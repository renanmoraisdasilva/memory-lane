// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createMockPhaseOneClient } from "../../lib/ipc-client.mock";
import { createMockDrives, mockCatalogSummary, mockVolumeIds } from "../../lib/mock-fixtures";
import { createLibraryFixtureClient } from "../../test/library-fixtures";
import { renderWithProviders } from "../../test/render";
import { Sidebar } from "./Sidebar";

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

describe("Sidebar", () => {
  it("keeps the active library filter in the Memory Lane link", async () => {
    const drive = readyDrive();
    renderWithProviders(<Sidebar drive={drive} onOpenDrawer={() => undefined} />, {
      client: createMockPhaseOneClient({ scenario: "catalog" }),
      libraryClient: createLibraryFixtureClient(),
      workspace: { drive, catalog: mockCatalogSummary(drive) },
      initialEntries: ["/library/item/2?filter=videos&density=dense"],
    });

    const link = await screen.findByRole("link", { name: "Memory Lane" });
    expect(link).toHaveAttribute("href", "/library?filter=videos&density=dense");
  });
});
