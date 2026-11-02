import { Link } from "react-router-dom";
import type { AdoptionState } from "@shared/contracts/replication/types";
import { useActiveAdoptions } from "../replication/use-replication";
import styles from "./AppShell.module.css";

const WORKING_STATUSES = new Set<AdoptionState["status"]>(["scanning", "hashing"]);

function percentComplete(state: AdoptionState): number | null {
  if (state.totalFiles === null || state.totalFiles <= 0) {
    return null;
  }
  return Math.min(100, Math.max(0, Math.round((state.scannedFiles / state.totalFiles) * 100)));
}

function chipText(state: AdoptionState): string {
  if (state.status === "paused") {
    return "Adoption paused";
  }
  if (state.status === "interrupted") {
    return "Adoption interrupted";
  }
  const percent = percentComplete(state);
  return percent === null ? "Adopting drive" : `Adopting drive · ${String(percent)}%`;
}

export function AdoptionChip(): React.JSX.Element | null {
  const query = useActiveAdoptions();
  const states = query.data ?? [];
  const state = states.find((item) => WORKING_STATUSES.has(item.status)) ?? states[0];
  if (state === undefined) {
    return null;
  }
  return (
    <Link
      className={styles.scanChip}
      to={`/backup/destinations/${state.destinationId}`}
      title="Open destination adoption"
    >
      <span className={styles.scanChipDot} aria-hidden="true" />
      {chipText(state)}
    </Link>
  );
}
