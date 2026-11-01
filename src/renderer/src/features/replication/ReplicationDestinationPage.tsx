import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import type {
  AdoptionState,
  DestinationDetail,
  DestinationGoal,
} from "@shared/contracts/replication/types";
import { Alert, Callout } from "../../components/ui/Callout";
import { Pill } from "../../components/ui/Pill";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { formatCount, formatDuration } from "../../lib/format";
import { connectionLabel, connectionTone, formatSize, goalLabel, Stat } from "./components";
import { DestinationAttentionCard, DestinationCoverageCard } from "./destination-cards";
import {
  useAdoptionControl,
  useAdoptionState,
  useReplicationDestination,
  useRunState,
  useUpdateDestination,
} from "./use-replication";
import styles from "./replication.module.css";

function adoptionTone(status: AdoptionState["status"]): "green" | "amber" | "red" | "muted" {
  if (status === "complete") return "green";
  if (status === "failed") return "red";
  if (status === "paused" || status === "interrupted") return "amber";
  return "muted";
}

function adoptionLabel(status: AdoptionState["status"]): string {
  if (status === "scanning") return "Scanning drive";
  if (status === "hashing") return "Verifying hashes";
  if (status === "complete") return "Adoption complete";
  if (status === "paused") return "Paused";
  if (status === "interrupted") return "Interrupted";
  if (status === "failed") return "Adoption failed";
  return "Not adopted yet";
}

type AdoptionControls = ReturnType<typeof useAdoptionControl>;

function AdoptionProgress({ state }: { state: AdoptionState }): React.JSX.Element {
  const busy = state.status === "scanning" || state.status === "hashing";
  if (!busy && state.totalFiles === null) {
    return <></>;
  }
  return (
    <>
      <div className={styles.progressBlock}>
        <ProgressBar
          processed={state.scannedFiles}
          total={state.totalFiles ?? state.scannedFiles + 1}
          label="Adoption progress"
          tone="amber"
        />
        <div className={styles.progressLegend}>
          <span>
            {formatCount(state.scannedFiles)}
            {state.totalFiles === null ? "" : ` of ${formatCount(state.totalFiles)}`} files reviewed
          </span>
          <span>{formatDuration(state.etaSeconds)} left</span>
        </div>
      </div>
      {state.currentFile === null ? null : (
        <p className={styles.note}>Checking {state.currentFile}</p>
      )}
    </>
  );
}

function AdoptionActions({
  state,
  connected,
  controls,
}: {
  state: AdoptionState;
  connected: boolean;
  controls: AdoptionControls;
}): React.JSX.Element {
  const pending = controls.start.isPending || controls.pause.isPending || controls.resume.isPending;
  if (state.canPause) {
    return (
      <button
        className={styles.secondaryButton}
        type="button"
        disabled={pending}
        onClick={() => controls.pause.mutate()}
      >
        <Pause size={14} aria-hidden="true" /> Pause adoption
      </button>
    );
  }
  if (state.canResume) {
    return (
      <button
        className={styles.primaryButton}
        type="button"
        disabled={pending || !connected}
        onClick={() => controls.resume.mutate()}
      >
        <Play size={14} aria-hidden="true" /> Resume adoption
      </button>
    );
  }
  return (
    <button
      className={styles.primaryButton}
      type="button"
      disabled={pending || !connected}
      onClick={() => controls.start.mutate()}
    >
      <RefreshCw size={14} aria-hidden="true" />
      {state.status === "complete" ? "Re-adopt drive" : "Adopt existing files"}
    </button>
  );
}

