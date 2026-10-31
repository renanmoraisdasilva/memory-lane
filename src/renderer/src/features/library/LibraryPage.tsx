import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useWorkspace } from "../../app/workspace";
import { useContainerWidth } from "../../lib/use-container-width";
import { LibraryHeader } from "./LibraryHeader";
import { LibraryPageBody } from "./LibraryPageBody";
import { LibrarySummaryState } from "./LibraryStates";
import { useLibraryPageActions } from "./use-library-page-actions";
import { TimelineToolbar } from "./TimelineToolbar";
import {
  anchorKey,
  anchorTimelineParams,
  buildTimelineRows,
  columnsForWidth,
  groupTimelineItems,
} from "./timeline-model";
import { useLibrarySummary, useLibraryTimeline, useLibraryTimelineIndex } from "./use-library";
import { parseLibraryDensity, parseLibraryFilter } from "./library-url";
import type { LibraryFilter, LibrarySummary, PeriodAnchor } from "./types";
import type { VirtualGridHandle } from "../../components/ui/VirtualGrid";
import styles from "./LibraryPage.module.css";

function filterIsEmpty(summary: LibrarySummary | undefined, filter: LibraryFilter): boolean {
  if (summary === undefined) {
    return false;
  }
  if (filter === "photos") {
    return summary.photoCount === 0;
  }
  if (filter === "videos") {
    return summary.videoCount === 0;
  }
  return false;
}

function useSearchParamUpdate(
  searchParams: URLSearchParams,
  setSearchParams: ReturnType<typeof useSearchParams>[1],
): (key: string, value: string | null) => void {
  return useCallback(
    (key: string, value: string | null): void => {
      const next = new URLSearchParams(searchParams);
      if (value === null) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );
}

export function LibraryPage(): React.JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = parseLibraryFilter(searchParams.get("filter"));
  const density = parseLibraryDensity(searchParams.get("density"));
  const [anchor, setAnchor] = useState<PeriodAnchor>(null);
  const { closeWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const { ref: widthRef, width } = useContainerWidth();
  const gridRef = useRef<VirtualGridHandle>(null);
  const visibleAnchorRef = useRef<number | null>(null);

  const summary = useLibrarySummary();
  const monthsQuery = useLibraryTimelineIndex(filter);
  const months = monthsQuery.data?.months ?? [];
  const period = anchorTimelineParams(anchor);
  const timeline = useLibraryTimeline({ filter, year: period.year, month: period.month });

  const items = useMemo(
    () => timeline.data?.pages.flatMap((page) => page.items) ?? [],
    [timeline.data],
  );
  const sections = useMemo(() => groupTimelineItems(items), [items]);
  const columns = columnsForWidth(width, density);
  const rows = useMemo(
    () => buildTimelineRows(sections, columns, density),
    [sections, columns, density],
  );
  const updateSearchParams = useSearchParamUpdate(searchParams, setSearchParams);

  const actions = useLibraryPageActions({
    anchor,
    setAnchor,
    updateSearchParams,
    rows,
    gridRef,
    visibleAnchorRef,
    months,
    hasNextPage: timeline.hasNextPage,
    isFetchingNextPage: timeline.isFetchingNextPage,
    fetchNextPage: () => timeline.fetchNextPage(),
    refetchSummary: () => summary.refetch(),
    refetchMonths: () => monthsQuery.refetch(),
    refetchTimeline: () => timeline.refetch(),
    closeWorkspace,
    navigate,
  });

  const filterEmpty = filterIsEmpty(summary.data, filter);

  return (
    <div className={styles.page} ref={widthRef}>
      <LibraryHeader
        summary={summary.data}
        summaryLoading={summary.isLoading}
        filter={filter}
        density={density}
        onFilterChange={actions.changeFilter}
        onDensityChange={actions.changeDensity}
      />

      <LibrarySummaryState
        summary={summary.data}
        loading={summary.isLoading}
        error={summary.error}
        onRetry={actions.retryAll}
        onSwitchDrive={actions.switchDrive}
      />

      {summary.data !== undefined && summary.data.totalItems > 0 ? (
        <>
          <TimelineToolbar
            months={months}
            loading={monthsQuery.isLoading}
            error={monthsQuery.isError}
            anchor={anchor}
            onYearChange={actions.changeYear}
            onAllYears={actions.resetAnchor}
            onMonthStep={actions.stepMonth}
          />
          <LibraryPageBody
            key={`${filter}:${anchorKey(anchor)}`}
            timelineLoading={timeline.isLoading}
            timelineError={timeline.error}
            filterEmpty={filterEmpty}
            itemsCount={items.length}
            rows={rows}
            columns={columns}
            filter={filter}
            density={density}
            anchor={anchor}
            gridRef={gridRef}
            hasNextPage={timeline.hasNextPage}
            isFetchingNextPage={timeline.isFetchingNextPage}
            onRetry={() => void timeline.refetch()}
            onRetryAll={actions.retryAll}
            onSwitchDrive={actions.switchDrive}
            onClearFilter={() => actions.changeFilter("all")}
            onClearAnchor={actions.resetAnchor}
            onLoadMore={actions.loadMore}
            onVisibleRangeChange={actions.handleVisibleRange}
          />
        </>
      ) : null}
    </div>
  );
}
