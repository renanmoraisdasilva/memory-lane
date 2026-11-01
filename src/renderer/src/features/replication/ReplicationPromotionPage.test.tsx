// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { createMockPhaseOneClient } from "../../lib/ipc-client.mock";
import { createReplicationFixtureClient, promotionState } from "../../test/replication-fixtures";
import { renderWithProviders } from "../../test/render";
import { ReplicationPromotionPage } from "./ReplicationPromotionPage";

afterEach(() => {
  cleanup();
});

function renderPromotion(client = createReplicationFixtureClient()): void {
  renderWithProviders(
    <Routes>
      <Route path="/backup/promote/:destinationId" element={<ReplicationPromotionPage />} />
    </Routes>,
    {
      client: createMockPhaseOneClient(),
      replicationClient: client,
      initialEntries: ["/backup/promote/dest-1"],
    },
  );
}

describe("ReplicationPromotionPage", () => {
  it("verifies, chooses fates, and promotes a complete full copy", async () => {
    const verified = {
      ...promotionState,
      promotionId: 7,
      status: "verified" as const,
      verified: true,
    };
    const completed = {
      ...verified,
      status: "completed" as const,
      canPromote: false,
      canRollback: true,
      rollbackBlockedReason: null,
      completedAt: "2026-11-01T12:10:00.000Z",
      newCatalog: {
        catalogPath: "F:\\.memorylane\\catalog.db",
        driveLabel: "Backup A",
        volumeId: toVolumeId("volume-destination"),
        schemaVersion: 7,
        fileCount: 250,
        openedAt: "2026-11-01T12:10:00.000Z",
      },
    };
    const client = createReplicationFixtureClient({
      getPromotion: vi.fn(async () => verified),
      verifyPromotion: vi.fn(async () => verified),
      applyPromotion: vi.fn(async () => completed),
    });
    renderPromotion(client);
    expect(await screen.findByRole("heading", { name: "Promote Backup A" })).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Run verification" }));
    await waitFor(() =>
      expect(client.verifyPromotion).toHaveBeenCalledWith({ destinationId: "dest-1", deep: false }),
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Next" })).toBeEnabled());

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Left out of the new source archive")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "I understand that this changes the active source archive.",
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Promote to source" }));
    await waitFor(() =>
      expect(client.applyPromotion).toHaveBeenCalledWith({
        destinationId: "dest-1",
        deepVerify: false,
        oldSourceFate: "full_copy",
        partialFates: [{ destinationId: "dest-2", keep: true }],
        confirm: true,
      }),
    );
    expect(await screen.findByRole("heading", { name: "Promotion complete" })).toBeVisible();
  });

  it("rolls back a completed promotion before the first change", async () => {
    const completed = {
      ...promotionState,
      promotionId: 7,
      status: "completed" as const,
      verified: true,
      canPromote: false,
      canRollback: true,
      rollbackBlockedReason: null,
      newCatalog: {
        catalogPath: "F:\\.memorylane\\catalog.db",
        driveLabel: "Backup A",
        volumeId: toVolumeId("volume-destination"),
        schemaVersion: 7,
        fileCount: 250,
        openedAt: "2026-11-01T12:10:00.000Z",
      },
    };
    const rolled = {
      ...completed,
      status: "rolled_back" as const,
      canRollback: false,
      rolledBackAt: "2026-11-01T12:11:00.000Z",
      previousSourceVolumeId: toVolumeId("volume-source"),
    };
    const client = createReplicationFixtureClient({
      getPromotion: vi.fn(async () => completed),
      rollbackPromotion: vi.fn(async () => rolled),
    });
    renderPromotion(client);
    expect(await screen.findByRole("heading", { name: "Promotion complete" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Roll back promotion" }));
    await waitFor(() =>
      expect(client.rollbackPromotion).toHaveBeenCalledWith({
        promotionId: 7,
        destinationId: "dest-1",
      }),
    );
    expect(await screen.findByRole("heading", { name: "Promotion rolled back" })).toBeVisible();
  });
});
