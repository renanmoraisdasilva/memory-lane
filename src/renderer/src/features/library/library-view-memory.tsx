import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from "react";
import type { LibraryDensity, LibraryFilter, PeriodAnchor } from "./types";

export interface LibraryViewSnapshot {
  filter: LibraryFilter;
  density: LibraryDensity;
  anchor: PeriodAnchor;
  scrollOffset: number;
}

interface LibraryViewMemoryValue {
  read: (scope: string) => LibraryViewSnapshot | null;
  save: (scope: string, snapshot: LibraryViewSnapshot) => void;
}

const LibraryViewMemoryContext = createContext<LibraryViewMemoryValue | null>(null);

export function LibraryViewMemoryProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const memory = useRef(new Map<string, LibraryViewSnapshot>());

  const read = useCallback(
    (scope: string): LibraryViewSnapshot | null => memory.current.get(scope) ?? null,
    [],
  );
  const save = useCallback((scope: string, snapshot: LibraryViewSnapshot): void => {
    memory.current.set(scope, snapshot);
  }, []);
  const value = useMemo<LibraryViewMemoryValue>(() => ({ read, save }), [read, save]);

  return (
    <LibraryViewMemoryContext.Provider value={value}>{children}</LibraryViewMemoryContext.Provider>
  );
}

export function useLibraryViewMemory(): LibraryViewMemoryValue {
  const value = useContext(LibraryViewMemoryContext);
  if (value === null) {
    throw new Error("useLibraryViewMemory must be used inside LibraryViewMemoryProvider");
  }
  return value;
}
