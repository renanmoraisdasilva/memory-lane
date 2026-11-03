// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MissingDuplicatesPage } from "@shared/contracts/health";
import { MissingDuplicates } from "./MissingDuplicates";
import { useHealthMissingDuplicates, usePurgeMissingDuplicates } from "./use-health";

vi.mock("./use-health", () => ({
  useHealthMissingDuplicates: vi.fn(),
  usePurgeMissingDuplicates: vi.fn(),
}));

const query = vi.mocked(useHealthMissingDuplicates);
const purge = vi.mocked(usePurgeMissingDuplicates);
const mutate = vi.fn();

const baseItem = {
  fileId: 7,
  name: "gone.jpg",
  path: "C:\\archive\\gone.jpg",
  folder: "C:\\archive",
  sizeBytes: 1024,
  lastSeenAt: "2026-10-31T12:00:00.000Z",
  duplicateFileId: 3,
  duplicateName: "keep.jpg",
  duplicatePath: "C:\\archive\\keep.jpg",
  duplicateFolder: "C:\\archive",
  pendingMovedCandidates: 0,
  hasVerifiedReplicas: true,
  hasDateOverride: false,
};

const readyPage: MissingDuplicatesPage = {
  items: [baseItem],
  total: 1,
  candidateFileIds: [7],
  readyFileIds: [7],
  withPendingMoves: 0,
  pendingMovedCandidates: 0,
  withVerifiedReplicas: 1,
  withDateOverride: 0,
};

const pendingPage: MissingDuplicatesPage = {
  items: [{ ...baseItem, fileId: 9, name: "moved.jpg", pendingMovedCandidates: 3 }],
  total: 1,
  candidateFileIds: [9],
  readyFileIds: [],
  withPendingMoves: 1,
  pendingMovedCandidates: 3,
  withVerifiedReplicas: 1,
  withDateOverride: 0,
};

beforeEach(() => {
  query.mockReturnValue({
    data: readyPage,
    error: null,
  } as unknown as ReturnType<typeof useHealthMissingDuplicates>);
  purge.mockReturnValue({
    mutate,
    isPending: false,
    error: null,
  } as unknown as ReturnType<typeof usePurgeMissingDuplicates>);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("MissingDuplicates", () => {
  it("[ML-HEALTH-013] reviews and removes ready missing duplicate catalog entries", async () => {
    render(<MissingDuplicates />);

    expect(screen.getByRole("heading", { name: "Missing duplicates" })).toBeVisible();
    expect(screen.getByText(/1 missing catalog entry exactly matches a file/)).toBeVisible();
    expect(screen.getByText(/1 has a verified backup copy/)).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Review and clean up" }));
    expect(screen.getByRole("dialog", { name: "Remove missing duplicates" })).toBeVisible();
    expect(screen.getByText("C:\\archive\\gone.jpg")).toBeVisible();
    expect(screen.getByText("C:\\archive\\keep.jpg")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Remove 1 entry" }));
    expect(mutate).toHaveBeenCalledOnce();
    const [params, options] = mutate.mock.calls[0] as [
      { fileIds: number[]; includePendingMoves: boolean },
      {
        onSuccess: (result: {
          removed: number;
          skipped: number;
          dismissedMovedCandidates: number;
        }) => void;
      },
    ];
    expect(params).toEqual({ fileIds: [7], includePendingMoves: false });
    options.onSuccess({ removed: 1, skipped: 0, dismissedMovedCandidates: 0 });

    expect(await screen.findByText(/Removed 1 missing duplicate catalog entry/)).toBeVisible();
  });

  it("[ML-HEALTH-013] requires explicit confirmation before removing entries with move suggestions", async () => {
    query.mockReturnValue({
      data: pendingPage,
      error: null,
    } as unknown as ReturnType<typeof useHealthMissingDuplicates>);
    render(<MissingDuplicates />);

    expect(screen.getByText(/The scan also suggested 3 new paths for 1 of them/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Review and clean up" }));

    expect(screen.getAllByText(/3 move suggestions/).length).toBeGreaterThan(0);
    const confirm = screen.getByRole("button", { name: "Select entries to remove" });
    expect(confirm).toBeDisabled();

    await userEvent.click(
      screen.getByRole("checkbox", { name: /These missing copies were duplicates/ }),
    );
    const remove = screen.getByRole("button", {
      name: "Remove 1 entry and dismiss 3 suggestions",
    });
    expect(remove).toBeEnabled();

    await userEvent.click(remove);
    expect(mutate).toHaveBeenCalledOnce();
    const [params, options] = mutate.mock.calls[0] as [
      { fileIds: number[]; includePendingMoves: boolean },
      {
        onSuccess: (result: {
          removed: number;
          skipped: number;
          dismissedMovedCandidates: number;
        }) => void;
      },
    ];
    expect(params).toEqual({ fileIds: [9], includePendingMoves: true });
    options.onSuccess({ removed: 1, skipped: 0, dismissedMovedCandidates: 3 });

    expect(
      await screen.findByText(
        /Removed 1 missing duplicate catalog entry and dismissed 3 move suggestions/,
      ),
    ).toBeVisible();
  });

  it("hides itself when there are no missing duplicates", () => {
    query.mockReturnValue({
      data: {
        ...readyPage,
        items: [],
        total: 0,
        candidateFileIds: [],
        readyFileIds: [],
      },
      error: null,
    } as unknown as ReturnType<typeof useHealthMissingDuplicates>);
    render(<MissingDuplicates />);
    expect(screen.queryByRole("heading", { name: "Missing duplicates" })).not.toBeInTheDocument();
  });
});
