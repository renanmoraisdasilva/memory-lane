import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import styles from "./VirtualGrid.module.css";

const FALLBACK_VIEWPORT_HEIGHT = 800;

export interface VirtualRow {
  key: string;
  height: number;
  render: () => ReactNode;
  itemIds?: number[];
}

export interface VisibleRange {
  startIndex: number;
  endIndex: number;
}

export interface VirtualGridHandle {
  scrollToIndex: (index: number) => void;
}

interface Offsets {
  starts: number[];
  total: number;
}

function buildOffsets(rows: VirtualRow[]): Offsets {
  const starts: number[] = [];
  let total = 0;
  for (const row of rows) {
    starts.push(total);
    total += row.height;
  }
  return { starts, total };
}

function firstVisibleIndex(starts: number[], scrollTop: number): number {
  let found = 0;
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index];
    if (start === undefined || start > scrollTop) {
      break;
    }
    found = index;
  }
  return found;
}

function lastVisibleIndex(
  starts: number[],
  rowCount: number,
  scrollTop: number,
  viewportHeight: number,
): number {
  const bottom = scrollTop + viewportHeight;
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index];
    if (start !== undefined && start > bottom) {
      return Math.max(0, index - 1);
    }
  }
  return Math.max(0, rowCount - 1);
}

function visibleRange(options: {
  offsets: Offsets;
  rowCount: number;
  scrollTop: number;
  viewportHeight: number;
  overscan: number;
}): VisibleRange {
  const { offsets, rowCount, scrollTop, viewportHeight, overscan } = options;
  if (rowCount === 0) {
    return { startIndex: 0, endIndex: -1 };
  }
  const start = Math.max(0, firstVisibleIndex(offsets.starts, scrollTop) - overscan);
  const end = Math.min(
    rowCount - 1,
    lastVisibleIndex(offsets.starts, rowCount, scrollTop, viewportHeight) + overscan,
  );
  return { startIndex: start, endIndex: Math.max(start, end) };
}

export interface VirtualGridProps {
  rows: VirtualRow[];
  ariaLabel: string;
  overscan?: number;
  onEndReached?: () => void;
  onVisibleRangeChange?: (range: VisibleRange) => void;
  className?: string;
}

export const VirtualGrid = forwardRef<VirtualGridHandle, VirtualGridProps>(function VirtualGrid(
  {
    rows,
    ariaLabel,
    overscan = 3,
    onEndReached,
    onVisibleRangeChange,
    className,
  }: VirtualGridProps,
  ref,
): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endReachedRef = useRef(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(FALLBACK_VIEWPORT_HEIGHT);
  const offsets = useMemo(() => buildOffsets(rows), [rows]);
  const range = visibleRange({
    offsets,
    rowCount: rows.length,
    scrollTop,
    viewportHeight,
    overscan,
  });

  useEffect(() => {
    const element = scrollRef.current;
    if (element === null) {
      return undefined;
    }
    const update = (): void => {
      setViewportHeight(element.clientHeight > 0 ? element.clientHeight : FALLBACK_VIEWPORT_HEIGHT);
    };
    update();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(update);
      observer.observe(element);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    onVisibleRangeChange?.(range);
  }, [onVisibleRangeChange, range]);

  useEffect(() => {
    const nearEnd = range.endIndex >= rows.length - 2;
    if (nearEnd && !endReachedRef.current) {
      endReachedRef.current = true;
      onEndReached?.();
    } else if (!nearEnd) {
      endReachedRef.current = false;
    }
  }, [onEndReached, range.endIndex, rows.length]);

  useImperativeHandle(
    ref,
    () => ({
      scrollToIndex(index: number): void {
        const start = offsets.starts[index];
        if (start === undefined) {
          return;
        }
        const element = scrollRef.current;
        if (element !== null) {
          element.scrollTop = start;
        }
        setScrollTop(start);
      },
    }),
    [offsets],
  );

  const visible = rows.slice(range.startIndex, range.endIndex + 1);
  const classes = className === undefined ? styles.viewport : `${styles.viewport} ${className}`;

  return (
    <div
      ref={scrollRef}
      className={classes}
      role="feed"
      aria-label={ariaLabel}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div className={styles.spacer} style={{ height: offsets.total }}>
        {visible.map((row, offset) => {
          const index = range.startIndex + offset;
          const top = offsets.starts[index] ?? 0;
          return (
            <div
              key={row.key}
              className={styles.row}
              style={{ top, height: row.height }}
              data-row-index={index}
            >
              {row.render()}
            </div>
          );
        })}
      </div>
    </div>
  );
});
