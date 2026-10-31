import { Check, Fingerprint } from "lucide-react";
import { Alert, Callout } from "../../components/ui/Callout";
import { Modal } from "../../components/ui/Modal";
import type { DriveSelectionItem, PendingLetterChange } from "./types";
import styles from "./DriveSelectionPage.module.css";

function LetterFields({ change }: { change: PendingLetterChange }): React.JSX.Element {
  return (
    <>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>Previous catalog root</span>
        <div className={styles.pathBox}>{change.previousRootPath}</div>
      </div>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>New catalog root</span>
        <div className={styles.pathBox}>{change.newRootPath}</div>
      </div>
    </>
  );
}

export function ChangedLetterDialog({
  drive,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  drive: DriveSelectionItem;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}): React.JSX.Element | null {
  const change = drive.pendingLetterChange;
  if (change === null) {
    return null;
  }

  return (
    <Modal
      title="This drive has a new letter"
      description={`The catalog matches, but Windows mounted the volume as ${change.newLetter} instead of ${change.previousLetter}.`}
      onClose={onClose}
      dismissible={!pending}
      footer={
        <>
          <button
            className={styles.secondaryButton}
            type="button"
            disabled={pending}
            onClick={onClose}
          >
            Keep current path
          </button>
          <button
            className={styles.primaryButton}
            type="button"
            disabled={pending}
            onClick={onConfirm}
          >
            <Check size={14} aria-hidden="true" />
            {pending ? "Updating…" : `Update to ${change.newLetter}`}
          </button>
        </>
      }
    >
      <Callout
        tone="amber"
        icon={<Fingerprint size={17} aria-hidden="true" />}
        title={`Volume ID matches ${drive.volumeId}`}
      >
        Memory Lane recognizes the catalog by volume identity, not by drive letter. Updating the
        catalog root keeps all existing records, dates, duplicates, and missing-file state.
      </Callout>

      <div className={styles.letterFields}>
        <LetterFields change={change} />
      </div>

      <p className={styles.modalHint}>
        No files are moved. Only the catalog&apos;s recorded root path changes after confirmation.
      </p>

      {error === null ? null : <Alert>{error}</Alert>}
    </Modal>
  );
}
