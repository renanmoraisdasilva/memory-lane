// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";
import { createMockPhaseOneClient } from "./lib/ipc-client.mock";
import { createMockDrives, mockVolumeIds } from "./lib/mock-fixtures";
import { createScanFixture } from "./lib/mock-scan-controller";
import { createTestQueryClient } from "./test/render";

function renderApp(client = createMockPhaseOneClient({ scenario: "catalog" })): void {
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={["/"]}>
        <App client={client} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function openReadyDrive(): Promise<void> {
  const button = await screen.findByRole("button", {
    name: /Open Memory Lane on WD My Passport 2TB/,
  });
  await userEvent.click(button);
  expect(await screen.findByRole("heading", { name: "Scan & processing" })).toBeInTheDocument();
}

afterEach(() => {
  cleanup();
});

describe("App shell", () => {
  it("navigates from the gate to the scan shell with breadcrumb and read-only status", async () => {
    renderApp();
    await openReadyDrive();

    expect(screen.getByText("Library", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("Read-only", { exact: true })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Scan & processing" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Memory Lane" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
  });

  it("shows a live background scan chip", async () => {
    const drive = createMockDrives("catalog").find(
      (candidate) => candidate.volumeId === mockVolumeIds.ready,
    );
    if (drive === undefined) {
      throw new Error("The ready mock drive is missing");
    }
    renderApp(
      createMockPhaseOneClient({
        scenario: "catalog",
        scanStates: {
          [drive.volumeId]: createScanFixture("active", drive.label, drive.volumeId),
        },
      }),
    );
    await openReadyDrive();

    expect(await screen.findByRole("link", { name: /Cataloging/ })).toBeInTheDocument();
  });

  it("opens the drive drawer, closes it, and switches drives", async () => {
    renderApp();
    await openReadyDrive();

    await userEvent.click(
      screen.getByRole("button", { name: "Open drive details for WD My Passport 2TB" }),
    );

    const drawer = screen.getByRole("dialog", { name: "WD My Passport 2TB" });
    expect(within(drawer).getByText(mockVolumeIds.ready)).toBeInTheDocument();
    expect(within(drawer).getByText("Read-only archive")).toBeInTheDocument();
    expect(within(drawer).getByText("Foundation status")).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Reveal in Explorer" })).toBeDisabled();

    await userEvent.click(within(drawer).getByRole("button", { name: "Close dialog" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Open drive details for WD My Passport 2TB" }),
    );
    const reopened = screen.getByRole("dialog", { name: "WD My Passport 2TB" });
    await userEvent.click(within(reopened).getByRole("button", { name: "Switch drive" }));

    expect(
      await screen.findByRole("heading", { name: "Open a memory archive" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("starts the first scan from the setup dialog and lands on the scan page", async () => {
    renderApp(createMockPhaseOneClient({ scenario: "mixed" }));

    const setup = await screen.findByRole("button", {
      name: /Set up a new catalog on Samsung T7 Shield/,
    });
    await userEvent.click(setup);

    const dialog = screen.getByRole("dialog", { name: "Set up a new archive" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Start first scan" }));

    expect(await screen.findByRole("heading", { name: "Scan & processing" })).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Scanning Samsung T7 Shield 1TB" }),
    ).toBeInTheDocument();
  });
});
