import type { VolumeId } from "@shared/contracts/drives";
import { Link } from "react-router-dom";
import { useScanState } from "../scan/use-scan";
import { scanOverallProgress } from "../scan/types";
import styles from "./AppShell.module.css";

function chipLabel(status: "active" | "paused" | "interrupted"): string {
  if (status === "active") {
    return "Cataloging";
  }
  return status === "paused" ? "Scan paused" : "Scan interrupted";
}

export function ScanChip({ volumeId }: { volumeId: VolumeId }): React.JSX.Element | null {
  const query = useScanState(volumeId);
  const state = query.data;
  if (state === null || state === undefined) {
    return null;
  }
  if (state.status !== "active" && state.status !== "paused" && state.status !== "interrupted") {
    return null;
  }
  const percent = scanOverallProgress(state.stages);
  const label = chipLabel(state.status);
  const text = percent === null ? label : `${label} · ${percent}%`;

  return (
    <Link className={styles.scanChip} to="/scan" title="Open scan progress">
      <span className={styles.scanChipDot} aria-hidden="true" />
      {text}
    </Link>
  );
}
