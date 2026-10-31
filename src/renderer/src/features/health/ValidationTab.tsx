import { CheckCircle2, Pause, Play, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { ValidationLevel, ValidationState } from "@shared/contracts/health";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { formatCount, formatDateTime } from "../../lib/format";
import {
  usePauseValidation,
  useResumeValidation,
  useStartValidation,
  useValidationState,
} from "./use-health";
import styles from "./HealthPage.module.css";

const LEVELS: ReadonlyArray<{ id: ValidationLevel; label: string; description: string }> = [
  {
    id: "existence",
    label: "Existence",
    description: "Confirm every cataloged path still exists.",
  },
  {
    id: "metadata",
    label: "Basic metadata",
    description: "Compare file size and modification time.",
  },
  {
    id: "hash",
    label: "Deep SHA-256 integrity",
    description: "Recompute hashes and update the catalog when content changed.",
  },
  {
    id: "metadataRefresh",
    label: "Metadata revalidation",
    description: "Re-extract metadata and dates while preserving manual overrides.",
  },
];

function levelLabel(level: ValidationLevel | null): string {
  return LEVELS.find((item) => item.id === level)?.label ?? "Preparing";
}

function LevelSelector({
  levels,
  disabled,
  onToggle,
}: {
  levels: Set<ValidationLevel>;
  disabled: boolean;
  onToggle: (level: ValidationLevel) => void;
}): React.JSX.Element {
  return (
    <div className={styles.levelGrid}>
      {LEVELS.map((level) => (
        <label className={styles.levelRow} key={level.id}>
          <input
            type="checkbox"
            aria-label={level.label}
            checked={levels.has(level.id)}
            disabled={disabled}
            onChange={() => onToggle(level.id)}
          />
          <span>
            <strong>{level.label}</strong>
            <small>{level.description}</small>
          </span>
        </label>
      ))}
    </div>
  );
}

function Report({ state }: { state: ValidationState }): React.JSX.Element | null {
  const report = state.report;
  if (report === null) {
    return null;
  }
  return (
    <div className={styles.report} role="status">
      <div>
        <span>Verified</span>
        <strong>{formatCount(report.verified)}</strong>
      </div>
      <div>
        <span>Missing</span>
        <strong>{formatCount(report.missing)}</strong>
      </div>
      <div>
        <span>Metadata changed</span>
        <strong>{formatCount(report.metadataChanged)}</strong>
      </div>
      <div>
        <span>Hash mismatches</span>
        <strong>{formatCount(report.hashMismatch)}</strong>
      </div>
      <div>
        <span>Metadata updated</span>
        <strong>{formatCount(report.metadataUpdated)}</strong>
      </div>
      <div>
        <span>Unreadable</span>
        <strong>{formatCount(report.unreadable)}</strong>
      </div>
      <p>
        Started {formatDateTime(report.startedAt)} · Finished {formatDateTime(report.finishedAt)}
      </p>
    </div>
  );
}

function ValidationActions({
  running,
  paused,
  busy,
  canRun,
  onRun,
  onPause,
  onResume,
}: {
  running: boolean;
  paused: boolean;
  busy: boolean;
  canRun: boolean;
  onRun: () => void;
  onPause: () => void;
  onResume: () => void;
}): React.JSX.Element {
  return (
    <div className={styles.actions}>
      <button
        className={styles.primaryButton}
        type="button"
        disabled={busy || running || paused || !canRun}
        onClick={onRun}
      >
        <Play size={14} aria-hidden="true" />
        Run validation
      </button>
      {running ? (
        <button className={styles.secondaryButton} type="button" disabled={busy} onClick={onPause}>
          <Pause size={14} aria-hidden="true" />
          Pause
        </button>
      ) : null}
      {paused ? (
        <button className={styles.secondaryButton} type="button" disabled={busy} onClick={onResume}>
          <Play size={14} aria-hidden="true" />
          Resume
        </button>
      ) : null}
    </div>
  );
}

function RunCard({ state }: { state: ValidationState }): React.JSX.Element {
  if (state.status === "idle") {
    return <p className={styles.muted}>No validation has run for this catalog yet.</p>;
  }
  const heading =
    state.status === "running"
      ? `Validating: ${levelLabel(state.currentLevel)}`
      : state.status === "paused"
        ? `Paused: ${levelLabel(state.currentLevel)}`
        : state.status === "complete"
          ? "Validation complete"
          : "Validation failed";
  return (
    <section className={styles.groupCard} aria-labelledby="validation-run-title">
      <header className={styles.groupHead}>
        <div>
          <h2 id="validation-run-title">{heading}</h2>
          <p>
            {formatCount(state.processed)} of {formatCount(state.total)} checks · started{" "}
            {formatDateTime(state.startedAt)}
          </p>
        </div>
        {state.status === "complete" ? (
          <CheckCircle2 className={styles.successIcon} size={20} aria-hidden="true" />
        ) : null}
      </header>
      <ProgressBar
        processed={state.processed}
        total={state.total}
        label="Validation progress"
        tone={state.status === "failed" ? "red" : "amber"}
      />
      {state.errorMessage === null ? null : (
        <p className={styles.error} role="alert">
          {state.errorMessage}
        </p>
      )}
      <Report state={state} />
    </section>
  );
}

export function ValidationTab(): React.JSX.Element {
  const validation = useValidationState();
  const start = useStartValidation();
  const pause = usePauseValidation();
  const resume = useResumeValidation();
  const [levels, setLevels] = useState<Set<ValidationLevel>>(
    new Set(LEVELS.map((level) => level.id)),
  );
  const state = validation.data;
  const running = state?.status === "running";
  const paused = state?.status === "paused";
  const busy = start.isPending || pause.isPending || resume.isPending;

  function toggle(level: ValidationLevel): void {
    setLevels((current) => {
      const next = new Set(current);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  }

  function run(): void {
    if (levels.size > 0) {
      start.mutate({ levels: [...levels] });
    }
  }

  return (
    <div className={styles.stack}>
      <section className={styles.groupCard} aria-labelledby="validation-levels-title">
        <header className={styles.groupHead}>
          <div>
            <h2 id="validation-levels-title">Validation levels</h2>
            <p>
              Validation runs across the whole catalog. Deep hashing can take a long time on a large
              archive.
            </p>
          </div>
          <ShieldCheck size={20} aria-hidden="true" />
        </header>
        <LevelSelector levels={levels} disabled={running || paused} onToggle={toggle} />
        <ValidationActions
          running={running}
          paused={paused}
          busy={busy}
          canRun={levels.size > 0}
          onRun={run}
          onPause={() => pause.mutate()}
          onResume={() => resume.mutate()}
        />
      </section>
      {state === undefined ? (
        <p className={styles.muted}>Loading validation state…</p>
      ) : (
        <RunCard state={state} />
      )}
    </div>
  );
}
