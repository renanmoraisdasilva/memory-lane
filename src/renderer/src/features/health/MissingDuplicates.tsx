import { AlertTriangle, ArrowRight, DatabaseBackup, Trash2 } from "lucide-react";
import { useState } from "react";
import type {
  MissingDuplicate,
  MissingDuplicatesPage,
  PurgeMissingDuplicatesResult,
} from "@shared/contracts/health";
import { Spinner } from "../../components/ui/Callout";
import { Modal } from "../../components/ui/Modal";
import { formatBytes, formatCount, formatDateTime } from "../../lib/format";
import { useHealthMissingDuplicates, usePurgeMissingDuplicates } from "./use-health";
import styles from "./HealthPage.module.css";

function DuplicateItem({ item }: { item: MissingDuplicate }): React.JSX.Element {
  return (
    <div className={styles.duplicateRow}>
      <span className={styles.fileCopy}>
        <span className={styles.fileName}>
          {item.name}
          {item.hasVerifiedReplicas ? (
            <DatabaseBackup size={12} aria-label="Has verified backup copies" />
          ) : null}
          {item.hasDateOverride ? (
            <AlertTriangle size={12} aria-label="Has an active date override" />
          ) : null}
        </span>
        <span className={styles.movedPaths}>
          <span>{item.path}</span>
          <ArrowRight size={12} aria-hidden="true" />
          <span>{item.duplicatePath}</span>
        </span>
        <span className={styles.filePath}>
          Last seen {formatDateTime(item.lastSeenAt)}
          {item.pendingMovedCandidates > 0 ? (
            <span className={styles.suggestionText}>
              {" · "}
              {formatCount(item.pendingMovedCandidates)} move{" "}
              {item.pendingMovedCandidates === 1 ? "suggestion" : "suggestions"}
            </span>
          ) : null}
        </span>
      </span>
      <span className={styles.fileSize}>{formatBytes(item.sizeBytes)}</span>
    </div>
  );
}

function MissingDuplicatesCard({
  data,
  onReview,
}: {
  data: MissingDuplicatesPage;
  onReview: () => void;
}): React.JSX.Element {
  const entryWord = data.total === 1 ? "entry" : "entries";
  const matchPhrase = data.total === 1 ? "exactly matches a file" : "exactly match files";
  return (
    <section className={styles.groupCard} aria-labelledby="missing-duplicates-title">
      <header className={styles.groupHead}>
        <div>
          <h2 id="missing-duplicates-title">Missing duplicates</h2>
          <p>
            {formatCount(data.total)} missing catalog {entryWord} {matchPhrase} still in the
            archive.
            {data.withPendingMoves > 0
              ? ` The scan also suggested ${formatCount(data.pendingMovedCandidates)} new ${data.pendingMovedCandidates === 1 ? "path" : "paths"} for ${formatCount(data.withPendingMoves)} of them.`
              : ""}
          </p>
        </div>
        <span className={styles.countBadge}>{formatCount(data.total)}</span>
      </header>
      {data.withPendingMoves > 0 ? (
        <p className={styles.tableNote}>
          <AlertTriangle size={13} aria-hidden="true" /> If the missing copies were duplicates
          deleted outside Memory Lane, remove them here instead of confirming the moves. This
          dismisses the suggestions and keeps the files at their current paths.
        </p>
      ) : null}
      {data.withVerifiedReplicas > 0 ? (
        <p className={styles.tableNote}>
          {formatCount(data.withVerifiedReplicas)}{" "}
          {data.withVerifiedReplicas === 1
            ? "has a verified backup copy"
            : "have verified backup copies"}
          . Removing those catalog entries also removes those coverage links; the files on the
          backup drives stay.
        </p>
      ) : null}
      {data.withDateOverride > 0 ? (
        <p className={styles.tableNote}>
          {formatCount(data.withDateOverride)}{" "}
          {data.withDateOverride === 1
            ? "has an active date override"
            : "have active date overrides"}
          . The override is lost with the missing catalog entries.
        </p>
      ) : null}
      <div className={styles.actions}>
        <button className={styles.primaryButton} type="button" onClick={onReview}>
          Review and clean up
        </button>
      </div>
    </section>
  );
}

function PendingMoveChoice({
  data,
  includePending,
  pending,
  onChange,
}: {
  data: MissingDuplicatesPage;
  includePending: boolean;
  pending: boolean;
  onChange: (value: boolean) => void;
}): React.JSX.Element {
  return (
    <>
      <p className={styles.tableNote}>
        <AlertTriangle size={13} aria-hidden="true" /> {formatCount(data.withPendingMoves)} of these
        entries have {formatCount(data.pendingMovedCandidates)} move suggestions. Removing them
        dismisses those suggestions. Only include them if the missing copies were duplicates deleted
        outside Memory Lane, not files you moved.
      </p>
      <label
        className={styles.levelRow}
        htmlFor="missing-duplicates-include-pending"
        aria-label="These missing copies were duplicates, not moved files"
      >
        <input
          id="missing-duplicates-include-pending"
          type="checkbox"
          checked={includePending}
          disabled={pending}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>
          <strong>These missing copies were duplicates, not moved files</strong>
          <small>
            Include {formatCount(data.withPendingMoves)}{" "}
            {data.withPendingMoves === 1 ? "entry" : "entries"} and dismiss{" "}
            {formatCount(data.pendingMovedCandidates)} move{" "}
            {data.pendingMovedCandidates === 1 ? "suggestion" : "suggestions"}.
          </small>
        </span>
      </label>
    </>
  );
}

