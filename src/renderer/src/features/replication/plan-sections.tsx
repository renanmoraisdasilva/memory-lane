import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Plus } from "lucide-react";
import type { ReplicationPlan, ReplicationRunState } from "@shared/contracts/replication/types";
import { Callout } from "../../components/ui/Callout";
import { EmptyState } from "../../components/ui/EmptyState";
import { formatCount } from "../../lib/format";
import { formatSize, Stat } from "./components";
import {
  FullCopyCard,
  PartialCard,
  ProjectedCoverage,
  RemainderCard,
  WarningList,
} from "./plan-cards";
import styles from "./replication.module.css";

export function PlanHeader({
  onAddDestination,
  onStart,
  onOpenRun,
  activeRun,
  canStart,
}: {
  onAddDestination: () => void;
  onStart: () => void;
  onOpenRun: () => void;
  activeRun: ReplicationRunState | null;
  canStart: boolean;
}): React.JSX.Element {
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
        {activeRun === null ? (
          <button
            className={styles.primaryButton}
            type="button"
            disabled={!canStart}
            title={
              canStart
                ? "Start the partial backup"
                : "Full copy execution is not available in this release slice."
            }
            onClick={onStart}
          >
            Start backup
          </button>
        ) : (
          <button className={styles.primaryButton} type="button" onClick={onOpenRun}>
            Open backup
          </button>
        )}
      </div>
    </header>
  );
}

export function PlanPageBody({
  plan,
  activeRun,
  onAddDestination,
  onStart,
  onOpenRun,
}: {
  plan: ReplicationPlan;
  activeRun: ReplicationRunState | null;
  onAddDestination: () => void;
  onStart: () => void;
  onOpenRun: () => void;
}): React.JSX.Element {
  return (
    <>
      <PlanHeader
        onAddDestination={onAddDestination}
        onStart={onStart}
        onOpenRun={onOpenRun}
        activeRun={activeRun}
        canStart={plan.canStart && plan.partial !== null}
      />
      <div className={styles.statGrid}>
        <Stat label="Source files" value={formatCount(plan.sourceFiles)} />
        <Stat label="Source size" value={formatSize(plan.sourceBytes)} />
        <Stat label="Undated files" value={formatCount(plan.undatedFiles)} />
      </div>
      {activeRun === null ? null : (
        <Callout
          tone="amber"
          icon={<AlertTriangle size={15} aria-hidden="true" />}
          title={`Backup ${activeRun.status}`}
        >
          Open the backup run to pause, resume, or stop it. Plan and destination edits are locked
          while it runs.
        </Callout>
      )}
      <WarningList plan={plan} />
      {plan.fullCopy === null && plan.partial === null ? (
        <EmptyState
          icon={<Plus size={22} aria-hidden="true" />}
          title="No backup plan yet"
          action={
            <button className={styles.primaryButton} type="button" onClick={onAddDestination}>
              Add a destination
            </button>
          }
        >
          Add a dedicated destination drive to plan partial coverage or a complete full copy.
        </EmptyState>
      ) : (
        <>
          <FullCopyCard plan={plan} />
          <PartialCard plan={plan} />
          <div className={styles.grid}>
            <ProjectedCoverage plan={plan} />
            <RemainderCard plan={plan} />
          </div>
          <div className={styles.footer}>
            <span className={styles.muted}>
              Planning is read-only. Copy execution, pause/resume, and verification are available
              for partial destinations.
            </span>
            <span className={styles.muted}>Plan hash {plan.planHash.slice(0, 12)}</span>
          </div>
        </>
      )}
    </>
  );
}
