import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play } from "lucide-react";
import type { ReplicationPlan, ReplicationRunScope } from "@shared/contracts/replication/types";
import { Alert, Callout } from "../../components/ui/Callout";
import { Modal } from "../../components/ui/Modal";
import { formatCount } from "../../lib/format";
import { formatSize } from "./components";
import { useStartRun } from "./use-replication";
import styles from "./replication.module.css";

const SCOPE_LABELS: Record<ReplicationRunScope, string> = {
  all_connected: "All connected work (full copy first, then partial)",
  full_copy_only: "Full copy only",
  partial_only: "Partial coverage only",
};

function availableScopes(plan: ReplicationPlan): ReplicationRunScope[] {
  const shortfall = plan.fullCopy !== null && plan.fullCopy.shortfallFiles > 0;
  return plan.executionScopes.filter((scope) => {
    if (shortfall && scope !== "partial_only") {
      return false;
    }
    return true;
  });
}

function defaultScope(scopes: ReplicationRunScope[]): ReplicationRunScope {
  if (scopes.includes("all_connected")) {
    return "all_connected";
  }
  return scopes[0] ?? "partial_only";
}

function scopeIncludesFull(plan: ReplicationPlan, scope: ReplicationRunScope): boolean {
  return scope !== "partial_only" && plan.fullCopy !== null;
}

function scopeIncludesPartial(scope: ReplicationRunScope): boolean {
  return scope !== "full_copy_only";
}

function runTotals(
  plan: ReplicationPlan,
  scope: ReplicationRunScope,
): {
  files: number;
  bytes: number;
  includeFull: boolean;
  includePartial: boolean;
} {
  const includeFull = scopeIncludesFull(plan, scope);
  const includePartial = scopeIncludesPartial(scope);
  const rows = includePartial ? (plan.partial?.rows ?? []) : [];
  const fullFiles = includeFull ? (plan.fullCopy?.newFiles ?? 0) : 0;
  const fullBytes = includeFull ? (plan.fullCopy?.newBytes ?? 0) : 0;
  return {
    files: fullFiles + rows.reduce((total, row) => total + row.newFiles, 0),
    bytes: fullBytes + rows.reduce((total, row) => total + row.newBytes, 0),
    includeFull,
    includePartial,
  };
}
function StartRunSummary({
  plan,
  scope,
}: {
  plan: ReplicationPlan;
  scope: ReplicationRunScope;
}): React.JSX.Element {
  const rows = plan.partial?.rows ?? [];
  const totals = runTotals(plan, scope);
  return (
    <>
      <div className={styles.statGrid}>
        <div className={styles.stat}>
          <span>New files</span>
          <strong>{formatCount(totals.files)}</strong>
        </div>
        <div className={styles.stat}>
          <span>New bytes</span>
          <strong>{formatSize(totals.bytes)}</strong>
        </div>
        <div className={styles.stat}>
          <span>Remainder</span>
          <strong>{formatCount(plan.remainder.files)}</strong>
        </div>
      </div>
      <div className={styles.candidateList}>
        {totals.includeFull && plan.fullCopy !== null ? (
          <div className={styles.rowCard} key={plan.fullCopy.destination.destinationId}>
            <div className={styles.rowHead}>
              <h3>{plan.fullCopy.destination.label}</h3>
              <span className={styles.destinationMeta}>Full copy · runs first</span>
            </div>
            <div className={styles.rowStats}>
              <div className={styles.rowStat}>
                <span>New files</span>
                <strong>{formatCount(plan.fullCopy.newFiles)}</strong>
              </div>
              <div className={styles.rowStat}>
                <span>New bytes</span>
                <strong>{formatSize(plan.fullCopy.newBytes)}</strong>
              </div>
              <div className={styles.rowStat}>
                <span>Free after</span>
                <strong>{formatSize(plan.fullCopy.freeAfterBytes)}</strong>
              </div>
            </div>
          </div>
        ) : null}
        {totals.includePartial
          ? rows.map((row) => (
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
            ))
          : null}
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
  const scopes = availableScopes(plan);
  const [scope, setScope] = useState<ReplicationRunScope>(() => defaultScope(scopes));
  const [replaceStale, setReplaceStale] = useState(false);
  const staleWarning = plan.warnings.some((warning) => warning.code === "replica_review");
  const shortfall = plan.fullCopy !== null && plan.fullCopy.shortfallFiles > 0;

  async function submit(): Promise<void> {
    try {
      await start.mutateAsync({
        scope,
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
      title="Start backup"
      description="Full-copy destinations run first, then partial destinations in priority order. Source files stay read-only."
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
            disabled={start.isPending || scopes.length === 0}
            onClick={() => void submit()}
          >
            <Play size={14} aria-hidden="true" />
            {start.isPending ? "Starting…" : "Start backup"}
          </button>
        </>
      }
    >
      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <label htmlFor="run-scope">Run scope</label>
          <select
            id="run-scope"
            value={scope}
            onChange={(event) => setScope(event.target.value as ReplicationRunScope)}
          >
            {scopes.map((candidate) => (
              <option value={candidate} key={candidate}>
                {SCOPE_LABELS[candidate]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {scopes.length === 0 ? (
        <Callout tone="amber" title="No runnable scope">
          The full copy is short of safe space. Change its goal to partial coverage or connect a
          larger destination.
        </Callout>
      ) : null}
      {shortfall ? (
        <Callout tone="amber" title="Full copy does not fit">
          The full copy is short {formatCount(plan.fullCopy?.shortfallFiles ?? 0)} files. Only
          partial coverage can run until the destination has more space.
        </Callout>
      ) : null}
      <StartRunSummary plan={plan} scope={scope} />
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
