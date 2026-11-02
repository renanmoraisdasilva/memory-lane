import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  DatabaseBackup,
  FolderOpen,
  HardDriveDownload,
  LoaderCircle,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import type { DuplicateCleanupState, DuplicateCleanupSummary } from "@shared/contracts/health";
import { Callout, Spinner } from "../../components/ui/Callout";
import { Modal } from "../../components/ui/Modal";
import { formatBytes, formatCount } from "../../lib/format";
import { skippedSummary } from "./duplicate-cleanup-labels";
import styles from "./HealthPage.module.css";

function filesLabel(count: number): string {
  return `${formatCount(count)} ${count === 1 ? "file" : "files"}`;
}

function CleanupRuleCard(): React.JSX.Element {
  return (
    <div className={styles.cleanupRuleCard}>
      <strong>Keep one copy per group:</strong> oldest created file, then oldest modified, then
      shallower and shorter path, then shorter name.
    </div>
  );
}

export function CleanupConfirmDialog({
  summary,
  pending,
  error,
  onClose,
  onStart,
}: {
  summary: DuplicateCleanupSummary;
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onStart: () => void;
}): React.JSX.Element {
  const [acknowledged, setAcknowledged] = useState(false);
  return (
    <Modal
      title="Move duplicates to quarantine?"
      description="This is the only Memory Lane action that moves archive files. Nothing is deleted."
      onClose={onClose}
      dismissible={!pending}
      wide
      footer={
        <>
          <button
            className={styles.secondaryButton}
            type="button"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={styles.primaryButton}
            type="button"
            disabled={pending || !acknowledged || summary.filesToMove === 0}
            onClick={onStart}
          >
            {pending ? <Spinner /> : <HardDriveDownload size={14} aria-hidden="true" />}
            Move {filesLabel(summary.filesToMove)}
          </button>
        </>
      }
    >
      <div className={styles.cleanupSummaryLine}>
        <strong>{formatCount(summary.keepers)}</strong>{" "}
        {summary.keepers === 1 ? "keeper stays" : "keepers stay"} ·{" "}
        <strong>{filesLabel(summary.filesToMove)}</strong> move · about{" "}
        <strong>{formatBytes(summary.bytesToMove)}</strong>
      </div>
      <CleanupRuleCard />
      <div className={styles.cleanupPathBlock}>
        <span>Quarantine folder</span>
        <div className={styles.cleanupPathBox}>
          {summary.quarantineRoot}
          {"\\<new run folder>\\"}
        </div>
      </div>
      <div className={styles.cleanupWarning}>
        <AlertTriangle size={14} aria-hidden="true" />
        <div>
          <strong>{formatCount(summary.skippedGroups)} groups will be skipped.</strong>{" "}
          {skippedSummary(summary)}. The mover re-checks every file with full SHA-256 before it
          moves; changed or missing files are skipped.
        </div>
      </div>
      <label className={styles.cleanupAck}>
        <input
          type="checkbox"
          checked={acknowledged}
          disabled={pending}
          onChange={(event) => setAcknowledged(event.target.checked)}
        />
        <span>
          <strong>These files will be moved, not deleted.</strong> I understand the quarantine
          folder must be backed up and removed manually.
        </span>
      </label>
      {error === null || error === undefined ? null : (
        <p className={styles.error} role="alert">
          {error instanceof Error ? error.message : "The cleanup could not be started."}
        </p>
      )}
    </Modal>
  );
}

function percent(state: DuplicateCleanupState): number {
  if (state.filesTotal === 0) {
    return 0;
  }
  return Math.min(100, Math.round((state.filesMoved / state.filesTotal) * 100));
}

export function CleanupProgressDialog({
  state,
  cancelling,
  onCancel,
}: {
  state: DuplicateCleanupState;
  cancelling: boolean;
  onCancel: () => void;
}): React.JSX.Element {
  const done = percent(state);
  return (
    <Modal
      title="Moving duplicates to quarantine"
      description="Nothing is deleted. The journal records every move."
      onClose={() => undefined}
      dismissible={false}
      footer={
        <button
          className={styles.secondaryButton}
          type="button"
          disabled={cancelling || state.cancelRequested}
          onClick={onCancel}
        >
          {cancelling ? <Spinner /> : null}
          {state.cancelRequested ? "Cancelling after current file…" : "Cancel after current file"}
        </button>
      }
    >
      <div className={styles.cleanupProgressHead}>
        <span>
          <strong>{done}%</strong> · {formatCount(state.filesMoved)} of{" "}
          {filesLabel(state.filesTotal)}
        </span>
        <span>{formatBytes(state.bytesMoved)}</span>
      </div>
      <div className={styles.cleanupProgressTrack}>
        <span style={{ width: `${done}%` }} />
      </div>
      <div className={styles.cleanupCurrentPath}>
        {state.currentPath ?? "Preparing the quarantine folder…"}
      </div>
      <p className={styles.cleanupNote}>
        Same-volume rename. Every source path is written to the run journal before the next file.
      </p>
    </Modal>
  );
}

