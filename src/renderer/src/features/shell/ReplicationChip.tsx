import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { ReplicationRunState } from "@shared/contracts/replication/types";
import { useRunState } from "../replication/use-replication";
import styles from "./AppShell.module.css";

const TERMINAL_STATUSES = new Set(["completed", "stopped", "failed"]);
const VISIBLE_STATUSES = new Set(["running", "paused", "stopping", "interrupted"]);

function isTerminal(state: ReplicationRunState | null | undefined): boolean {
  return state !== null && state !== undefined && TERMINAL_STATUSES.has(state.status);
}

function isVisible(state: ReplicationRunState | null | undefined): state is ReplicationRunState {
  return state !== null && state !== undefined && VISIBLE_STATUSES.has(state.status);
}

function chipText(state: ReplicationRunState): string {
  if (state.status === "running") return `Backing up · ${String(Math.round(state.percent))}%`;
  if (state.status === "stopping") return "Stopping backup";
  if (state.status === "paused") return "Backup paused";
  return "Backup interrupted";
}

export function ReplicationChip(): React.JSX.Element | null {
  const query = useRunState();
  const queryClient = useQueryClient();
  const state = query.data;
  const terminal = isTerminal(state);
  useEffect(() => {
    if (!terminal) {
      return;
    }
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ["replication", "overview"] }),
      queryClient.invalidateQueries({ queryKey: ["replication", "plan"] }),
      queryClient.invalidateQueries({ queryKey: ["replication", "destinations"] }),
      queryClient.invalidateQueries({ queryKey: ["replication", "destination"] }),
      queryClient.invalidateQueries({ queryKey: ["replication", "promotion"] }),
    ]);
  }, [queryClient, state?.id, state?.status, terminal]);
  if (!isVisible(state)) {
    return null;
  }
  return (
    <Link className={styles.scanChip} to="/backup/run" title="Open backup run">
      <span className={styles.scanChipDot} aria-hidden="true" />
      {chipText(state)}
    </Link>
  );
}