function AdoptionCard({
  destinationId,
  connected,
  locked,
}: {
  destinationId: string;
  connected: boolean;
  locked: boolean;
}): React.JSX.Element {
  const adoption = useAdoptionState(destinationId);
  const controls = useAdoptionControl(destinationId);
  const state = adoption.data;
  if (state === undefined) {
    return (
      <section className={styles.card}>
        <p className={styles.loading}>Loading adoption state…</p>
      </section>
    );
  }
  const error = controls.start.error ?? controls.pause.error ?? controls.resume.error;
  return (
    <section className={styles.card}>
      <header className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <span className={styles.icon}>
            <RefreshCw size={16} aria-hidden="true" />
          </span>
          <div>
            <h2>Existing files</h2>
            <p>
              Adoption scans and verifies the drive without moving, renaming, or deleting files.
            </p>
          </div>
        </div>
        <Pill tone={adoptionTone(state.status)}>{adoptionLabel(state.status)}</Pill>
      </header>
      <AdoptionProgress state={state} />
      <div className={styles.statGrid}>
        <Stat label="Matched" value={formatCount(state.matchedFiles)} />
        <Stat label="Verified" value={formatCount(state.verifiedFiles)} />
        <Stat label="Only on this drive" value={formatCount(state.extraFiles)} />
        <Stat label="Conflicts" value={formatCount(state.conflictFiles)} />
        <Stat label="Stale" value={formatCount(state.staleFiles)} />
        <Stat label="Ambiguous" value={formatCount(state.ambiguousFiles)} />
      </div>
      {state.errorMessage === null ? null : <Alert>{state.errorMessage}</Alert>}
      {error === null ? null : <Alert>{error.message}</Alert>}
      <div className={styles.inlineActions}>
        <AdoptionActions state={state} connected={connected && !locked} controls={controls} />
        {connected ? null : (
          <span className={styles.muted}>Connect the drive to continue adoption.</span>
        )}
        {locked ? (
          <span className={styles.muted}>Pause the backup before starting adoption.</span>
        ) : null}
      </div>
    </section>
  );
}

function DestinationHeader({ detail }: { detail: DestinationDetail }): React.JSX.Element {
  return (
    <header className={styles.header}>
      <div>
        <Link className={styles.ghostButton} to="/backup">
          <ArrowLeft size={14} aria-hidden="true" /> Backup
        </Link>
        <h1>{detail.label}</h1>
        <p className={styles.summary}>
          {goalLabel(detail.goal)} · {detail.mount ?? "Drive not connected"} · {detail.fileSystem}
        </p>
      </div>
      <div className={styles.badges}>
        <Pill tone={connectionTone(detail.connection)}>{connectionLabel(detail.connection)}</Pill>
        <Pill tone={detail.goal === "full_copy" ? "blue" : "neutral"}>
          {goalLabel(detail.goal)}
        </Pill>
        {detail.isFirstInFillOrder ? <Pill tone="amber">Fills first</Pill> : null}
      </div>
    </header>
  );
}

function DestinationCallouts({ detail }: { detail: DestinationDetail }): React.JSX.Element {
  const health = detail.conflictFiles + detail.staleFiles + detail.missingFiles;
  return (
    <>
      {detail.connection === "offline" ? (
        <Callout
          tone="amber"
          icon={<AlertTriangle size={15} aria-hidden="true" />}
          title="This drive is offline"
        >
          Verified coverage shown below is last-known until the drive reconnects.
        </Callout>
      ) : null}
      {detail.promotionReady ? (
        <Callout
          tone="green"
          icon={<CheckCircle2 size={15} aria-hidden="true" />}
          title="Ready to become the source archive"
        >
          The full copy is complete and verified.{" "}
          <Link to={`/backup/promote/${detail.destinationId}`}>Review promotion</Link>
        </Callout>
      ) : null}
      {health === 0 ? null : (
        <Callout
          tone="amber"
          icon={<ShieldAlert size={15} aria-hidden="true" />}
          title="Replicas need review"
        >
          {formatCount(detail.conflictFiles)} conflicts, {formatCount(detail.staleFiles)} stale, and{" "}
          {formatCount(detail.missingFiles)} missing replicas. Conflicts are never overwritten
          automatically.
        </Callout>
      )}
    </>
  );
}

function allocationLabel(detail: DestinationDetail): string {
  if (detail.allocationMode === "all_safe") {
    return "Use all safe space";
  }
  if (detail.allocationMode === "percent") {
    return `${String(detail.allocationPercent ?? 0)}% of the drive`;
  }
  return formatSize(detail.allocationBytes ?? 0);
}

