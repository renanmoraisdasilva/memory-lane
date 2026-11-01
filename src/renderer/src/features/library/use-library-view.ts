import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import type { VirtualGridHandle } from "../../components/ui/VirtualGrid";
import { useLibraryViewMemory, type LibraryViewSnapshot } from "./library-view-memory";
import { anchorKey } from "./timeline-model";
import type { LibraryDensity, LibraryFilter, PeriodAnchor } from "./types";

function useInitialView(scope: string | null): LibraryViewSnapshot | null {
  const memory = useLibraryViewMemory();
  const [initialView] = useState(() => (scope === null ? null : memory.read(scope)));
  return initialView;
}

export function useLibraryViewAnchor({
  scope,
  filter,
  density,
}: {
  scope: string | null;
  filter: LibraryFilter;
  density: LibraryDensity;
}): {
  anchor: PeriodAnchor;
  setAnchor: Dispatch<SetStateAction<PeriodAnchor>>;
} {
  const initialView = useInitialView(scope);
  const initialAnchor =
    initialView !== null && initialView.filter === filter && initialView.density === density
      ? initialView.anchor
      : null;
  const [anchor, setAnchor] = useState<PeriodAnchor>(initialAnchor);
  return { anchor, setAnchor };
}

export function useLibraryScrollMemory({
  scope,
  filter,
  density,
  anchor,
  rowsCount,
  gridRef,
}: {
  scope: string | null;
  filter: LibraryFilter;
  density: LibraryDensity;
  anchor: PeriodAnchor;
  rowsCount: number;
  gridRef: RefObject<VirtualGridHandle | null>;
}): (offset: number) => void {
  const memory = useLibraryViewMemory();
  const initialView = useInitialView(scope);
  const remembersView =
    initialView !== null && initialView.filter === filter && initialView.density === density;
  const initialOffset = remembersView ? (initialView?.scrollOffset ?? 0) : 0;
  const scrollOffsetRef = useRef(initialOffset);
  const pendingRestoreRef = useRef<number | null>(remembersView ? initialOffset : null);
  const restoringRef = useRef(remembersView);
  const viewKey = `${filter}:${anchorKey(anchor)}`;
  const previousViewKeyRef = useRef(viewKey);

  useEffect(() => {
    if (previousViewKeyRef.current === viewKey) {
      return;
    }
    previousViewKeyRef.current = viewKey;
    pendingRestoreRef.current = null;
    restoringRef.current = false;
    scrollOffsetRef.current = 0;
  }, [viewKey]);

  const saveView = useCallback(
    (offset: number): void => {
      if (scope === null) {
        return;
      }
      memory.save(scope, { filter, density, anchor, scrollOffset: offset });
    },
    [anchor, density, filter, memory, scope],
  );

  const handleScroll = useCallback(
    (offset: number): void => {
      scrollOffsetRef.current = offset;
      if (!restoringRef.current) {
        saveView(offset);
      }
    },
    [saveView],
  );

  useEffect(() => {
    return () => {
      saveView(scrollOffsetRef.current);
    };
  }, [saveView]);

  useEffect(() => {
    const pending = pendingRestoreRef.current;
    if (pending === null || rowsCount === 0) {
      return;
    }
    pendingRestoreRef.current = null;
    gridRef.current?.scrollToOffset(pending);
    restoringRef.current = false;
  }, [gridRef, rowsCount]);

  return handleScroll;
}
