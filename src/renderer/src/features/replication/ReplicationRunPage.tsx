import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Clock3, Pause, Play, RefreshCw, Square } from "lucide-react";
import type {
  ReplicationRunState,
  RunCapabilities,
  RunEvent,
} from "@shared/contracts/replication/types";
import { Alert, Callout } from "../../components/ui/Callout";
import { EmptyState } from "../../components/ui/EmptyState";
import { Pill } from "../../components/ui/Pill";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { formatCount, formatDateTime, formatDuration } from "../../lib/format";
import { formatSize } from "./components";
import { useRunControl, useRunEvents, useRunState } from "./use-replication";
import styles from "./replication.module.css";

function statusTone(
  status: ReplicationRunState["status"],
): "green" | "amber" | "red" | "blue" | "muted" {
  if (status === "completed") return "green";
  if (status === "failed") return "red";
  if (status === "running") return "blue";
  if (status === "paused" || status === "interrupted" || status === "stopping") return "amber";
  return "muted";
}

function statusLabel(status: ReplicationRunState["status"]): string {
  if (status === "running") return "Running";
  if (status === "paused") return "Paused";
  if (status === "stopping") return "Stopping";
  if (status === "completed") return "Completed";
  if (status === "stopped") return "Stopped";
  if (status === "failed") return "Failed";
  if (status === "interrupted") return "Interrupted";
  return "Planned";
}

function RunActions({
  capabilities,
  controls,
}: {
  capabilities: RunCapabilities;
  controls: ReturnType<typeof useRunControl>;
}): React.JSX.Element {
  const pending =
    controls.pause.isPending ||
    controls.resume.isPending ||
    controls.stop.isPending ||
    controls.replan.isPending;
  return (
    <div className={styles.actions}>
      {capabilities.canPause ? (
        <button
          className={styles.secondaryButton}
          type="button"
          disabled={pending}
          onClick={() => controls.pause.mutate()}
        >
          <Pause size={14} aria-hidden="true" /> Pause
        </button>
      ) : null}
      {capabilities.canResume ? (
        <button
          className={styles.primaryButton}
          type="button"
          disabled={pending}
          onClick={() => controls.resume.mutate()}
        >
          <Play size={14} aria-hidden="true" /> Resume backup
        </button>
      ) : null}
      {capabilities.canStop ? (
        <button
          className={styles.secondaryButton}
          type="button"
          disabled={pending}
          onClick={() => controls.stop.mutate()}
        >
          <Square size={13} aria-hidden="true" /> Stop
        </button>
      ) : null}
      {capabilities.canEditPlan ? (
        <button
          className={styles.ghostButton}
          type="button"
          disabled={pending}
          onClick={() => controls.replan.mutate()}
        >
          <RefreshCw size={14} aria-hidden="true" /> Refresh plan
        </button>
      ) : null}
    </div>
  );
}

function RunHeader({
  state,
  controls,
}: {
  state: ReplicationRunState;
  controls: ReturnType<typeof useRunControl>;
}): React.JSX.Element {
  return (
    <header className={styles.header}>
      <div>
        <Link className={styles.ghostButton} to="/backup">
          <ArrowLeft size={14} aria-hidden="true" /> Backup
        </Link>
        <h1>Backup run</h1>
        <p className={styles.summary}>
          Files are copied one at a time and verified by SHA-256 before they count as coverage.
        </p>
      </div>
      <div className={styles.badges}>
        <Pill tone={statusTone(state.status)}>{statusLabel(state.status)}</Pill>
        <Pill tone="neutral">{state.scope.replaceAll("_", " ")}</Pill>
        <RunActions capabilities={state.capabilities} controls={controls} />
      </div>
    </header>
  );
}

function RunProgress({ state }: { state: ReplicationRunState }): React.JSX.Element {
  return (
    <section className={styles.card}>
      <header className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <span className={styles.icon}>
            <Clock3 size={16} aria-hidden="true" />
          </span>
          <div>
            <h2>Progress</h2>
            <p>
              {formatCount(state.verifiedFiles)} of {formatCount(state.plannedFiles)} planned files
              verified.
            </p>
          </div>
        </div>
        <strong>{state.percent.toFixed(1)}%</strong>
      </header>
      <ProgressBar
        processed={state.verifiedBytes}
        total={state.plannedBytes}
        label="Backup run progress"
        tone={state.status === "failed" ? "red" : "green"}
      />
      <div className={styles.progressLegend}>
        <span>
          {formatSize(state.verifiedBytes)} of {formatSize(state.plannedBytes)}
        </span>
        <span>{formatDuration(state.etaSeconds)} remaining</span>
      </div>
      <div className={styles.statGrid}>
        <div className={styles.stat}>
          <span>Destination</span>
          <strong>{state.currentDestinationLabel ?? "None"}</strong>
        </div>
        <div className={styles.stat}>
          <span>Current file</span>
          <strong title={state.currentFile ?? undefined}>{state.currentFile ?? "Waiting"}</strong>
        </div>
        <div className={styles.stat}>
          <span>Speed</span>
          <strong>
            {state.speedBytesPerSecond === null
              ? "—"
              : `${formatSize(Math.round(state.speedBytesPerSecond))}/s`}
          </strong>
        </div>
        <div className={styles.stat}>
          <span>Failed</span>
          <strong>{formatCount(state.failedFiles)}</strong>
        </div>
        <div className={styles.stat}>
          <span>Stale</span>
          <strong>{formatCount(state.staleFiles)}</strong>
        </div>
        <div className={styles.stat}>
          <span>Remainder</span>
          <strong>{formatCount(state.remainderFiles)}</strong>
        </div>
      </div>
    </section>
  );
}

