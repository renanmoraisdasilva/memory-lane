import { Image, Images, RefreshCw, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../components/ui/EmptyState";
import { LibraryErrorState } from "./LibraryErrorState";
import type { LibraryFilter, LibrarySummary } from "./types";
import styles from "./LibraryPage.module.css";

export function LibrarySkeleton(): React.JSX.Element {
  return (
    <div className={styles.skeletonWrap} role="status" aria-live="polite">
      <div className={styles.skeletonLine} aria-hidden="true" />
      <div className={styles.skeletonGrid} aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <div className={styles.skeletonTile} key={index} />
        ))}
      </div>
      <p className={styles.muted}>Loading Memory Lane…</p>
    </div>
  );
}

export function NoMediaState(): React.JSX.Element {
  return (
    <EmptyState
      icon={<Images size={26} aria-hidden="true" />}
      title="No photos or videos yet"
      action={
        <Link className={styles.secondaryButton} to="/scan">
          <RefreshCw size={14} aria-hidden="true" />
          Open Scan &amp; processing
        </Link>
      }
    >
      This catalog has no media to browse. Run a scan, then return to Memory Lane.
    </EmptyState>
  );
}

export function FilterEmptyState({
  filter,
  onClear,
}: {
  filter: LibraryFilter;
  onClear: () => void;
}): React.JSX.Element {
  return (
    <EmptyState
      icon={<Image size={26} aria-hidden="true" />}
      title={filter === "videos" ? "No videos in this catalog" : "No photos in this catalog"}
      action={
        <button className={styles.secondaryButton} type="button" onClick={onClear}>
          Show all media
        </button>
      }
    >
      Try another filter. The catalog is unchanged and every original file stays where it is.
    </EmptyState>
  );
}

export function PeriodEmptyState({ onClear }: { onClear: () => void }): React.JSX.Element {
  return (
    <EmptyState
      icon={<Images size={26} aria-hidden="true" />}
      title="No items in this period"
      action={
        <button className={styles.secondaryButton} type="button" onClick={onClear}>
          <RotateCcw size={14} aria-hidden="true" />
          Show all years
        </button>
      }
    >
      This month or year has no items for the active filter. Return to the full timeline to keep
      browsing.
    </EmptyState>
  );
}

export function EmptyTimelineState({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  return (
    <EmptyState
      icon={<Images size={26} aria-hidden="true" />}
      title="Nothing to show yet"
      action={
        <button className={styles.secondaryButton} type="button" onClick={onRetry}>
          <RefreshCw size={14} aria-hidden="true" />
          Refresh library
        </button>
      }
    >
      The summary reports media, but this view returned no items. Try refreshing the library.
    </EmptyState>
  );
}

export function LibrarySummaryState({
  summary,
  loading,
  error,
  onRetry,
  onSwitchDrive,
}: {
  summary: LibrarySummary | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  onSwitchDrive: () => void;
}): React.JSX.Element | null {
  if (loading) {
    return <LibrarySkeleton />;
  }
  if (error !== null && error !== undefined) {
    return <LibraryErrorState error={error} onRetry={onRetry} onSwitchDrive={onSwitchDrive} />;
  }
  if (summary !== undefined && summary.totalItems === 0) {
    return <NoMediaState />;
  }
  return null;
}
