import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play } from "lucide-react";
import type { ReplicationPlan } from "@shared/contracts/replication/types";
import { Alert } from "../../components/ui/Callout";
import { Modal } from "../../components/ui/Modal";
import { formatCount } from "../../lib/format";
import { formatSize } from "./components";
import { useStartRun } from "./use-replication";
import styles from "./replication.module.css";

function StartRunSummary({ plan }: { plan: ReplicationPlan }): React.JSX.Element {
  const rows = plan.partial?.rows ?? [];
  return (
    <>
      <div className={styles.statGrid}>
        <div className={styles.stat}>
          <span>New files</span>
          <strong>{formatCount(rows.reduce((total, row) => total + row.newFiles, 0))}</strong>
        </div>
        <div className={styles.stat}>
          <span>New bytes</span>
          <strong>{formatSize(rows.reduce((total, row) => total + row.newBytes, 0))}</strong>
        </div>
        <div className={styles.stat}>
          <span>Remainder</span>
          <strong>{formatCount(plan.remainder.files)}</strong>
        </div>
      </div>
      <div className={styles.candidateList}>
        {rows.map((row) => (
          <div className={styles.rowCard} key={row.destination.destinationId}>
            <div className={styles.rowHead}>
              <h3>{row.destination.label}</h3>
              <span className={styles.destinationMeta}>
                {row.offline ? "Offline — files wait for reconnect" : "Connected"}
              </span>
            </div>
            <div className={styles.rowStats}>
              <div className={styles.rowStat}>
                <span>New files</span>
                <strong>{formatCount(row.newFiles)}</strong>
              </div>
              <div className={styles.rowStat}>
                <span>New bytes</span>
                <strong>{formatSize(row.newBytes)}</strong>
              </div>
              <div className={styles.rowStat}>
                <span>Free after</span>
                <strong>{formatSize(row.freeAfterBytes)}</strong>
              </div>
              <div className={styles.rowStat}>
                <span>Priority</span>
                <strong>{String(row.destination.priority + 1)}</strong>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function StartRunDialog({
  plan,
  onClose,
}: {
  plan: ReplicationPlan;
  onClose: () => void;
}): React.JSX.Element {
  const navigate = useNavigate();
  const start = useStartRun();
  const [replaceStale, setReplaceStale] = useState(false);
  const staleWarning = plan.warnings.some((warning) => warning.code === "replica_review");

  async function submit(): Promise<void> {
    try {
      await start.mutateAsync({
        scope: "partial_only",
        planHash: plan.planHash,
        replaceStale,
      });
      onClose();
      void navigate("/backup/run");
    } catch {
      // The dialog shows the mutation error below.
    }
  }

  return (
    <Modal
      title="Start partial backup"
      description="Only uncovered files assigned to partial destinations are copied. Source files stay read-only."
      onClose={onClose}
      dismissible={!start.isPending}
      footer={
        <>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={onClose}
            disabled={start.isPending}
          >
            Cancel
          </button>
          <button
            className={styles.primaryButton}
            type="button"
            disabled={start.isPending || plan.partial === null}
            onClick={() => void submit()}
          >
            <Play size={14} aria-hidden="true" />
            {start.isPending ? "Starting…" : "Start backup"}
          </button>
        </>
      }
    >
      <StartRunSummary plan={plan} />
      {staleWarning ? (
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={replaceStale}
            onChange={(event) => setReplaceStale(event.target.checked)}
          />
          Replace stale or missing copies on their current destination
        </label>
      ) : null}
      {start.error === null ? null : <Alert>{start.error.message}</Alert>}
    </Modal>
  );
}
