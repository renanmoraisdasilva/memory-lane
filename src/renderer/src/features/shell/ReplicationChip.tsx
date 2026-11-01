import { Link } from "react-router-dom";
import { useRunState } from "../replication/use-replication";
import styles from "./AppShell.module.css";

function labelFor(status: "running" | "paused" | "stopping" | "interrupted"): string {
  if (status === "running") return "Backup";
  if (status === "paused") return "Backup paused";
  if (status === "stopping") return "Stopping backup";
  return "Backup interrupted";
}

export function ReplicationChip(): React.JSX.Element | null {
  const query = useRunState();
  const state = query.data;
  if (state === null || state === undefined) {
    return null;
  }
  if (
    state.status !== "running" &&
    state.status !== "paused" &&
    state.status !== "stopping" &&
    state.status !== "interrupted"
  ) {
    return null;
  }
  const label = labelFor(state.status);
  const text =
    state.status === "running" || state.status === "stopping"
      ? `${label} · ${Math.round(state.percent)}%`
      : label;
  return (
    <Link className={styles.scanChip} to="/backup/run" title="Open backup run">
      <span className={styles.scanChipDot} aria-hidden="true" />
      {text}
    </Link>
  );
}