function DestinationSettingsCard({
  detail,
  locked,
}: {
  detail: DestinationDetail;
  locked: boolean;
}): React.JSX.Element {
  const update = useUpdateDestination();
  const [goal, setGoal] = useState<DestinationGoal>(detail.goal);
  return (
    <section className={styles.card}>
      <header className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <div>
            <h2>Destination settings</h2>
            <p>Changes apply to future plans. Verified files are never moved or recopied.</p>
          </div>
        </div>
      </header>
      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <label htmlFor="destination-goal-current">Goal</label>
          <select
            id="destination-goal-current"
            value={goal}
            disabled={update.isPending || locked}
            onChange={(event) => setGoal(event.target.value as DestinationGoal)}
          >
            <option value="extend_coverage">Partial coverage</option>
            <option value="full_copy">Full copy</option>
          </select>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Allocation</span>
          <span className={styles.fieldValue}>{allocationLabel(detail)}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Copies live under</span>
          <span className={styles.fieldValue}>
            {detail.copyRootRelative ?? "Mirror of source layout"}
          </span>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Source index file</span>
          <span className={styles.fieldValue}>
            {detail.sourceIndexRelative ?? "Not written yet"}
          </span>
        </div>
      </div>
      {update.error === null ? null : <Alert>{update.error.message}</Alert>}
      <div className={styles.inlineActions}>
        <button
          className={styles.secondaryButton}
          type="button"
          disabled={update.isPending || locked || goal === detail.goal}
          onClick={() => update.mutate({ destinationId: detail.destinationId, goal })}
        >
          Save goal
        </button>
      </div>
    </section>
  );
}

export function ReplicationDestinationPage(): React.JSX.Element {
  const { destinationId = "" } = useParams();
  const destination = useReplicationDestination(destinationId);
  const run = useRunState();
  const detail = destination.data;
  const locked = run.data?.status === "running" || run.data?.status === "stopping";

  if (destination.isPending) {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Loading destination…</p>
      </div>
    );
  }
  if (destination.error !== null || detail === undefined) {
    return (
      <div className={styles.page}>
        <Alert>This destination could not be loaded.</Alert>
        <Link className={styles.secondaryButton} to="/backup">
          <ArrowLeft size={14} aria-hidden="true" /> Back to backup
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <DestinationHeader detail={detail} />
      <DestinationCallouts detail={detail} />
      {locked ? (
        <Callout
          tone="amber"
          icon={<AlertTriangle size={15} aria-hidden="true" />}
          title="Backup is running"
        >
          Destination and adoption edits are locked until the backup runs or is paused.
        </Callout>
      ) : null}
      <div className={styles.statGrid}>
        <Stat label="Verified files" value={formatCount(detail.verifiedFiles)} />
        <Stat label="Verified bytes" value={formatSize(detail.verifiedBytes)} />
        <Stat label="Safe to add" value={formatSize(detail.availableBytes)} />
        <Stat label="Local library" value={`${formatCount(detail.localLibraryFiles)} files`} />
        <Stat label="Overlap" value={formatSize(detail.overlapBytes)} />
        <Stat label="Reserve" value={formatSize(detail.reserveBytes)} />
      </div>
      <div className={styles.grid}>
        <AdoptionCard
          destinationId={destinationId}
          connected={detail.connection === "connected"}
          locked={locked}
        />
        <DestinationCoverageCard detail={detail} />
      </div>
      <div className={styles.grid}>
        <DestinationSettingsCard detail={detail} locked={locked} />
        <DestinationAttentionCard detail={detail} />
      </div>
      <div className={styles.footer}>
        <Link className={styles.secondaryButton} to="/backup/plan">
          Review backup plan
        </Link>
        <span className={styles.muted}>
          Catalog {detail.localCatalogId ?? "not assigned"} · priority {String(detail.priority + 1)}
        </span>
      </div>
    </div>
  );
}
