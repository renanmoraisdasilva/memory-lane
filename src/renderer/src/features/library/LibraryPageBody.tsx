import type { RefObject } from "react";
import type { VisibleRange, VirtualGridHandle } from "../../components/ui/VirtualGrid";
import { LibraryErrorState } from "./LibraryErrorState";
import { LibraryTimeline } from "./LibraryTimeline";
import {
  EmptyTimelineState,
  FilterEmptyState,
  LibrarySkeleton,
  PeriodEmptyState,
} from "./LibraryStates";
import type { TimelineRow } from "./timeline-model";
import type { LibraryDensity, LibraryFilter, PeriodAnchor } from "./types";

export function LibraryPageBody({
  timelineLoading,
  timelineError,
  filterEmpty,
  itemsCount,
  rows,
  columns,
  filter,
  density,
  anchor,
  gridRef,
  hasNextPage,
  isFetchingNextPage,
  onScroll,
  onRetry,
  onRetryAll,
  onSwitchDrive,
  onClearFilter,
  onClearAnchor,
  onLoadMore,
  onVisibleRangeChange,
}: {
  timelineLoading: boolean;
  timelineError: unknown;
  filterEmpty: boolean;
  itemsCount: number;
  rows: TimelineRow[];
  columns: number;
  filter: LibraryFilter;
  density: LibraryDensity;
  anchor: PeriodAnchor;
  gridRef: RefObject<VirtualGridHandle | null>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onScroll: (offset: number) => void;
  onRetry: () => void;
  onRetryAll: () => void;
  onSwitchDrive: () => void;
  onClearFilter: () => void;
  onClearAnchor: () => void;
  onLoadMore: () => void;
  onVisibleRangeChange: (range: VisibleRange) => void;
}): React.JSX.Element {
  if (timelineLoading) {
    return <LibrarySkeleton />;
  }
  if (timelineError !== null && timelineError !== undefined) {
    return (
      <LibraryErrorState error={timelineError} onRetry={onRetry} onSwitchDrive={onSwitchDrive} />
    );
  }
  if (filterEmpty) {
    return <FilterEmptyState filter={filter} onClear={onClearFilter} />;
  }
  if (itemsCount === 0 && anchor !== null) {
    return <PeriodEmptyState onClear={onClearAnchor} />;
  }
  if (rows.length === 0) {
    return <EmptyTimelineState onRetry={onRetryAll} />;
  }
  return (
    <LibraryTimeline
      rows={rows}
      columns={columns}
      density={density}
      filter={filter}
      gridRef={gridRef}
      onScroll={onScroll}
      onVisibleRangeChange={onVisibleRangeChange}
      onEndReached={onLoadMore}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
    />
  );
}
