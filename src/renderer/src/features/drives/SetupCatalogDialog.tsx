import { Lock, Play, Radar } from "lucide-react";
import { Alert, Callout, Spinner } from "../../components/ui/Callout";
import { Modal } from "../../components/ui/Modal";
import { cachePathForRoot, catalogPathForRoot } from "../../lib/drive-paths";
import { driveLetterLabel, type DriveSelectionItem } from "./types";
import styles from "./DriveSelectionPage.module.css";

export function SetupCatalogDialog({
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
}): React.JSX.Element {
  return (
    <Modal
      title="Set up a new archive"
      description={`${drive.label} (${driveLetterLabel(drive)}) · No catalog found`}
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
            Cancel
          </button>
          <button
            className={styles.primaryButton}
            type="button"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? <Spinner /> : <Play size={14} aria-hidden="true" />}
            {pending ? "Starting first scan…" : "Start first scan"}
          </button>
        </>
      }
    >
      <div className={styles.field}>
        <span className={styles.fieldLabel}>Catalog location</span>
        <div className={styles.pathBox}>{catalogPathForRoot(drive.rootPath)}</div>
      </div>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>Thumbnail cache</span>
        <div className={styles.pathBox}>{cachePathForRoot(drive.rootPath)}</div>
      </div>

      <Callout
        tone="amber"
        icon={<Radar size={17} aria-hidden="true" />}
        title="The first scan starts on this drive"
      >
        Memory Lane catalogs every file type first, then extracts metadata, generates thumbnails,
        and calculates hashes as separate stages. You can pause or resume at any time.
      </Callout>

      <div className={styles.modalCallout}>
        <Callout
          tone="green"
          icon={<Lock size={17} aria-hidden="true" />}
          title="No archive changes"
        >
          Only the app-managed .memorylane folder is written. Original files and folders are opened
          read-only.
        </Callout>
      </div>

      {error === null ? null : <Alert>{error}</Alert>}
    </Modal>
  );
}
