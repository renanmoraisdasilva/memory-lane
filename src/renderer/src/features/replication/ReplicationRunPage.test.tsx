// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockPhaseOneClient } from "../../lib/ipc-client.mock";
import {
  createReplicationFixtureClient,
  pausedRun,
  runEvents,
  runningRun,
} from "../../test/replication-fixtures";
import { renderWithProviders } from "../../test/render";
import { ReplicationRunPage } from "./ReplicationRunPage";

afterEach(() => {
  cleanup();
});

function renderRun(
  client = createReplicationFixtureClient(),
): ReturnType<typeof createReplicationFixtureClient> {
  renderWithProviders(<ReplicationRunPage />, {
    client: createMockPhaseOneClient(),
    replicationClient: client,
    initialEntries: ["/backup/run"],
  });
  return client;
}

describe("ReplicationRunPage", () => {
  it("[ML-REPL-055] shows progress, order, events, and pauses a running backup", async () => {
    const client = renderRun(
      createReplicationFixtureClient({
        getRunState: vi.fn(async () => runningRun),
        getRunEvents: vi.fn(async () => runEvents),
      }),
    );
    expect(await screen.findByRole("heading", { name: "Backup run" })).toBeVisible();
    expect(screen.getByText("photos\\a.jpg")).toBeVisible();
    expect(screen.getAllByText("Backup A").length).toBeGreaterThan(0);
    expect(await screen.findByText("started")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Pause" }));
    await waitFor(() => expect(client.pauseRun).toHaveBeenCalledTimes(1));
  });

  it("[ML-REPL-056] resumes a paused backup and refreshes the plan", async () => {
    const client = renderRun(
      createReplicationFixtureClient({
        getRunState: vi.fn(async () => pausedRun),
      }),
    );
    expect(await screen.findByText("Backup is paused.")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Resume backup" }));
    await waitFor(() => expect(client.resumeRun).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole("button", { name: "Refresh plan" }));
    await waitFor(() => expect(client.replan).toHaveBeenCalledTimes(1));
  });

  it("[ML-REPL-097] labels a completed run with failed files", async () => {
    const completedWithErrors = {
      ...runningRun,
      status: "completed" as const,
      failedFiles: 151,
      percent: 99,
      currentFile: null,
      currentDestinationLabel: null,
      speedBytesPerSecond: null,
      etaSeconds: 0,
      capabilities: {
        ...runningRun.capabilities,
        canPause: false,
        canResume: false,
        canStop: false,
        canEditPlan: false,
        lockedReason: null,
      },
    };
    renderRun(
      createReplicationFixtureClient({
        getRunState: vi.fn(async () => completedWithErrors),
      }),
    );

    expect((await screen.findAllByText("Completed with errors")).length).toBeGreaterThan(0);
    expect(screen.getByText("151")).toBeVisible();
  });

  it("shows the empty state before the first run", async () => {
    renderRun();
    expect(await screen.findByText("No backup run yet")).toBeVisible();
  });
});
