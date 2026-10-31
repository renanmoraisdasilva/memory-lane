import { Info, Play, ScanLine, ShieldCheck } from "lucide-react";
import type { CatalogSummary } from "@shared/contracts/drives";
import { Callout, Spinner } from "../../components/ui/Callout";
import { Pill } from "../../components/ui/Pill";
import { formatCount, formatDateTime } from "../../lib/format";
import type { DriveSelectionItem } from "../drives/types";
import { driveLetterLabel } from "../drives/types";
import { IntensityControl } from "./IntensityControl";
import { ScanHero } from "./ScanHero";
import { STAGE_ICONS } from "./stage-meta";
import {
  SCAN_STAGE_DESCRIPTIONS,
  SCAN_STAGE_LABELS,
  SCAN_STAGE_ORDER,
  type ScanIntensity,
} from "./types";
import styles from "./ScanPage.module.css";

function IdleStats({
  drive,
  catalog,
}: {
  drive: DriveSelectionItem;
  catalog: CatalogSummary;
}): React.JSX.Element {
  return (
    <div className={styles.statStrip}>
      <div className={styles.stat}>
        <span className={styles.statValue}>{formatCount(catalog.fileCount)}</span>
        <span className={styles.statLabel}>Files cataloged</span>
        <span className={styles.statHint}>From the current catalog</span>
      </div>
      <div className={styles.stat}>
        <span className={styles.statValue}>v{catalog.schemaVersion}</span>
        <span className={styles.statLabel}>Catalog schema</span>
        <span className={styles.statHint}>App-managed database</span>
      </div>
      <div className={styles.stat}>
        <span className={styles.statValue}>
          {drive.lastScanAt === null ? "Not reported" : formatDateTime(drive.lastScanAt)}
        </span>
        <span className={styles.statLabel}>Last scan</span>
        <span className={styles.statHint}>From the drive registry</span>
      </div>
      <div className={styles.stat}>
        <span className={styles.statValue}>{driveLetterLabel(drive)}</span>
        <span className={styles.statLabel}>Archive source</span>
        <span className={styles.statHint}>{drive.label}</span>
      </div>
    </div>
  );
}

function StagePreviewList(): React.JSX.Element {
  return (
    <div className={styles.stagePreviewList}>
      {SCAN_STAGE_ORDER.map((stageId, index) => {
        const Icon = STAGE_ICONS[stageId];
        return (
          <div className={styles.stagePreview} key={stageId}>
            <div className={styles.stageIcon}>
              <Icon size={17} aria-hidden="true" />
            </div>
            <div>
              <div className={styles.stagePreviewHead}>
                <h3>
                  {index + 1}. {SCAN_STAGE_LABELS[stageId]}
                </h3>
              </div>
              <p className={styles.stageDescription}>{SCAN_STAGE_DESCRIPTIONS[stageId]}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ScanIdleState({
  drive,
  catalog,
  intensity,
  intensityPending,
  startPending,
  onStart,
  onIntensity,
}: {
  drive: DriveSelectionItem;
  catalog: CatalogSummary;
  intensity: ScanIntensity;
  intensityPending: boolean;
  startPending: boolean;
  onStart: () => void;
  onIntensity: (value: ScanIntensity) => void;
}): React.JSX.Element {
  return (
    <>
      <ScanHero
        title="Ready to scan"
        description="Start an incremental scan to catalog new files, refresh metadata, generate missing thumbnails, and continue hashing. Completed work is reused on every run."
        actions={
          <button
            className={styles.primaryButton}
            type="button"
            disabled={startPending}
            onClick={onStart}
          >
            {startPending ? <Spinner /> : <Play size={14} aria-hidden="true" />}
            {startPending ? "Starting…" : "Start scan"}
          </button>
        }
      />

      <IdleStats drive={drive} catalog={catalog} />

      <div className={styles.scanLayout}>
        <div className={styles.mainColumn}>
          <section className={styles.panel} aria-labelledby="next-scan-title">
            <div className={styles.panelHead}>
              <div>
                <h2 id="next-scan-title">What the next scan does</h2>
                <p className={styles.panelDescription}>
                  The four stages run in order. The catalog becomes useful after the first stage,
                  and completed work is reused on later scans.
                </p>
              </div>
              <Pill tone="muted">Next run</Pill>
            </div>
            <StagePreviewList />
          </section>

          <Callout
            tone="green"
            icon={<ShieldCheck size={17} aria-hidden="true" />}
            title="Read-only throughout"
          >
            Scanning only reads original files. The catalog, cache, and logs live in the app-managed
            .memorylane folder on this drive.
          </Callout>
        </div>

        <aside className={styles.aside}>
          <IntensityControl value={intensity} pending={intensityPending} onChange={onIntensity} />
          <Callout
            tone="amber"
            icon={<ScanLine size={17} aria-hidden="true" />}
            title="Available while you scan"
          >
            Memory Lane, Date unavailable, Library health, Other files, and Settings are available
            from the sidebar. Browsing stays responsive while the scan continues.
          </Callout>
          <Callout
            tone="neutral"
            icon={<Info size={17} aria-hidden="true" />}
            title="Safe interruption"
          >
            If the app closes or the drive disconnects, work stops safely. Progress is saved, and
            nothing resumes until you choose Resume.
          </Callout>
        </aside>
      </div>
    </>
  );
}
