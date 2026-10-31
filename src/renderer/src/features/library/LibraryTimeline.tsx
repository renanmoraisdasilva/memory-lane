import { CalendarX } from "lucide-react";
import type { RefObject } from "react";
import {
  VirtualGrid,
  type VirtualGridHandle,
  type VisibleRange,
} from "../../components/ui/VirtualGrid";
import { Pill } from "../../components/ui/Pill";
import { formatCount } from "../../lib/format";
import { MediaTile } from "./MediaTile";
import { DENSITY_METRICS, type TimelineRow } from "./timeline-model";
import type { LibraryDensity, LibraryFilter } from "./types";
import styles from "./LibraryPage.module.css";

function precisionShortLabel(
  precision: Extract<TimelineRow, { kind: "section" }>["section"]["precision"],
): string {
  if (precision === "exact") {
    return "Day";
  }
  if (precision === "month") {
    return "Month";
  }
  if (precision === "year") {
    return "Year";
  }
  return "Undated";
}

function precisionTone(row: Extract<TimelineRow, { kind: "section" }>): "amber" | "muted" {
  return row.section.precision === null ? "muted" : "amber";
}

function SectionHeading({
  row,
}: {
  row: Extract<TimelineRow, { kind: "section" }>;
}): React.JSX.Element {
  return (
    <div className={styles.sectionHead}>
      <div>
        <h2>{row.section.label}</h2>
        <div className={styles.sectionMeta}>
          <span>{row.section.meta}</span>
          <Pill tone={precisionTone(row)}>{precisionShortLabel(row.section.precision)}</Pill>
        </div>
      </div>
      <span className={styles.sectionCount}>{formatCount(row.section.items.length)} items</span>
    </div>
  );
}

function UndatedNote(): React.JSX.Element {
  return (
    <div className={styles.undatedNote} role="note">
      <CalendarX size={15} aria-hidden="true" />
      These items have no resolved date. Manual date assignment arrives in Phase 3; no date is
      invented and originals are never changed.
    </div>
  );
}

export function LibraryTimeline({
  rows,
  columns,
  density,
  filter,
  gridRef,
  onVisibleRangeChange,
  onEndReached,
  hasNextPage,
  isFetchingNextPage,
}: {
  rows: TimelineRow[];
  columns: number;
  density: LibraryDensity;
  filter: LibraryFilter;
  gridRef: RefObject<VirtualGridHandle | null>;
  onVisibleRangeChange: (range: VisibleRange) => void;
  onEndReached: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}): React.JSX.Element {
  const metrics = DENSITY_METRICS[density];
  const virtualRows = rows.map((row) => ({
    key: row.key,
    height: row.height,
    ...(row.kind === "items" ? { itemIds: row.itemIds } : {}),
    render: () =>
      row.kind === "section" ? (
        <>
          {row.section.precision === null ? <UndatedNote /> : null}
          <SectionHeading row={row} />
        </>
      ) : (
        <div
          className={styles.mediaGrid}
          style={{
            gridTemplateColumns: `repeat(${String(columns)}, minmax(0, 1fr))`,
            paddingBottom: metrics.gap,
            gap: metrics.gap,
          }}
        >
          {row.items.map((item) => (
            <MediaTile
              key={`${String(item.fileId)}:${item.thumbnailUrl ?? "none"}:${item.thumbnailStatus}`}
              item={item}
              filter={filter}
              density={density}
            />
          ))}
        </div>
      ),
  }));

  return (
    <div className={styles.timelineBody}>
      <VirtualGrid
        ref={gridRef}
        rows={virtualRows}
        ariaLabel="Media timeline"
        onVisibleRangeChange={onVisibleRangeChange}
        onEndReached={onEndReached}
      />
      <div className={styles.timelineFooter}>
        {isFetchingNextPage ? <span>Loading more items…</span> : null}
        {!hasNextPage && !isFetchingNextPage ? <span>End of Memory Lane</span> : null}
      </div>
    </div>
  );
}
