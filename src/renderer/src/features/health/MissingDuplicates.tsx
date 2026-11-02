import { AlertTriangle, ArrowRight, DatabaseBackup, Trash2 } from "lucide-react";
import { useState } from "react";
import type { MissingDuplicate, MissingDuplicatesPage } from "@shared/contracts/health";
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
        <span className={styles.filePath}>Last seen {formatDateTime(item.lastSeenAt)}</span>
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
            archive. These entries can be removed from the catalog without touching any drive.
          </p>
        </div>
        <span className={styles.countBadge}>{formatCount(data.total)}</span>
      </header>
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
  onConfirm: () => void;
}): React.JSX.Element {
  const entryWord = data.total === 1 ? "entry" : "entries";
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
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? <Spinner /> : <Trash2 size={14} aria-hidden="true" />}
            {pending ? "Removing…" : `Remove ${formatCount(data.total)} ${entryWord}`}
          </button>
        </>
      }
    >
      <p className={styles.tableNote}>
        <AlertTriangle size={13} aria-hidden="true" /> This changes only the catalog. It does not
        delete or move files on the source or backup drives. If a missing duplicate has verified
        backup copies, those coverage links will also be removed; the backup files remain on the
        drive.
      </p>
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
      {error === null || error === undefined ? null : (
        <p className={styles.error} role="alert">
          {error instanceof Error ? error.message : "The catalog entries could not be removed."}
        </p>
      )}
    </Modal>
  );
}

export function MissingDuplicates(): React.JSX.Element | null {
  const query = useHealthMissingDuplicates();
  const purge = usePurgeMissingDuplicates();
  const [open, setOpen] = useState(false);
  const [removed, setRemoved] = useState<number | null>(null);
  const data = query.data;
  const removedMessage =
    removed === null ? null : (
      <p className={styles.tableNote} role="status">
        Removed {formatCount(removed)} missing duplicate catalog{" "}
        {removed === 1 ? "entry" : "entries"}. No files on any drive were changed.
      </p>
    );

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

  function confirmPurge(): void {
    if (data === undefined) {
      return;
    }
    purge.mutate(
      { fileIds: data.candidateFileIds },
      {
        onSuccess: (result) => {
          setRemoved(result.removed);
          setOpen(false);
        },
      },
    );
  }

  return (
    <>
      {removedMessage}
      <MissingDuplicatesCard data={data} onReview={() => setOpen(true)} />
      {open ? (
        <MissingDuplicatesDialog
          data={data}
          pending={purge.isPending}
          error={purge.error}
          onClose={() => setOpen(false)}
          onConfirm={confirmPurge}
        />
      ) : null}
    </>
  );
}
