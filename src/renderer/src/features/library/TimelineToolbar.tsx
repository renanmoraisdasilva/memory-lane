import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import type { LibraryMonth, PeriodAnchor } from "./types";
import { collectYears, currentMonthIndex, monthLabel } from "./timeline-model";
import styles from "./LibraryPage.module.css";

function activePeriodLabel(months: LibraryMonth[], anchor: PeriodAnchor): string {
  if (anchor === null) {
    const first = months[0];
    return first === undefined ? "No months" : monthLabel(first.year, first.month);
  }
  if (anchor.kind === "year") {
    return String(anchor.year);
  }
  return monthLabel(anchor.year, anchor.month);
}

export function TimelineToolbar({
  months,
  loading,
  error,
  anchor,
  onYearChange,
  onAllYears,
  onMonthStep,
}: {
  months: LibraryMonth[];
  loading: boolean;
  error: boolean;
  anchor: PeriodAnchor;
  onYearChange: (year: number) => void;
  onAllYears: () => void;
  onMonthStep: (direction: -1 | 1) => void;
}): React.JSX.Element {
  const years = collectYears(months);
  const currentIndex = currentMonthIndex(months, anchor);
  const canGoNewer = currentIndex > 0;
  const canGoOlder = currentIndex >= 0 && currentIndex < months.length - 1;
  const activeYear = anchor?.year ?? null;

  return (
    <div className={styles.toolbar}>
      <span className={styles.toolbarLabel}>Year</span>
      <div className={styles.yearRail} role="group" aria-label="Jump to year">
        <button
          className={`${styles.yearChip}${anchor === null ? ` ${styles.yearChipActive}` : ""}`}
          type="button"
          aria-pressed={anchor === null}
          onClick={onAllYears}
        >
          All years
        </button>
        {years.map((year) => (
          <button
            key={year}
            className={`${styles.yearChip}${activeYear === year ? ` ${styles.yearChipActive}` : ""}`}
            type="button"
            aria-pressed={activeYear === year}
            onClick={() => onYearChange(year)}
          >
            {year}
          </button>
        ))}
      </div>

      <div className={styles.monthNav}>
        <button
          className={styles.iconButton}
          type="button"
          aria-label="Previous month"
          disabled={!canGoNewer}
          onClick={() => onMonthStep(-1)}
        >
          <ChevronLeft size={15} aria-hidden="true" />
        </button>
        <span className={styles.monthPill}>
          <CalendarDays size={13} aria-hidden="true" />
          {activePeriodLabel(months, anchor)}
        </span>
        <button
          className={styles.iconButton}
          type="button"
          aria-label="Next month"
          disabled={!canGoOlder}
          onClick={() => onMonthStep(1)}
        >
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>

      {loading ? <span className={styles.toolbarNote}>Loading year index…</span> : null}
      {!loading && error ? (
        <span className={styles.toolbarNote}>Year navigation is unavailable.</span>
      ) : null}
    </div>
  );
}
