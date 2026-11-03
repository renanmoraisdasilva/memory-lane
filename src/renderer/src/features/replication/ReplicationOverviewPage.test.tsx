// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockPhaseOneClient } from "../../lib/ipc-client.mock";
import {
  createReplicationFixtureClient,
  replicationDestination,
  replicationOverview,
} from "../../test/replication-fixtures";
import { renderWithProviders } from "../../test/render";
import { ReplicationOverviewPage } from "./ReplicationOverviewPage";

afterEach(() => {
  cleanup();
});

function renderOverview(
  client = createReplicationFixtureClient(),
): ReturnType<typeof createReplicationFixtureClient> {
  renderWithProviders(<ReplicationOverviewPage />, {
    client: createMockPhaseOneClient(),
    replicationClient: client,
    initialEntries: ["/backup"],
  });
  return client;
}

describe("ReplicationOverviewPage", () => {
  it("[ML-REPL-034] shows verified coverage, destinations, and opens the add drawer", async () => {
    const client = renderOverview();
    expect(await screen.findByRole("heading", { name: "Backup destinations" })).toBeVisible();
    expect(screen.getByText("Verified coverage")).toBeVisible();
    expect(screen.getByText("Backup A (F:)")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: /Add destination/ }));
    expect(await screen.findByText("Connected drives")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: /Backup A/ }));
    await userEvent.click(screen.getByLabelText("Goal"));
    await userEvent.click(screen.getByRole("option", { name: /Full copy/ }));
    await userEvent.click(screen.getByRole("button", { name: "Add and adopt" }));
    await waitFor(() => expect(client.registerDestination).toHaveBeenCalledTimes(1));
    expect(client.registerDestination).toHaveBeenCalledWith(
      expect.objectContaining({ goal: "full_copy" }),
    );
    await waitFor(() => expect(client.startAdoption).toHaveBeenCalledWith("dest-1"));
  });

  it("shows the add-destination empty state", async () => {
    const client = createReplicationFixtureClient({
      getOverview: vi.fn(async () => ({ ...replicationOverview, destinations: [] })),
    });
    renderOverview(client);
    expect(await screen.findByText("Add a backup destination")).toBeVisible();
    expect(screen.getByText(/Existing Memory Lane copies are adopted/)).toBeVisible();
  });

  it("[ML-REPL-035] [ML-REPL-049] labels an all-offline deployment without implying current coverage", async () => {
    const offline = { ...replicationDestination, connection: "offline" as const };
    const client = createReplicationFixtureClient({
      getOverview: vi.fn(async () => ({
        ...replicationOverview,
        destinations: [offline],
      })),
    });
    renderOverview(client);
    expect(await screen.findByText("Every destination is offline")).toBeVisible();
  });
});