function completionTone(status: DuplicateCleanupState["status"]): {
  title: string;
  callout: "green" | "amber" | "red";
  icon: React.JSX.Element;
} {
  if (status === "cancelled") {
    return {
      title: "Cleanup cancelled",
      callout: "amber",
      icon: <AlertTriangle size={16} aria-hidden="true" />,
    };
  }
  if (status === "failed") {
    return {
      title: "Cleanup stopped",
      callout: "red",
      icon: <XCircle size={16} aria-hidden="true" />,
    };
  }
  return {
    title: "Cleanup complete",
    callout: "green",
    icon: <CheckCircle2 size={16} aria-hidden="true" />,
  };
}

function completionMessage(state: DuplicateCleanupState): string {
  if (state.status === "failed") {
    return state.errorMessage ?? "The cleanup stopped before every file was moved.";
  }
  if (state.status === "cancelled") {
    return "The current file finished, then the run stopped. Every completed move is recorded.";
  }
  return "The keepers are still in the archive. Nothing was permanently deleted.";
}

function CompletionNotes({ state }: { state: DuplicateCleanupState }): React.JSX.Element {
  return (
    <>
      {state.filesSkipped > 0 ? (
        <p className={styles.cleanupNote}>
          <ShieldCheck size={12} aria-hidden="true" /> {formatCount(state.filesSkipped)} files were
          skipped after a re-check or a move error.
        </p>
      ) : null}
      {state.groupsSkipped > 0 ? (
        <p className={styles.cleanupNote}>
          <DatabaseBackup size={12} aria-hidden="true" /> {formatCount(state.groupsSkipped)} groups
          were skipped.
        </p>
      ) : null}
      {state.filesMoved === 0 && state.status !== "failed" ? (
        <p className={styles.cleanupNote}>
          <LoaderCircle size={12} aria-hidden="true" /> No files moved. The archive did not change.
        </p>
      ) : null}
      <p className={styles.cleanupNote}>
        <ArrowRight size={12} aria-hidden="true" /> Cancel only stops after the current file. The
        journal maps every source path.
      </p>
    </>
  );
}

export function CleanupCompleteDialog({
  state,
  revealing,
  onClose,
  onReveal,
}: {
  state: DuplicateCleanupState;
  revealing: boolean;
  onClose: () => void;
  onReveal: () => void;
}): React.JSX.Element {
  const tone = completionTone(state.status);
  return (
    <Modal
      title={tone.title}
      description={`${filesLabel(state.filesMoved)} moved · ${formatBytes(state.bytesMoved)} · ${filesLabel(state.filesSkipped)} skipped`}
      onClose={onClose}
      wide
      footer={
        <>
          <button
            className={styles.secondaryButton}
            type="button"
            disabled={revealing || state.quarantinePath === null}
            onClick={onReveal}
          >
            {revealing ? <Spinner /> : <FolderOpen size={14} aria-hidden="true" />}
            Open folder
          </button>
          <button className={styles.primaryButton} type="button" onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      <Callout tone={tone.callout} icon={tone.icon} title={tone.title}>
        {completionMessage(state)}
      </Callout>
      {state.quarantinePath === null ? null : (
        <div className={styles.cleanupPathBlock}>
          <span>Quarantine folder</span>
          <div className={styles.cleanupPathBox}>{state.quarantinePath}</div>
        </div>
      )}
      <ol className={styles.cleanupNext}>
        <li>
          <strong>Back up</strong> the quarantine folder to your spare drive.
        </li>
        <li>
          <strong>Remove</strong> the quarantine folder from this drive.
        </li>
        <li>
          <strong>Run Scan again</strong> so the catalog reflects the final state.
        </li>
      </ol>
      <CompletionNotes state={state} />
    </Modal>
  );
}