function RunOrder({ state }: { state: ReplicationRunState }): React.JSX.Element {
  return (
    <section className={styles.card}>
      <header className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <div>
            <h2>Run order</h2>
            <p>Full copy runs first in a future slice; partial drives run in priority order.</p>
          </div>
        </div>
      </header>
      <div className={styles.candidateList}>
        {state.order.length === 0 ? (
          <p className={styles.muted}>No destinations are recorded for this run.</p>
        ) : (
          state.order.map((entry) => (
            <div className={styles.orderRow} key={entry.destinationId}>
              <div>
                <strong>{entry.label}</strong>
                <span>
                  {entry.kind === "full_copy" ? "Full copy" : "Partial"} ·{" "}
                  {formatCount(entry.plannedFiles)} files · {formatSize(entry.plannedBytes)}
                </span>
              </div>
              <Pill
                tone={
                  entry.state === "complete"
                    ? "green"
                    : entry.state === "active"
                      ? "blue"
                      : entry.state === "skipped" || entry.state === "offline"
                        ? "amber"
                        : "muted"
                }
              >
                {entry.state}
              </Pill>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function EventList({ events }: { events: RunEvent[] }): React.JSX.Element {
  return (
    <section className={styles.card}>
      <header className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <div>
            <h2>Activity</h2>
            <p>State changes only; file contents are never written to events.</p>
          </div>
        </div>
      </header>
      {events.length === 0 ? (
        <p className={styles.muted}>No events yet.</p>
      ) : (
        <div className={styles.eventList}>
          {[...events].reverse().map((event) => (
            <div className={styles.eventRow} key={event.id}>
              <span>{event.type.replaceAll("_", " ")}</span>
              <span>{formatDateTime(event.at)}</span>
              {event.note === null ? null : <span>{event.note}</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RunPageBody({
  state,
  controls,
  events,
}: {
  state: ReplicationRunState;
  controls: ReturnType<typeof useRunControl>;
  events: RunEvent[];
}): React.JSX.Element {
  const error = controls.pause.error ?? controls.resume.error ?? controls.stop.error;
  return (
    <div className={styles.page}>
      <RunHeader state={state} controls={controls} />
      {state.capabilities.lockedReason === null ? null : (
        <Callout
          tone={state.status === "failed" ? "red" : "amber"}
          icon={<AlertTriangle size={15} aria-hidden="true" />}
          title={statusLabel(state.status)}
        >
          {state.capabilities.lockedReason}
        </Callout>
      )}
      {state.errors.length === 0 ? null : (
        <div className={styles.warningList}>
          {state.errors.slice(-5).map((runError) => (
            <Callout
              key={`${runError.code}-${runError.message}`}
              tone="amber"
              icon={<AlertTriangle size={15} aria-hidden="true" />}
              title={runError.code.replaceAll("_", " ")}
            >
              {runError.message}
            </Callout>
          ))}
        </div>
      )}
      {error === null ? null : <Alert>{error.message}</Alert>}
      <RunProgress state={state} />
      <div className={styles.grid}>
        <RunOrder state={state} />
        <EventList events={events} />
      </div>
      <div className={styles.footer}>
        <Link className={styles.secondaryButton} to="/backup/plan">
          Review plan
        </Link>
        <span className={styles.muted}>
          Run #{state.id} · plan revision {state.planRevision}
        </span>
      </div>
    </div>
  );
}

export function ReplicationRunPage(): React.JSX.Element {
  const run = useRunState();
  const state = run.data ?? null;
  const events = useRunEvents(state?.id ?? null);
  const controls = useRunControl();

  if (run.isPending) {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Loading backup run…</p>
      </div>
    );
  }
  if (run.error !== null) {
    return (
      <div className={styles.page}>
        <Alert>Could not load the backup run.</Alert>
      </div>
    );
  }
  if (state === null) {
    return (
      <div className={styles.page}>
        <EmptyState
          icon={<Play size={22} aria-hidden="true" />}
          title="No backup run yet"
          action={
            <Link className={styles.primaryButton} to="/backup/plan">
              Review the plan
            </Link>
          }
        >
          Start a partial backup from the plan screen. Verified files survive pause, stop, and
          restart.
        </EmptyState>
      </div>
    );
  }
  return <RunPageBody state={state} controls={controls} events={events.data?.events ?? []} />;
}
