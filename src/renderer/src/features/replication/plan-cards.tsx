import { Link } from "react-router-dom";
import { AlertTriangle, Info, ShieldCheck } from "lucide-react";
import type { ReplicationPlan } from "@shared/contracts/replication/types";
import { Callout } from "../../components/ui/Callout";
import { Pill } from "../../components/ui/Pill";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { formatCount } from "../../lib/format";
import { formatSize, goalLabel } from "./components";
import styles from "./replication.module.css";
export function WarningList({ plan }: { plan: ReplicationPlan }): React.JSX.Element | null {
  if (plan.warnings.length === 0) {
    return null;
  }
  return (
    <div className={styles.warningList}>
      {plan.warnings.map((warning) => (
        <Callout
          key={`${warning.code}-${warning.message}`}
          tone={
            warning.severity === "blocking"
              ? "red"
              : warning.severity === "warning"
                ? "amber"
                : "neutral"
          }
          icon={
            warning.severity === "info" ? (
              <Info size={15} aria-hidden="true" />
            ) : (
              <AlertTriangle size={15} aria-hidden="true" />
            )
          }
          title={
            warning.severity === "blocking"
              ? "Blocking"
              : warning.severity === "warning"
                ? "Warning"
                : "Note"
          }
        >
          {warning.message}
        </Callout>
      ))}
    </div>
  );
}

export function FullCopyCard({ plan }: { plan: ReplicationPlan }): React.JSX.Element | null {
  const job = plan.fullCopy;
  if (job === null) {
    return null;
  }
  return (
    <section className={styles.card}>
      <header className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <span className={styles.icon}>
            <ShieldCheck size={16} aria-hidden="true" />
          </span>
          <div>
            <h2>Full copy</h2>
            <p>Independent of the partial fill order. Every present source file is included.</p>
          </div>
        </div>
        <Pill tone={job.completeAfterRun ? "green" : "amber"}>
          {job.completeAfterRun ? "Fits" : "Shortfall"}
        </Pill>
      </header>
      <div className={styles.rowHead}>
        <div>
          <h3>{job.destination.label}</h3>
          <span className={styles.destinationMeta}>
            {goalLabel(job.destination.goal)} · {job.destination.mount ?? "Offline"}
          </span>
        </div>
        <Link
          className={styles.secondaryButton}
          to={`/backup/destinations/${job.destination.destinationId}`}
        >
          Open destination
        </Link>
      </div>
      <div className={styles.rowStats}>
        <div className={styles.rowStat}>
          <span>Source</span>
          <strong>{formatSize(job.sourceBytes)}</strong>
        </div>
        <div className={styles.rowStat}>
          <span>New</span>
          <strong>
            {formatCount(job.newFiles)} · {formatSize(job.newBytes)}
          </strong>
        </div>
        <div className={styles.rowStat}>
          <span>Shortfall</span>
          <strong>
            {formatCount(job.shortfallFiles)} · {formatSize(job.shortfallBytes)}
          </strong>
        </div>
        <div className={styles.rowStat}>
          <span>Free after</span>
          <strong>{formatSize(job.freeAfterBytes)}</strong>
        </div>
      </div>
    </section>
  );
}

