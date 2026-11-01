import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Info, Plus, ShieldCheck } from "lucide-react";
import type { ReplicationPlan } from "@shared/contracts/replication/types";
import { Alert, Callout } from "../../components/ui/Callout";
import { EmptyState } from "../../components/ui/EmptyState";
import { Pill } from "../../components/ui/Pill";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { formatCount } from "../../lib/format";
import { AddDestinationDrawer } from "./AddDestinationDrawer";
import { formatSize, goalLabel, Stat } from "./components";
import { useReplicationPlan } from "./use-replication";
import styles from "./replication.module.css";

function WarningList({ plan }: { plan: ReplicationPlan }): React.JSX.Element | null {
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

function FullCopyCard({ plan }: { plan: ReplicationPlan }): React.JSX.Element | null {
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

function PartialCard({ plan }: { plan: ReplicationPlan }): React.JSX.Element | null {
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

function PlanHeader({ onAddDestination }: { onAddDestination: () => void }): React.JSX.Element {
  return (
    <header className={styles.header}>
      <div>
        <Link className={styles.ghostButton} to="/backup">
          <ArrowLeft size={14} aria-hidden="true" /> Backup
        </Link>
        <h1>Backup plan</h1>
        <p className={styles.summary}>
          The entire source archive is planned oldest-first; undated files come last. Existing files
          are never moved to make a cleaner split.
        </p>
      </div>
      <div className={styles.actions}>
        <button className={styles.secondaryButton} type="button" onClick={onAddDestination}>
          <Plus size={14} aria-hidden="true" /> Add destination
        </button>
        <button
          className={styles.primaryButton}
          type="button"
          disabled
          title="Copy execution arrives in the next replication slice."
        >
          Start backup
        </button>
      </div>
    </header>
  );
}

function ProjectedCoverage({ plan }: { plan: ReplicationPlan }): React.JSX.Element {
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
            <span>All destinations — distinct files</span>
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

function RemainderCard({ plan }: { plan: ReplicationPlan }): React.JSX.Element {
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
            {plan.remainder.startDate === null ? "—" : plan.remainder.startDate.slice(0, 10)}
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

export function ReplicationPlanPage(): React.JSX.Element {
  const plan = useReplicationPlan();
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  const noDestinations = data.fullCopy === null && data.partial === null;

  return (
    <div className={styles.page}>
      <PlanHeader onAddDestination={() => setDrawerOpen(true)} />
      <div className={styles.statGrid}>
        <Stat label="Source files" value={formatCount(data.sourceFiles)} />
        <Stat label="Source size" value={formatSize(data.sourceBytes)} />
        <Stat label="Undated files" value={formatCount(data.undatedFiles)} />
      </div>
      <WarningList plan={data} />
      {noDestinations ? (
        <EmptyState
          icon={<Plus size={22} aria-hidden="true" />}
          title="No backup plan yet"
          action={
            <button
              className={styles.primaryButton}
              type="button"
              onClick={() => setDrawerOpen(true)}
            >
              Add a destination
            </button>
          }
        >
          Add a dedicated destination drive to plan partial coverage or a complete full copy.
        </EmptyState>
      ) : (
        <>
          <FullCopyCard plan={data} />
          <PartialCard plan={data} />
          <div className={styles.grid}>
            <ProjectedCoverage plan={data} />
            <RemainderCard plan={data} />
          </div>
          <div className={styles.footer}>
            <span className={styles.muted}>
              Planning is read-only. Copy execution, pause/resume, and verification arrive in the
              next replication slice.
            </span>
            <span className={styles.muted}>Plan hash {data.planHash.slice(0, 12)}</span>
          </div>
        </>
      )}
      {drawerOpen ? (
        <AddDestinationDrawer
          onClose={() => setDrawerOpen(false)}
          onRegistered={() => setDrawerOpen(false)}
        />
      ) : null}
    </div>
  );
}
