import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../../app/workspace";
import { DriveDrawer } from "./DriveDrawer";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import styles from "./AppShell.module.css";

export type ShellMode = "default" | "fill";

export function AppShell({
  children,
  crumbs,
  mode = "default",
}: {
  children: ReactNode;
  crumbs: string[];
  mode?: ShellMode;
}): React.JSX.Element | null {
  const { drive, catalog, closeWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (drive === null || catalog === null) {
    return null;
  }

  function switchDrive(): void {
    setDrawerOpen(false);
    closeWorkspace();
    void navigate("/");
  }

  return (
    <div className={styles.app}>
      <Sidebar drive={drive} onOpenDrawer={() => setDrawerOpen(true)} />
      <div className={styles.workspace}>
        <TopBar crumbs={crumbs} volumeId={drive.volumeId} />
        <main className={mode === "fill" ? `${styles.page} ${styles.pageFill}` : styles.page}>
          {children}
        </main>
      </div>
      {drawerOpen ? (
        <DriveDrawer
          drive={drive}
          catalog={catalog}
          onClose={() => setDrawerOpen(false)}
          onSwitchDrive={switchDrive}
        />
      ) : null}
    </div>
  );
}