export function PartialCard({ plan }: { plan: ReplicationPlan }): React.JSX.Element | null {
  const job = plan.partial;
  if (job === null) {
    return null;
  }
  return (
    <section className={styles.card}>
      <header className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <div>
            <h2>Partial coverage</h2>
            <p>
              Fills the first drive with the oldest uncovered files, then continues on the next.
            </p>
          </div>
        </div>
      </header>
      <div className={styles.candidateList}>
        {job.rows.map((row) => (
          <div className={styles.rowCard} key={row.destination.destinationId}>
            <div className={styles.rowHead}>
              <div>
                <h3>
                  {row.destination.label}
                  {row.destination.isFirstInFillOrder ? " — fills first" : " — fills next"}
                </h3>
                <span className={styles.destinationMeta}>
                  Priority {String(row.destination.priority + 1)}
                  {row.offline ? " · waiting for reconnect" : ""}
                </span>
              </div>
              <Link
                className={styles.ghostButton}
                to={`/backup/destinations/${row.destination.destinationId}`}
              >
                Date map
              </Link>
            </div>
            <div className={styles.rowStats}>
              <div className={styles.rowStat}>
                <span>Adopted</span>
                <strong>
                  {formatCount(row.adoptedFiles)} · {formatSize(row.adoptedBytes)}
                </strong>
              </div>
              <div className={styles.rowStat}>
                <span>New in plan</span>
                <strong>
                  {formatCount(row.newFiles)} · {formatSize(row.newBytes)}
                </strong>
              </div>
              <div className={styles.rowStat}>
                <span>New range</span>
                <strong>
                  {row.newRangeStart === null ? "No dated files" : row.newRangeStart.slice(0, 10)}
                </strong>
              </div>
              <div className={styles.rowStat}>
                <span>Free after</span>
                <strong>{formatSize(row.freeAfterBytes)}</strong>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ProjectedCoverage({ plan }: { plan: ReplicationPlan }): React.JSX.Element {
  return (
    <section className={styles.card}>
      <header className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <div>
            <h2>Projected coverage</h2>
            <p>Scope labels stay explicit; full-copy overlap is intentional.</p>
          </div>
        </div>
      </header>
      {plan.coverage.fullCopyPercent === null ? null : (
        <div className={styles.progressBlock}>
          <div className={styles.progressLegend}>
            <span>Full copy after this run</span>
            <span>{plan.coverage.fullCopyPercent.toFixed(1)}%</span>
          </div>
          <ProgressBar
            processed={plan.coverage.fullCopyPercent}
            total={100}
            label="Projected full copy coverage"
            tone="green"
            thin
          />
        </div>
      )}
      <div className={styles.progressBlock}>
        <div className={styles.progressLegend}>
          <span>Partial drives only</span>
          <span>{plan.coverage.partialPercent.toFixed(1)}%</span>
        </div>
        <ProgressBar
          processed={plan.coverage.partialPercent}
          total={100}
          label="Projected partial coverage"
          tone="amber"
          thin
        />
      </div>
      {plan.coverage.hasFullCopy ? (
        <div className={styles.progressBlock}>
          <div className={styles.progressLegend}>
            <span>All destinations ? distinct files</span>
            <span>{plan.coverage.allDestinationPercent.toFixed(1)}%</span>
          </div>
          <ProgressBar
            processed={plan.coverage.allDestinationPercent}
            total={100}
            label="Projected all-destination coverage"
            tone="green"
            thin
          />
        </div>
      ) : null}
    </section>
  );
}

export function RemainderCard({ plan }: { plan: ReplicationPlan }): React.JSX.Element {
  return (
    <section className={styles.card}>
      <header className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <div>
            <h2>Remainder</h2>
            <p>Files that fit no active partial destination in this plan.</p>
          </div>
        </div>
      </header>
      <div className={styles.rowStats}>
        <div className={styles.rowStat}>
          <span>Files</span>
          <strong>{formatCount(plan.remainder.files)}</strong>
        </div>
        <div className={styles.rowStat}>
          <span>Bytes</span>
          <strong>{formatSize(plan.remainder.bytes)}</strong>
        </div>
        <div className={styles.rowStat}>
          <span>Starts</span>
          <strong>
            {plan.remainder.startDate === null ? "?" : plan.remainder.startDate.slice(0, 10)}
          </strong>
        </div>
        <div className={styles.rowStat}>
          <span>Scopes</span>
          <strong>{plan.executionScopes.join(", ")}</strong>
        </div>
      </div>
      <p className={styles.note}>
        The remainder is not an error. Add another destination later to extend the chain from the
        oldest uncovered file.
      </p>
    </section>
  );
}
