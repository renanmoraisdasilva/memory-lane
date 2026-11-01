import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ReplicationRunState } from "@shared/contracts/replication/types";
import { Alert } from "../../components/ui/Callout";
import { AddDestinationDrawer } from "./AddDestinationDrawer";
import { PlanPageBody } from "./plan-sections";
import { StartRunDialog } from "./StartRunDialog";
import { useReplicationPlan, useRunState } from "./use-replication";
import styles from "./replication.module.css";

function activeRunFrom(state: ReplicationRunState | null | undefined): ReplicationRunState | null {
  if (state === null || state === undefined) {
    return null;
  }
  return ["running", "paused", "stopping", "interrupted"].includes(state.status) ? state : null;
}

export function ReplicationPlanPage(): React.JSX.Element {
  const plan = useReplicationPlan();
  const run = useRunState();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const data = plan.data;

  if (plan.isPending) {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Building the backup plan…</p>
      </div>
    );
  }
  if (plan.error !== null || data === undefined) {
    return (
      <div className={styles.page}>
        <Alert>Could not build the backup plan.</Alert>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <PlanPageBody
        plan={data}
        activeRun={activeRunFrom(run.data)}
        onAddDestination={() => setDrawerOpen(true)}
        onStart={() => setStartOpen(true)}
        onOpenRun={() => void navigate("/backup/run")}
      />
      {startOpen ? <StartRunDialog plan={data} onClose={() => setStartOpen(false)} /> : null}
      {drawerOpen ? (
        <AddDestinationDrawer
          onClose={() => setDrawerOpen(false)}
          onRegistered={() => setDrawerOpen(false)}
        />
      ) : null}
    </div>
  );
}
