import { AlertTriangle, CheckCircle2, RotateCcw, ShieldCheck } from "lucide-react";
import type { PromotionOldSourceFate, PromotionState } from "@shared/contracts/replication/types";
import { Alert, Callout } from "../../components/ui/Callout";
import { Pill } from "../../components/ui/Pill";
import { Select } from "../../components/ui/Select";
import { formatCount } from "../../lib/format";
import { formatSize } from "./components";
import styles from "./replication.module.css";

export const PROMOTION_STEPS = ["Verify", "Review extras", "Choose fates", "Confirm"];

export function PromotionCountsGrid({ state }: { state: PromotionState }): React.JSX.Element {
  return (
    <div className={styles.statGrid}>
      <div className={styles.stat}>
        <span>Source files</span>
        <strong>{formatCount(state.counts.sourceFiles)}</strong>
      </div>
      <div className={styles.stat}>
        <span>Verified on full copy</span>
        <strong>
          {formatCount(state.counts.verifiedFiles)} · {formatSize(state.counts.verifiedBytes)}
        </strong>
      </div>
      <div className={styles.stat}>
        <span>Shortfall</span>
        <strong>{formatCount(state.counts.shortfallFiles)}</strong>
      </div>
      <div className={styles.stat}>
        <span>Stale / missing</span>
        <strong>
          {formatCount(state.counts.staleFiles)} / {formatCount(state.counts.missingFiles)}
        </strong>
      </div>
      <div className={styles.stat}>
        <span>Conflicts / failed</span>
        <strong>
          {formatCount(state.counts.conflictFiles)} / {formatCount(state.counts.failedFiles)}
        </strong>
      </div>
      <div className={styles.stat}>
        <span>Only on this drive</span>
        <strong>{formatCount(state.counts.destinationOnlyFiles)}</strong>
      </div>
    </div>
  );
}

export function PromotionStepBar({ step }: { step: number }): React.JSX.Element {
  return (
    <div className={styles.stepBar}>
      {PROMOTION_STEPS.map((label, index) => (
        <span
          className={`${styles.step}${index + 1 === step ? ` ${styles.stepActive}` : ""}`}
          key={label}
        >
          {index + 1}. {label}
        </span>
      ))}
    </div>
  );
}

export function PromotionVerifyStep({
  state,
  deep,
  setDeep,
  verify,
}: {
  state: PromotionState;
  deep: boolean;
  setDeep: (value: boolean) => void;
  verify: {
    isPending: boolean;
    error: Error | null;
    mutate: (params: { destinationId: string; deep: boolean }) => void;
  };
}): React.JSX.Element {
  return (
    <section className={styles.card}>
      <header className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <div>
            <h2>Verify the full copy</h2>
            <p>
              {state.destinationLabel} · {state.connected ? "Connected" : "Offline"} ·{" "}
              {state.identityConfirmed ? "Identity confirmed" : "Identity needs confirmation"}
            </p>
          </div>
        </div>
        {state.verified ? (
          <Pill tone="green">Verified</Pill>
        ) : (
          <Pill tone="muted">Not verified</Pill>
        )}
      </header>
      <PromotionCountsGrid state={state} />
      <label className={styles.checkboxRow}>
        <input type="checkbox" checked={deep} onChange={(event) => setDeep(event.target.checked)} />
        Deep verification: hash every destination file instead of trusting size and modified time.
      </label>
      {verify.error === null ? null : <Alert>{verify.error.message}</Alert>}
      <button
        className={styles.secondaryButton}
        type="button"
        disabled={verify.isPending}
        onClick={() => verify.mutate({ destinationId: state.destinationId, deep })}
      >
        <ShieldCheck size={14} aria-hidden="true" />
        {verify.isPending ? "Verifying…" : "Run verification"}
      </button>
      {state.blockedReason === null ? null : (
        <Callout tone="amber" icon={<AlertTriangle size={15} aria-hidden="true" />} title="Blocked">
          {state.blockedReason}
        </Callout>
      )}
    </section>
  );
}

export function PromotionExtrasStep({ state }: { state: PromotionState }): React.JSX.Element {
  return (
    <section className={styles.card}>
      <header className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <div>
            <h2>Review files that are not part of the source</h2>
            <p>They stay on the drive and remain visible in its local library.</p>
          </div>
        </div>
      </header>
      <div className={styles.statGrid}>
        <div className={styles.stat}>
          <span>Destination-only files</span>
          <strong>{formatCount(state.counts.destinationOnlyFiles)}</strong>
        </div>
        <div className={styles.stat}>
          <span>Destination-only bytes</span>
          <strong>{formatSize(state.counts.destinationOnlyBytes)}</strong>
        </div>
      </div>
      <Callout tone="green" title="Left out of the new source archive">
        Promotion never imports or deletes destination-only files. They are marked{" "}
        <code>local_only</code> in the new source catalog.
      </Callout>
    </section>
  );
}

