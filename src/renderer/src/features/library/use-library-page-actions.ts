import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { NavigateFunction } from "react-router-dom";
import type { VisibleRange, VirtualGridHandle } from "../../components/ui/VirtualGrid";
import type { LibraryDensity, LibraryFilter, LibraryMonth, PeriodAnchor } from "./types";
import { adjacentMonthAnchor, findRowIndexForItem, type TimelineRow } from "./timeline-model";

interface PageActionsOptions {
  anchor: PeriodAnchor;
  setAnchor: (anchor: PeriodAnchor) => void;
  updateSearchParams: (key: string, value: string | null) => void;
  rows: TimelineRow[];
  gridRef: RefObject<VirtualGridHandle | null>;
  visibleAnchorRef: RefObject<number | null>;
  months: LibraryMonth[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  refetchSummary: () => Promise<unknown>;
  refetchMonths: () => Promise<unknown>;
  refetchTimeline: () => Promise<unknown>;
  closeWorkspace: () => void;
  navigate: NavigateFunction;
}

export function useLibraryPageActions(options: PageActionsOptions) {
  const {
    anchor,
    setAnchor,
    updateSearchParams,
    rows,
    gridRef,
    visibleAnchorRef,
    months,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetchSummary,
    refetchMonths,
    refetchTimeline,
    closeWorkspace,
    navigate,
  } = options;
  const pendingAnchorRef = useRef<number | null>(null);

  useEffect(() => {
    const pending = pendingAnchorRef.current;
    if (pending === null) {
      return;
    }
    const index = findRowIndexForItem(rows, pending);
    if (index >= 0) {
      gridRef.current?.scrollToIndex(index);
      pendingAnchorRef.current = null;
    }
  }, [gridRef, rows]);

  function changeFilter(nextFilter: LibraryFilter): void {
    pendingAnchorRef.current = null;
    setAnchor(null);
    updateSearchParams("filter", nextFilter === "all" ? null : nextFilter);
  }

  function changeDensity(nextDensity: LibraryDensity): void {
    if (visibleAnchorRef.current !== null) {
      pendingAnchorRef.current = visibleAnchorRef.current;
    }
    updateSearchParams("density", nextDensity === "comfortable" ? null : nextDensity);
  }

  const handleVisibleRange = useCallback(
    (range: VisibleRange): void => {
      const row = rows.slice(range.startIndex).find((candidate) => candidate.kind === "items");
      visibleAnchorRef.current = row?.kind === "items" ? (row.itemIds[0] ?? null) : null;
    },
    [rows, visibleAnchorRef],
  );

  const loadMore = useCallback((): void => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  function retryAll(): void {
    void refetchSummary();
    void refetchMonths();
    void refetchTimeline();
  }

  function switchDrive(): void {
    closeWorkspace();
    void navigate("/");
  }

  function resetAnchor(): void {
    setAnchor(null);
  }

  function changeYear(year: number): void {
    setAnchor({ kind: "year", year });
  }

  function stepMonth(direction: -1 | 1): void {
    setAnchor(adjacentMonthAnchor(months, anchor, direction));
  }

  return {
    changeFilter,
    changeDensity,
    handleVisibleRange,
    loadMore,
    retryAll,
    switchDrive,
    resetAnchor,
    changeYear,
    stepMonth,
  };
}
