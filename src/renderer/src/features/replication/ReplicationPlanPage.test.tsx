// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockPhaseOneClient } from "../../lib/ipc-client.mock";
import { createReplicationFixtureClient, replicationPlan } from "../../test/replication-fixtures";
import { renderWithProviders } from "../../test/render";
import { ReplicationPlanPage } from "./ReplicationPlanPage";

afterEach(() => {
  cleanup();
});

function renderPlan(client = createReplicationFixtureClient()): void {
  renderWithProviders(<ReplicationPlanPage />, {
    client: createMockPhaseOneClient(),
    replicationClient: client,
    initialEntries: ["/backup/plan"],
  });
}

describe("ReplicationPlanPage", () => {
  it("shows independent full-copy and partial jobs, remainder, and warnings", async () => {
    renderPlan();
    expect(await screen.findByRole("heading", { name: "Backup plan" })).toBeVisible();
    expect(screen.getByText("8TB Archive")).toBeVisible();
    expect(screen.getByText(/fills first/)).toBeVisible();
    expect(screen.getByText("Remainder")).toBeVisible();
    expect(screen.getByText(/4 files have no reliable date/)).toBeVisible();
    expect(screen.getByText(/Plan hash abcdef123456/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Start backup" })).toBeEnabled();
  });

  it("starts a partial backup after confirmation", async () => {
    const client = createReplicationFixtureClient();
    renderPlan(client);
    await userEvent.click(await screen.findByRole("button", { name: "Start backup" }));
    const dialog = await screen.findByRole("dialog", { name: "Start backup" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Start backup" }));
    await waitFor(() =>
      expect(client.startRun).toHaveBeenCalledWith({
        scope: "partial_only",
        planHash: replicationPlan.planHash,
        replaceStale: false,
      }),
    );
  });

  it("shows the add-destination empty state when no jobs exist", async () => {
    const client = createReplicationFixtureClient({
      getPlan: vi.fn(async () => ({
        ...replicationPlan,
        fullCopy: null,
        partial: null,
        warnings: [
          {
            code: "no_destination",
            severity: "blocking" as const,
            message: "Add a backup destination before planning a backup.",
          },
        ],
        canStart: false,
        blockedReason: "Add a backup destination before planning a backup.",
      })),
    });
    renderPlan(client);
    expect(await screen.findByText("No backup plan yet")).toBeVisible();
    expect(screen.getByText(/Add a backup destination before planning/)).toBeVisible();
  });
});
