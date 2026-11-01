import {
  CalendarClock,
  DatabaseBackup,
  FileText,
  HardDrive,
  Image,
  Images,
  Radar,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { NavLink, useSearchParams } from "react-router-dom";
import { formatBytes } from "../../lib/format";
import type { DriveSelectionItem } from "../drives/types";
import { useHealthSummary } from "../health/use-health";
import { libraryPath, parseLibraryDensity, parseLibraryFilter } from "../library/library-url";
import { useLibrarySummary } from "../library/use-library";
import { isScanRunning } from "../scan/types";
import { useScanState } from "../scan/use-scan";
import styles from "./AppShell.module.css";

function usedPercent(drive: DriveSelectionItem): number | null {
  if (drive.totalBytes <= 0) {
    return null;
  }
  return Math.min(
    100,
    Math.max(0, Math.round(((drive.totalBytes - drive.freeBytes) / drive.totalBytes) * 100)),
  );
}

function navClass({ isActive }: { isActive: boolean }): string {
  return `${styles.navItem}${isActive ? ` ${styles.navItemActive}` : ""}`;
}

function healthIssueCount(data: ReturnType<typeof useHealthSummary>["data"]): number {
  return (data?.missingFiles ?? 0) + (data?.movedCandidates ?? 0);
}

function SidebarDriveCard({
  drive,
  onOpenDrawer,
}: {
  drive: DriveSelectionItem;
  onOpenDrawer: () => void;
}): React.JSX.Element {
  const percent = usedPercent(drive);
  const letter = drive.letter === null ? "" : ` (${drive.letter})`;
  return (
    <button
      className={styles.driveCard}
      type="button"
      onClick={onOpenDrawer}
      aria-label={`Open drive details for ${drive.label}`}
    >
      <span className={styles.driveCardTop}>
        <span className={styles.driveCardIcon}>
          <HardDrive size={16} aria-hidden="true" />
        </span>
        <span className={styles.driveCardText}>
          <span className={styles.driveCardName}>
            {drive.label}
            {letter}
          </span>
          <span className={styles.driveCardState}>
            {drive.connection === "connected" ? "Connected · Read-only" : "Not connected"}
          </span>
        </span>
      </span>
      <span className={styles.driveCardMeta}>
        <span>
          {formatBytes(drive.freeBytes)} free of {formatBytes(drive.totalBytes)}
        </span>
        <span>{percent === null ? "" : `${String(percent)}%`}</span>
      </span>
      <span className={styles.driveCardBar} aria-hidden="true">
        <span style={percent === null ? undefined : { width: `${String(percent)}%` }} />
      </span>
    </button>
  );
}

export function Sidebar({
  drive,
  onOpenDrawer,
}: {
  drive: DriveSelectionItem;
  onOpenDrawer: () => void;
}): React.JSX.Element {
  const [searchParams] = useSearchParams();
  const scan = useScanState(drive.volumeId);
  const library = useLibrarySummary();
  const health = useHealthSummary();
  const undatedCount = library.data?.undatedCount ?? 0;
  const healthIssues = healthIssueCount(health.data);
  const memoryLanePath = libraryPath(
    parseLibraryFilter(searchParams.get("filter")),
    parseLibraryDensity(searchParams.get("density")),
  );

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarBrand}>
        <span className={styles.brandMark} aria-hidden="true">
          <Image size={19} />
        </span>
        <span>
          <span className={styles.brandName}>Memory Lane</span>
          <span className={styles.brandSub}>Local archive</span>
        </span>
      </div>

      <nav className={styles.sidebarNav} aria-label="Main navigation">
        <div className={styles.navLabel}>Library</div>
        <NavLink to={memoryLanePath} className={navClass}>
          <Images size={18} aria-hidden="true" />
          <span>Memory Lane</span>
        </NavLink>
        <NavLink to="/undated" className={navClass}>
          <CalendarClock size={18} aria-hidden="true" />
          <span>Date unavailable</span>
          {undatedCount > 0 ? <span className={styles.navBadge}>{undatedCount}</span> : null}
        </NavLink>
        <NavLink to="/files" className={navClass}>
          <FileText size={18} aria-hidden="true" />
          <span>Other files</span>
        </NavLink>
        <NavLink to="/health" className={navClass}>
          <ShieldCheck size={18} aria-hidden="true" />
          <span>Library health</span>
          {healthIssues > 0 ? <span className={styles.navBadge}>{healthIssues}</span> : null}
        </NavLink>
        <NavLink to="/backup" className={navClass}>
          <DatabaseBackup size={18} aria-hidden="true" />
          <span>Backup</span>
        </NavLink>

        <div className={styles.navDivider} />

        <div className={styles.navLabel}>System</div>
        <NavLink to="/scan" className={navClass}>
          <Radar size={18} aria-hidden="true" />
          <span>Scan &amp; processing</span>
          {isScanRunning(scan.data?.status) ? (
            <span className={styles.navPulse} title="Background processing active" />
          ) : null}
        </NavLink>
        <NavLink to="/settings" className={navClass}>
          <Settings size={18} aria-hidden="true" />
          <span>Settings</span>
        </NavLink>
      </nav>

      <div className={styles.sidebarBottom}>
        <SidebarDriveCard drive={drive} onOpenDrawer={onOpenDrawer} />
        <div className={styles.sidebarFootnote}>v0.1 · local only · no telemetry</div>
      </div>
    </aside>
  );
}
