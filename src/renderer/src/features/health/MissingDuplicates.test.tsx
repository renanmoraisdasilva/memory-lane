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

const page: MissingDuplicatesPage = {
  items: [
    {
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
      hasVerifiedReplicas: true,
      hasDateOverride: false,
    },
  ],
  total: 1,
  candidateFileIds: [7],
  withVerifiedReplicas: 1,
  withDateOverride: 0,
};

beforeEach(() => {
  query.mockReturnValue({
    data: page,
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
  it("reviews and removes missing duplicate catalog entries", async () => {
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
      { fileIds: number[] },
      { onSuccess: (result: { removed: number; skipped: number }) => void },
    ];
    expect(params).toEqual({ fileIds: [7] });
    options.onSuccess({ removed: 1, skipped: 0 });

    expect(await screen.findByText(/Removed 1 missing duplicate catalog entry/)).toBeVisible();
  });

  it("hides itself when there are no missing duplicates", () => {
    query.mockReturnValue({
      data: { ...page, items: [], total: 0, candidateFileIds: [] },
      error: null,
    } as unknown as ReturnType<typeof useHealthMissingDuplicates>);
    render(<MissingDuplicates />);
    expect(screen.queryByRole("heading", { name: "Missing duplicates" })).not.toBeInTheDocument();
  });
});
