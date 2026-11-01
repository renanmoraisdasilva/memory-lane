// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockPhaseOneClient } from "../../lib/ipc-client.mock";
import {
  createReplicationFixtureClient,
  idleAdoption,
  pausedAdoption,
  replicationDetail,
} from "../../test/replication-fixtures";
import { renderWithProviders } from "../../test/render";
import { ReplicationDestinationPage } from "./ReplicationDestinationPage";

afterEach(() => {
  cleanup();
});

function renderDestination(
  client = createReplicationFixtureClient(),
): ReturnType<typeof createReplicationFixtureClient> {
  renderWithProviders(
    <Routes>
      <Route path="/backup/destinations/:destinationId" element={<ReplicationDestinationPage />} />
    </Routes>,
    {
      client: createMockPhaseOneClient(),
      replicationClient: client,
      initialEntries: ["/backup/destinations/dest-1"],
    },
  );
  return client;
}

describe("ReplicationDestinationPage", () => {
  it("shows adoption, coverage, attention, and saves the goal", async () => {
    const client = renderDestination();
    expect(await screen.findByRole("heading", { name: "Backup A" })).toBeVisible();
    expect(await screen.findByText("Adoption complete")).toBeVisible();
    expect(screen.getByText("Coverage map")).toBeVisible();
    expect(screen.getAllByText("Only on this drive").length).toBeGreaterThan(0);

    await userEvent.click(screen.getByLabelText("Goal"));
    await userEvent.click(screen.getByRole("option", { name: "Full copy" }));
    await userEvent.click(screen.getByRole("button", { name: "Save goal" }));
    await waitFor(() =>
      expect(client.updateDestination).toHaveBeenCalledWith({
        destinationId: "dest-1",
        goal: "full_copy",
      }),
    );
  });

  it("starts adoption for an idle destination", async () => {
    const client = createReplicationFixtureClient({
      getDestination: vi.fn(async () => ({ ...replicationDetail, adoption: idleAdoption })),
      getAdoptionState: vi.fn(async () => idleAdoption),
    });
    renderDestination(client);
    await userEvent.click(await screen.findByRole("button", { name: "Adopt existing files" }));
    await waitFor(() => expect(client.startAdoption).toHaveBeenCalledWith("dest-1"));
  });

  it("resumes a paused adoption", async () => {
    const client = createReplicationFixtureClient({
      getDestination: vi.fn(async () => ({ ...replicationDetail, adoption: pausedAdoption })),
      getAdoptionState: vi.fn(async () => pausedAdoption),
    });
    renderDestination(client);
    expect(await screen.findByText("Paused")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Resume adoption" }));
    await waitFor(() => expect(client.resumeAdoption).toHaveBeenCalledWith("dest-1"));
  });

  it("disables adoption and warns when the drive is offline", async () => {
    const client = createReplicationFixtureClient({
      getDestination: vi.fn(async () => ({
        ...replicationDetail,
        connection: "offline" as const,
        adoption: idleAdoption,
      })),
      getAdoptionState: vi.fn(async () => idleAdoption),
    });
    renderDestination(client);
    expect(await screen.findByText("This drive is offline")).toBeVisible();
    expect(await screen.findByRole("button", { name: "Adopt existing files" })).toBeDisabled();
  });
});
