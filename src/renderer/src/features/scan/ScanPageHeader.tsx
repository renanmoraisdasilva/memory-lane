import { AlertTriangle, CheckCircle2, Clock, Pause, RefreshCw } from "lucide-react";
import { Pill, type PillTone } from "../../components/ui/Pill";
import type { DriveSelectionItem } from "../drives/types";
import { driveLetterLabel } from "../drives/types";
import type { ScanStatus } from "./types";
import styles from "./ScanPage.module.css";

function statusTitle(status: ScanStatus): string {
  switch (status) {
    case "idle":
      return "Ready";
    case "active":
      return "Scanning";
    case "paused":
      return "Paused";
    case "interrupted":
      return "Interrupted";
    case "complete":
      return "Complete";
    case "error":
      return "Error";
  }
}

function statusTone(status: ScanStatus): PillTone {
  if (status === "complete") {
    return "green";
  }
  if (status === "interrupted" || status === "error") {
    return "red";
  }
  if (status === "active" || status === "paused") {
    return "amber";
  }
  return "muted";
}

function statusSubtitle(status: ScanStatus): string {
  switch (status) {
    case "idle":
      return "Four stages, ready when you are.";
    case "active":
      return "Four independent stages. Progress is saved as work completes.";
    case "paused":
      return "Progress saved. Nothing restarts automatically.";
    case "interrupted":
      return "Progress saved. Waiting for a manual resume.";
    case "complete":
      return "The last scan finished. Review the report below.";
    case "error":
      return "The scan stopped before completion.";
  }
}

function statusIcon(status: ScanStatus): React.JSX.Element {
  if (status === "active") {
    return <RefreshCw size={11} aria-hidden="true" className={styles.stateSpinning} />;
  }
  if (status === "paused") {
    return <Pause size={11} aria-hidden="true" />;
  }
  if (status === "interrupted" || status === "error") {
    return <AlertTriangle size={11} aria-hidden="true" />;
  }
  if (status === "complete") {
    return <CheckCircle2 size={11} aria-hidden="true" />;
  }
  return <Clock size={11} aria-hidden="true" />;
}

function StatusPill({ status }: { status: ScanStatus }): React.JSX.Element {
  return (
    <Pill tone={statusTone(status)} icon={statusIcon(status)}>
      {statusTitle(status)}
    </Pill>
  );
}

export function PageHeader({
  drive,
  status,
}: {
  drive: DriveSelectionItem;
  status: ScanStatus;
}): React.JSX.Element {
  return (
    <header className={styles.pageHead}>
      <div>
        <div className={styles.eyebrow}>Catalog pipeline</div>
        <h1>Scan &amp; processing</h1>
        <p>
          {drive.label} ({driveLetterLabel(drive)}) · Read-only access · {statusSubtitle(status)}
        </p>
      </div>
      <div className={styles.headActions}>
        <StatusPill status={status} />
      </div>
    </header>
  );
}