function DuplicateList({ data }: { data: MissingDuplicatesPage }): React.JSX.Element {
  return (
    <>
      <div className={styles.movedList}>
        {data.items.map((item) => (
          <DuplicateItem item={item} key={item.fileId} />
        ))}
      </div>
      {data.total > data.items.length ? (
        <p className={styles.tableNote}>
          Showing the first {formatCount(data.items.length)} of {formatCount(data.total)}.
        </p>
      ) : null}
    </>
  );
}

function confirmLabel(selectedCount: number, dismissCount: number, pending: boolean): string {
  if (pending) {
    return "Removing…";
  }
  if (selectedCount === 0) {
    return "Select entries to remove";
  }
  return `Remove ${formatCount(selectedCount)} ${selectedCount === 1 ? "entry" : "entries"}${
    dismissCount > 0 ? ` and dismiss ${formatCount(dismissCount)} suggestions` : ""
  }`;
}

function MissingDuplicatesDialog({
  data,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  data: MissingDuplicatesPage;
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onConfirm: (includePendingMoves: boolean) => void;
}): React.JSX.Element {
  const [includePending, setIncludePending] = useState(false);
  const selectedCount = (includePending ? data.candidateFileIds : data.readyFileIds).length;
  const dismissCount = includePending ? data.pendingMovedCandidates : 0;

  return (
    <Modal
      title="Remove missing duplicates"
      description="These missing files are exact duplicates of files still in the archive."
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
            Keep as missing
          </button>
          <button
            className={styles.primaryButton}
            type="button"
            disabled={pending || selectedCount === 0}
            onClick={() => onConfirm(includePending)}
          >
            {pending ? <Spinner /> : <Trash2 size={14} aria-hidden="true" />}
            {confirmLabel(selectedCount, dismissCount, pending)}
          </button>
        </>
      }
    >
      <p className={styles.tableNote}>
        <AlertTriangle size={13} aria-hidden="true" /> This changes only the catalog. It does not
        delete or move files on the source or backup drives, including files in deduplicator trash
        folders. If a missing duplicate has verified backup copies, those coverage links will also
        be removed; the backup files remain on the drive.
      </p>
      {data.withPendingMoves > 0 ? (
        <PendingMoveChoice
          data={data}
          includePending={includePending}
          pending={pending}
          onChange={setIncludePending}
        />
      ) : null}
      <DuplicateList data={data} />
      {error === null || error === undefined ? null : (
        <p className={styles.error} role="alert">
          {error instanceof Error ? error.message : "The catalog entries could not be removed."}
        </p>
      )}
    </Modal>
  );
}

function RemovedMessage({
  result,
}: {
  result: PurgeMissingDuplicatesResult | null;
}): React.JSX.Element | null {
  if (result === null) {
    return null;
  }
  return (
    <p className={styles.tableNote} role="status">
      Removed {formatCount(result.removed)} missing duplicate catalog{" "}
      {result.removed === 1 ? "entry" : "entries"}
      {result.dismissedMovedCandidates > 0
        ? ` and dismissed ${formatCount(result.dismissedMovedCandidates)} move ${
            result.dismissedMovedCandidates === 1 ? "suggestion" : "suggestions"
          }`
        : ""}
      . No files on any drive were changed.
    </p>
  );
}

export function MissingDuplicates(): React.JSX.Element | null {
  const query = useHealthMissingDuplicates();
  const purge = usePurgeMissingDuplicates();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<PurgeMissingDuplicatesResult | null>(null);
  const data = query.data;
  const removedMessage = <RemovedMessage result={result} />;

  if (data === undefined) {
    if (query.error !== null && query.error !== undefined) {
      return (
        <p className={styles.error} role="alert">
          {query.error instanceof Error
            ? query.error.message
            : "Missing duplicates could not be loaded."}
        </p>
      );
    }
    return removedMessage;
  }
  if (data.total === 0) {
    return removedMessage;
  }

  const page = data;
  function confirmPurge(includePendingMoves: boolean): void {
    const fileIds = includePendingMoves ? page.candidateFileIds : page.readyFileIds;
    if (fileIds.length === 0) {
      return;
    }
    purge.mutate(
      { fileIds, includePendingMoves },
      {
        onSuccess: (purged) => {
          setResult(purged);
          setOpen(false);
        },
      },
    );
  }

  return (
    <>
      {removedMessage}
      <MissingDuplicatesCard data={page} onReview={() => setOpen(true)} />
      {open ? (
        <MissingDuplicatesDialog
          data={page}
          pending={purge.isPending}
          error={purge.error}
          onClose={() => setOpen(false)}
          onConfirm={confirmPurge}
        />
      ) : null}
    </>
  );
}
