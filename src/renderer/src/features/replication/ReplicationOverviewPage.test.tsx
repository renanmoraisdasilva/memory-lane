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

  it("[ML-REPL-095] retries the overview after a transient startup failure", async () => {
    const getOverview = vi
      .fn()
      .mockRejectedValueOnce(new Error("Database request timed out: replication.listDestinations"))
      .mockResolvedValue(replicationOverview);
    const client = createReplicationFixtureClient({ getOverview });
    renderOverview(client);

    expect(await screen.findByText("Could not load the backup overview.")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("heading", { name: "Backup destinations" })).toBeVisible();
    expect(getOverview).toHaveBeenCalledTimes(2);
  });

  it("[ML-REPL-099] shows unverified source coverage", async () => {
    const partial = {
      ...replicationDestination,
      verifiedFiles: 198,
      unverifiedFiles: 2,
    };
    renderOverview(
      createReplicationFixtureClient({
        getOverview: vi.fn(async () => ({ ...replicationOverview, destinations: [partial] })),
      }),
    );

    expect(await screen.findByText("198 of 200 source files verified")).toBeVisible();
    expect(screen.getByText("Partial · priority 1")).toBeVisible();
  });

  it("[ML-REPL-099] marks a full verified destination done", async () => {
    const done = {
      ...replicationDestination,
      label: "Archive C",
      letter: "H:",
      connection: "retired" as const,
      totalBytes: 2_000_000_000,
      freeBytes: 131_072_000,
      reserveBytes: 67_108_864,
      availableBytes: 0,
      verifiedFiles: 200,
      unverifiedFiles: 0,
    };
    renderOverview(
      createReplicationFixtureClient({
        getOverview: vi.fn(async () => ({ ...replicationOverview, destinations: [done] })),
      }),
    );

    expect(await screen.findByText("Partial · done")).toBeVisible();
    expect(screen.getByText("Full")).toBeVisible();
    expect(screen.getByText("No safe space")).toBeVisible();
    expect(screen.getByText("64.0 MB reserve")).toBeVisible();
    expect(screen.getByText("Retired")).toBeVisible();
  });

  it("[ML-REPL-099] keeps a full unverified destination yellow", async () => {
    const fullUnverified = {
      ...replicationDestination,
      label: "Archive D",
      letter: "I:",
      connection: "offline" as const,
      totalBytes: 2_000_000_000,
      freeBytes: 131_072_000,
      reserveBytes: 67_108_864,
      availableBytes: 0,
      verifiedFiles: 198,
      unverifiedFiles: 2,
    };
    renderOverview(
      createReplicationFixtureClient({
        getOverview: vi.fn(async () => ({
          ...replicationOverview,
          destinations: [fullUnverified],
        })),
      }),
    );

    expect(await screen.findByText("Partial · needs verification")).toBeVisible();
    expect(screen.getByText("Full")).toBeVisible();
    expect(screen.getByText("Offline")).toBeVisible();
    expect(screen.getByText("198 of 200 source files verified")).toBeVisible();
    expect(screen.getByText("No safe space")).toBeVisible();
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
