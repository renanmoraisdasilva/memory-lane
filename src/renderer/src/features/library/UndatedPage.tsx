import { CalendarClock, ImageOff, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Alert } from "../../components/ui/Callout";
import { EmptyState } from "../../components/ui/EmptyState";
import { formatBytes, formatCount } from "../../lib/format";
import { DateAssignmentFields } from "./DateAssignmentFields";
import { viewerPath } from "./library-url";
import { useLibraryUndated, useSetLibraryDate } from "./use-library";
import type { LibraryUndatedItem } from "./types";
import styles from "./UndatedPage.module.css";

function UndatedThumbnail({ item }: { item: LibraryUndatedItem }): React.JSX.Element {
  if (item.thumbnailUrl === null) {
    return (
      <span className={styles.thumbnailFallback} aria-hidden="true">
        <ImageOff size={19} />
      </span>
    );
  }
  return <img className={styles.thumbnail} src={item.thumbnailUrl} alt="" loading="lazy" />;
}

function UndatedRow({
  item,
  selected,
  onToggle,
}: {
  item: LibraryUndatedItem;
  selected: boolean;
  onToggle: (fileId: number) => void;
}): React.JSX.Element {
  return (
    <div className={`${styles.row}${selected ? ` ${styles.rowSelected}` : ""}`}>
      <input
        className={styles.checkbox}
        type="checkbox"
        checked={selected}
        aria-label={`Select ${item.name}`}
        onChange={() => onToggle(item.fileId)}
      />
      <UndatedThumbnail item={item} />
      <span className={styles.rowCopy}>
        <span className={styles.rowName}>{item.name}</span>
        <span className={styles.rowMeta}>
          {formatBytes(item.sizeBytes)} · {item.folder}
        </span>
      </span>
      <Link
        className={styles.openLink}
        to={viewerPath(item.fileId, "all", "comfortable")}
        aria-label={`Open ${item.name}`}
      >
        Open
      </Link>
    </div>
  );
}

function SelectionToolbar({
  visibleCount,
  selectedCount,
  onSelectAll,
  onClear,
}: {
  visibleCount: number;
  selectedCount: number;
  onSelectAll: () => void;
  onClear: () => void;
}): React.JSX.Element {
  return (
    <div className={styles.selectionBar}>
      <span>
        {formatCount(visibleCount)} visible · {formatCount(selectedCount)} selected
      </span>
      <span className={styles.selectionActions}>
        <button className={styles.textButton} type="button" onClick={onSelectAll}>
          Select all visible
        </button>
        <button
          className={styles.textButton}
          type="button"
          disabled={selectedCount === 0}
          onClick={onClear}
        >
          Clear selection
        </button>
      </span>
    </div>
  );
}

function AssignmentPanel({
  selectedCount,
  year,
  month,
  pending,
  error,
  onYearChange,
  onMonthChange,
  onApply,
}: {
  selectedCount: number;
  year: number | null;
  month: number | null;
  pending: boolean;
  error: unknown;
  onYearChange: (value: number | null) => void;
  onMonthChange: (value: number | null) => void;
  onApply: () => void;
}): React.JSX.Element {
  return (
    <aside className={styles.assignment} aria-label="Assign catalog date">
      <div className={styles.assignmentHead}>
        <CalendarClock size={17} aria-hidden="true" />
        <div>
          <h2>Assign a date</h2>
          <p>{formatCount(selectedCount)} selected</p>
        </div>
      </div>
      <DateAssignmentFields
        year={year}
        month={month}
        disabled={pending}
        onYearChange={onYearChange}
        onMonthChange={onMonthChange}
      />
      {error === null || error === undefined ? null : (
        <Alert>{error instanceof Error ? error.message : "The date could not be applied."}</Alert>
      )}
      <button
        className={styles.primaryButton}
        type="button"
        disabled={selectedCount === 0 || year === null || pending}
        onClick={onApply}
      >
        {pending ? <Loader2 className={styles.spinner} size={14} /> : null}
        {pending ? "Applying…" : "Apply to catalog"}
      </button>
    </aside>
  );
}

