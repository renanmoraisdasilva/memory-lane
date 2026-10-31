import { formatDateTime, formatDuration } from "../../lib/format";
import { SCAN_STAGE_LABELS, type ScanState } from "./types";
import styles from "./ScanPage.module.css";

function displayCurrentStage(state: ScanState): string {
  if (state.status === "complete") {
    return "Complete";
  }
  if (state.currentStage === null) {
    return "Waiting";
  }
  return SCAN_STAGE_LABELS[state.currentStage];
}

function displayEta(state: ScanState): string {
  if (state.status === "active") {
    return state.etaSeconds === null ? "Estimating…" : `About ${formatDuration(state.etaSeconds)}`;
  }
  if (state.status === "paused") {
    return "Resume when ready";
  }
  if (state.status === "interrupted") {
    return "Paused after interruption";
  }
  if (state.status === "complete") {
    return "Finished";
  }
  return "Stopped";
}

function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className={styles.detailRow}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function ScanDetails({
  state,
  driveLabel,
  catalogPath,
}: {
  state: ScanState;
  driveLabel: string;
  catalogPath: string;
}): React.JSX.Element {
  return (
    <section className={styles.panel} aria-labelledby="scan-details-title">
      <div className={styles.panelHead}>
        <h2 id="scan-details-title">Scan details</h2>
      </div>
      <Row label="Drive" value={driveLabel} />
      <Row label="Started" value={formatDateTime(state.startedAt)} />
      <Row label="Current stage" value={displayCurrentStage(state)} />
      <Row label="Estimated remaining" value={displayEta(state)} />
      <Row label="Last saved" value={formatDateTime(state.lastSavedAt)} />
      <div className={styles.catalogPath}>
        <span>Catalog</span>
        <code>{catalogPath}</code>
      </div>
    </section>
  );
}
