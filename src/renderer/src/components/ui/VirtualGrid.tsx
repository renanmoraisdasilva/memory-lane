import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import { forwardRef, useEffect, useImperativeHandle, useRef, type ReactNode } from "react";
import styles from "./VirtualGrid.module.css";

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
  scrollToOffset: (offset: number) => number;
}

export interface VirtualGridProps {
  rows: VirtualRow[];
  ariaLabel: string;
  overscan?: number;
  onEndReached?: () => void;
  onScroll?: (offset: number) => void;
  onVisibleRangeChange?: (range: VisibleRange) => void;
  className?: string;
}

function VirtualRowView({
  row,
  virtualItem,
}: {
  row: VirtualRow;
  virtualItem: VirtualItem;
}): React.JSX.Element {
  return (
    <div
      className={styles.row}
      style={{
        height: virtualItem.size,
        transform: `translateY(${String(virtualItem.start)}px)`,
      }}
      data-row-index={virtualItem.index}
    >
      {row.render()}
    </div>
  );
}

export const VirtualGrid = forwardRef<VirtualGridHandle, VirtualGridProps>(function VirtualGrid(
  {
    rows,
    ariaLabel,
    overscan = 3,
    onEndReached,
    onScroll,
    onVisibleRangeChange,
    className,
  }: VirtualGridProps,
  ref,
): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endReachedRef = useRef(false);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => rows[index]?.height ?? 0,
    getItemKey: (index) => rows[index]?.key ?? index,
    overscan,
    initialRect: { width: 1000, height: 800 },
    observeElementRect: (instance, callback) => {
      const element = instance.scrollElement;
      if (element === null) {
        return undefined;
      }
      const update = (): void => {
        callback({
          width: element.clientWidth > 0 ? element.clientWidth : 1000,
          height: element.clientHeight > 0 ? element.clientHeight : 800,
        });
      };
      update();
      if (typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver(update);
        observer.observe(element);
        return () => observer.disconnect();
      }
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    },
  });
  const virtualItems = virtualizer.getVirtualItems();
  const lastVirtualItem = virtualItems[virtualItems.length - 1];
  const firstVirtualItem = virtualItems[0];

  useEffect(() => {
    if (firstVirtualItem === undefined || lastVirtualItem === undefined) {
      return;
    }
    onVisibleRangeChange?.({
      startIndex: firstVirtualItem.index,
      endIndex: lastVirtualItem.index,
    });
  }, [firstVirtualItem, lastVirtualItem, onVisibleRangeChange]);

  useEffect(() => {
    const nearEnd = lastVirtualItem !== undefined && lastVirtualItem.index >= rows.length - 2;
    if (nearEnd && !endReachedRef.current) {
      endReachedRef.current = true;
      onEndReached?.();
    } else if (!nearEnd) {
      endReachedRef.current = false;
    }
  }, [lastVirtualItem, onEndReached, rows.length]);

  useImperativeHandle(
    ref,
    () => ({
      scrollToIndex(index: number): void {
        virtualizer.scrollToIndex(index, { align: "start" });
      },
      scrollToOffset(offset: number): number {
        const element = scrollRef.current;
        if (element === null) {
          return 0;
        }
        element.scrollTop = Math.max(0, offset);
        return element.scrollTop;
      },
    }),
    [virtualizer],
  );

  const classes = className === undefined ? styles.viewport : `${styles.viewport} ${className}`;

  return (
    <div
      ref={scrollRef}
      className={classes}
      role="feed"
      aria-label={ariaLabel}
      onScroll={(event) => onScroll?.(event.currentTarget.scrollTop)}
    >
      <div className={styles.spacer} style={{ height: virtualizer.getTotalSize() }}>
        {virtualItems.map((virtualItem) => {
          const row = rows[virtualItem.index];
          return row === undefined ? null : (
            <VirtualRowView key={row.key} row={row} virtualItem={virtualItem} />
          );
        })}
      </div>
    </div>
  );
});
