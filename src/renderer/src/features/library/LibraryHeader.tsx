import { Film, Grid3X3, Image, Images, LayoutGrid, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Pill } from "../../components/ui/Pill";
import { formatBytes, formatCount, formatDateTime } from "../../lib/format";
import type { LibraryDensity, LibraryFilter, LibrarySummary } from "./types";
import styles from "./LibraryPage.module.css";

const FILTERS: ReadonlyArray<{ id: LibraryFilter; label: string; icon: LucideIcon }> = [
  { id: "all", label: "All", icon: Images },
  { id: "photos", label: "Photos", icon: Image },
  { id: "videos", label: "Videos", icon: Film },
];

const DENSITIES: ReadonlyArray<{
  id: LibraryDensity;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "comfortable", label: "Comfortable", icon: LayoutGrid },
  { id: "dense", label: "Dense", icon: Grid3X3 },
];

function summaryText(summary: LibrarySummary | undefined, loading: boolean): string {
  if (loading) {
    return "Loading library summary…";
  }
  if (summary === undefined) {
    return "Library summary unavailable";
  }
  return `${formatCount(summary.totalItems)} photos and videos · ${formatBytes(summary.indexedBytes)} indexed · Last scan ${formatDateTime(summary.lastScanAt)}`;
}

export function LibraryHeader({
  summary,
  summaryLoading,
  filter,
  density,
  onFilterChange,
  onDensityChange,
}: {
  summary: LibrarySummary | undefined;
  summaryLoading: boolean;
  filter: LibraryFilter;
  density: LibraryDensity;
  onFilterChange: (filter: LibraryFilter) => void;
  onDensityChange: (density: LibraryDensity) => void;
}): React.JSX.Element {
  return (
    <header className={styles.header}>
      <div className={styles.headerCopy}>
        <div className={styles.eyebrow}>All photos and videos</div>
        <div className={styles.titleRow}>
          <h1>Memory Lane</h1>
          <Pill tone="green" icon={<ShieldCheck size={11} aria-hidden="true" />}>
            Read-only
          </Pill>
        </div>
        <p className={styles.summary}>{summaryText(summary, summaryLoading)}</p>
      </div>

      <div className={styles.headerControls}>
        <div className={styles.controlGroup} role="group" aria-label="Media filter">
          {FILTERS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`${styles.controlButton}${filter === item.id ? ` ${styles.controlButtonActive}` : ""}`}
                type="button"
                aria-pressed={filter === item.id}
                onClick={() => onFilterChange(item.id)}
              >
                <Icon size={14} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className={styles.controlGroup} role="group" aria-label="Grid density">
          {DENSITIES.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`${styles.controlButton}${density === item.id ? ` ${styles.controlButtonActive}` : ""}`}
                type="button"
                aria-pressed={density === item.id}
                onClick={() => onDensityChange(item.id)}
              >
                <Icon size={14} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
