import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { CatalogSummary } from "@shared/contracts/drives";
import type { DriveSelectionItem } from "../features/drives/types";

export interface WorkspaceSnapshot {
  drive: DriveSelectionItem;
  catalog: CatalogSummary;
}

interface WorkspaceValue {
  drive: DriveSelectionItem | null;
  catalog: CatalogSummary | null;
  openWorkspace: (drive: DriveSelectionItem, catalog: CatalogSummary) => void;
  closeWorkspace: () => void;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function WorkspaceProvider({
  children,
  initialWorkspace = null,
}: {
  children: ReactNode;
  initialWorkspace?: WorkspaceSnapshot | null;
}): React.JSX.Element {
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot | null>(initialWorkspace);

  const openWorkspace = useCallback((drive: DriveSelectionItem, catalog: CatalogSummary) => {
    setWorkspace({ drive, catalog });
  }, []);

  const closeWorkspace = useCallback(() => {
    setWorkspace(null);
  }, []);

  const value = useMemo<WorkspaceValue>(
    () => ({
      drive: workspace?.drive ?? null,
      catalog: workspace?.catalog ?? null,
      openWorkspace,
      closeWorkspace,
    }),
    [closeWorkspace, openWorkspace, workspace],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const workspace = useContext(WorkspaceContext);
  if (workspace === null) {
    throw new Error("useWorkspace must be used inside WorkspaceProvider");
  }
  return workspace;
}