interface UndatedResultsProps {
  items: LibraryUndatedItem[];
  loading: boolean;
  error: unknown;
  hasNextPage: boolean;
  fetchingNextPage: boolean;
  selected: Set<number>;
  year: number | null;
  month: number | null;
  pending: boolean;
  mutationError: unknown;
  onRetry: () => void;
  onLoadMore: () => void;
  onToggle: (fileId: number) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onYearChange: (value: number | null) => void;
  onMonthChange: (value: number | null) => void;
  onApply: () => void;
  onResetFilters: () => void;
}

function UndatedResults({
  items,
  loading,
  error,
  hasNextPage,
  fetchingNextPage,
  selected,
  year,
  month,
  pending,
  mutationError,
  onRetry,
  onLoadMore,
  onToggle,
  onSelectAll,
  onClearSelection,
  onYearChange,
  onMonthChange,
  onApply,
  onResetFilters,
}: UndatedResultsProps): React.JSX.Element {
  if (loading) {
    return (
      <div className={styles.loading} role="status">
        <Loader2 className={styles.spinner} size={18} />
        Loading undated items…
      </div>
    );
  }
  if (error !== null && error !== undefined) {
    return (
      <div className={styles.loading}>
        <Alert>{error instanceof Error ? error.message : "Could not load undated items."}</Alert>
        <button className={styles.secondaryButton} type="button" onClick={onRetry}>
          <RefreshCw size={14} aria-hidden="true" />
          Retry
        </button>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<CalendarClock size={26} aria-hidden="true" />}
        title="No items need a date"
        action={
          <Link className={styles.secondaryButton} to="/library" onClick={onResetFilters}>
            Back to Memory Lane
          </Link>
        }
      >
        Every media item in this catalog has a resolved date, or the catalog has no media yet.
      </EmptyState>
    );
  }
  return (
    <div className={styles.body}>
      <section className={styles.listArea} aria-label="Undated media">
        <SelectionToolbar
          visibleCount={items.length}
          selectedCount={selected.size}
          onSelectAll={onSelectAll}
          onClear={onClearSelection}
        />
        <div className={styles.list}>
          {items.map((item) => (
            <UndatedRow
              key={item.fileId}
              item={item}
              selected={selected.has(item.fileId)}
              onToggle={onToggle}
            />
          ))}
        </div>
        {hasNextPage ? (
          <button
            className={styles.secondaryButton}
            type="button"
            disabled={fetchingNextPage}
            onClick={onLoadMore}
          >
            {fetchingNextPage ? "Loading…" : "Load more"}
          </button>
        ) : null}
      </section>
      <AssignmentPanel
        selectedCount={selected.size}
        year={year}
        month={month}
        pending={pending}
        error={mutationError}
        onYearChange={onYearChange}
        onMonthChange={onMonthChange}
        onApply={onApply}
      />
    </div>
  );
}

export function UndatedPage(): React.JSX.Element {
  const query = useLibraryUndated();
  const mutation = useSetLibraryDate();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;

  function toggle(fileId: number): void {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }

  function apply(): void {
    if (year === null || selected.size === 0) {
      return;
    }
    mutation.mutate(
      { fileIds: [...selected], year, month },
      {
        onSuccess: () => {
          setSelected(new Set());
          setYear(null);
          setMonth(null);
        },
      },
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Date unavailable</div>
          <h1>Items without a resolved date</h1>
          <p className={styles.summary}>
            {query.isLoading
              ? "Loading undated items…"
              : `${formatCount(total)} items need a date. Assigning a date changes the catalog only; originals stay untouched.`}
          </p>
        </div>
        <button
          className={styles.secondaryButton}
          type="button"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          <RefreshCw size={14} aria-hidden="true" />
          Refresh
        </button>
      </header>
      <UndatedResults
        items={items}
        loading={query.isLoading}
        error={query.error}
        hasNextPage={query.hasNextPage}
        fetchingNextPage={query.isFetchingNextPage}
        selected={selected}
        year={year}
        month={month}
        pending={mutation.isPending}
        mutationError={mutation.error}
        onRetry={() => void query.refetch()}
        onLoadMore={() => void query.fetchNextPage()}
        onToggle={toggle}
        onSelectAll={() => setSelected(new Set(items.map((item) => item.fileId)))}
        onClearSelection={() => setSelected(new Set())}
        onYearChange={setYear}
        onMonthChange={setMonth}
        onApply={apply}
        onResetFilters={() => {
          setSelected(new Set());
          setYear(null);
          setMonth(null);
        }}
      />
    </div>
  );
}
