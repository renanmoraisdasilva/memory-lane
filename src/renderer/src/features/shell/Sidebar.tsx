import { HardDrive, Image, Images, Radar } from "lucide-react";
import { NavLink } from "react-router-dom";
import { formatBytes } from "../../lib/format";
import type { DriveSelectionItem } from "../drives/types";
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

export function Sidebar({
  drive,
  onOpenDrawer,
}: {
  drive: DriveSelectionItem;
  onOpenDrawer: () => void;
}): React.JSX.Element {
  const scan = useScanState(drive.volumeId);
  const percent = usedPercent(drive);

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
        <NavLink to="/library" className={navClass}>
          <Images size={18} aria-hidden="true" />
          <span>Memory Lane</span>
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
      </nav>

      <div className={styles.sidebarBottom}>
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
                {drive.letter === null ? "" : ` (${drive.letter})`}
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
            <span>{percent === null ? "" : `${percent}%`}</span>
          </span>
          <span className={styles.driveCardBar} aria-hidden="true">
            <span style={percent === null ? undefined : { width: `${percent}%` }} />
          </span>
        </button>
        <div className={styles.sidebarFootnote}>Phase 2 · local only · no telemetry</div>
      </div>
    </aside>
  );
}