export function PromotionFatesStep({
  state,
  oldFate,
  setOldFate,
  fates,
  setFates,
}: {
  state: PromotionState;
  oldFate: PromotionOldSourceFate;
  setOldFate: (value: PromotionOldSourceFate) => void;
  fates: Record<string, boolean>;
  setFates: (value: Record<string, boolean>) => void;
}): React.JSX.Element {
  return (
    <section className={styles.card}>
      <header className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <div>
            <h2>Choose the old roles</h2>
            <p>The files never move during promotion. Only catalog roles change.</p>
          </div>
        </div>
      </header>
      <div className={styles.field}>
        <label htmlFor="old-source-fate">Previous source · {state.oldSource.label}</label>
        <Select
          id="old-source-fate"
          value={oldFate}
          onChange={setOldFate}
          options={[
            { value: "full_copy", label: "Keep as a full-copy destination" },
            { value: "extend_coverage", label: "Keep as a partial destination" },
            { value: "retire", label: "Retire after promotion" },
          ]}
        />
        <span className={styles.fieldHint}>
          {state.oldSource.fitsFullCopy
            ? "The old drive still has room for a full copy."
            : "The old drive no longer fits the new source and becomes a partial destination."}
        </span>
      </div>
      {state.partialDestinations.length === 0 ? (
        <p className={styles.muted}>There are no partial destinations to keep or retire.</p>
      ) : (
        <div className={styles.candidateList}>
          {state.partialDestinations.map((destination) => (
            <label className={styles.checkboxRow} key={destination.destinationId}>
              <input
                type="checkbox"
                checked={fates[destination.destinationId] !== false}
                onChange={(event) =>
                  setFates({
                    ...fates,
                    [destination.destinationId]: event.target.checked,
                  })
                }
              />
              Keep {destination.label} as a partial destination
            </label>
          ))}
        </div>
      )}
    </section>
  );
}

export function PromotionConfirmStep({
  state,
  confirmed,
  setConfirmed,
  apply,
  onApply,
}: {
  state: PromotionState;
  confirmed: boolean;
  setConfirmed: (value: boolean) => void;
  apply: { isPending: boolean; error: Error | null };
  onApply: () => void;
}): React.JSX.Element {
  return (
    <section className={styles.card}>
      <header className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <div>
            <h2>Confirm promotion</h2>
            <p>
              {state.destinationLabel} becomes the active source. The old source becomes{" "}
              {state.oldSource.label}.
            </p>
          </div>
        </div>
      </header>
      <PromotionCountsGrid state={state} />
      <Callout tone="amber" title="One active source">
        Promotion is metadata-only. Rollback stays available only until the first change to the new
        source: a scan, date edit, validation, import, or backup.
      </Callout>
      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        I understand that this changes the active source archive.
      </label>
      {apply.error === null ? null : <Alert>{apply.error.message}</Alert>}
      <button
        className={styles.primaryButton}
        type="button"
        disabled={!confirmed || !state.canPromote || apply.isPending}
        onClick={onApply}
      >
        <CheckCircle2 size={14} aria-hidden="true" />
        {apply.isPending ? "Promoting…" : "Promote to source"}
      </button>
      {state.blockedReason === null ? null : <p className={styles.muted}>{state.blockedReason}</p>}
    </section>
  );
}

export function PromotionStepFooter({
  step,
  canAdvance,
  onBack,
  onNext,
}: {
  step: number;
  canAdvance: boolean;
  onBack: () => void;
  onNext: () => void;
}): React.JSX.Element {
  return (
    <div className={styles.footer}>
      <button
        className={styles.secondaryButton}
        type="button"
        disabled={step === 1}
        onClick={onBack}
      >
        Back
      </button>
      {step < 4 ? (
        <button
          className={styles.primaryButton}
          type="button"
          disabled={!canAdvance}
          onClick={onNext}
        >
          Next
        </button>
      ) : null}
    </div>
  );
}

export function PromotionResultCard({
  state,
  onOpenNew,
  onOpenPrevious,
  onRollback,
  rollback,
}: {
  state: PromotionState;
  onOpenNew: () => void;
  onOpenPrevious: () => void;
  onRollback: () => void;
  rollback: { isPending: boolean; error: Error | null };
}): React.JSX.Element {
  const completed = state.status === "completed";
  return (
    <section className={styles.card}>
      <header className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <span className={styles.icon}>
            <CheckCircle2 size={16} aria-hidden="true" />
          </span>
          <div>
            <h2>{completed ? "Promotion complete" : "Promotion rolled back"}</h2>
            <p>
              {completed
                ? `${state.destinationLabel} is now the active source. ${state.oldSource.label} is now a destination.`
                : `${state.oldSource.label} is the active source again. The full copy remains a destination.`}
            </p>
          </div>
        </div>
      </header>
      <button
        className={styles.primaryButton}
        type="button"
        onClick={completed ? onOpenNew : onOpenPrevious}
      >
        {completed ? "Open the new source" : "Open the previous source"}
      </button>
      {completed ? (
        <>
          <Callout tone="amber" title="Rollback window">
            Rollback is available only before the first change to the new source. A scan, date edit,
            validation, import, or backup closes it.
          </Callout>
          {rollback.error === null ? null : <Alert>{rollback.error.message}</Alert>}
          <button
            className={styles.secondaryButton}
            type="button"
            disabled={!state.canRollback || rollback.isPending}
            onClick={onRollback}
          >
            <RotateCcw size={14} aria-hidden="true" />
            {rollback.isPending ? "Rolling back…" : "Roll back promotion"}
          </button>
          {state.rollbackBlockedReason === null ? null : (
            <p className={styles.muted}>{state.rollbackBlockedReason}</p>
          )}
        </>
      ) : null}
    </section>
  );
}
