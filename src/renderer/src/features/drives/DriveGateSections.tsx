import { AlertTriangle, HardDrive, Image, RefreshCw, ShieldCheck, Verified } from "lucide-react";
import { Alert, Callout } from "../../components/ui/Callout";
import { EmptyState } from "../../components/ui/EmptyState";
import { Pill } from "../../components/ui/Pill";
import { FoundationSummary } from "../foundation/FoundationStatus";
import styles from "./DriveSelectionPage.module.css";

export function GateHeader(): React.JSX.Element {
  return (
    <header className={styles.gateHeader}>
      <div className={styles.brand}>
        <span className={styles.brandMark} aria-hidden="true">
          <Image size={20} />
        </span>
        <span>
          <span className={styles.brandName}>Memory Lane</span>
          <span className={styles.brandSub}>Local archive catalog</span>
        </span>
      </div>
      <Pill tone="green" icon={<ShieldCheck size={12} aria-hidden="true" />}>
        Read-only archive
      </Pill>
    </header>
  );
}

export function GateIntro(): React.JSX.Element {
  return (
    <div className={styles.intro}>
      <div className={styles.eyebrow}>Archive source</div>
      <h1>Open a memory archive</h1>
      <p>
        Select a connected external drive. Memory Lane indexes files in place, keeps the catalog on
        the drive, and never moves, renames, edits, or deletes originals.
      </p>
    </div>
  );
}

export function GateNotice({
  notice,
  error,
}: {
  notice: string | null;
  error: string | null;
}): React.JSX.Element {
  return (
    <>
      {notice === null ? null : (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      {error === null ? null : <Alert>{error}</Alert>}
    </>
  );
}

export function GatePromise(): React.JSX.Element {
  return (
    <Callout
      tone="green"
      icon={<Verified size={18} aria-hidden="true" />}
      title="The archive stays yours"
    >
      The catalog and thumbnail cache live in an app-managed .memorylane folder on the drive.
      Original folders are never modified, and there is no delete, move, or rename operation in the
      app.
    </Callout>
  );
}

export function GateFooter(): React.JSX.Element {
  return (
    <footer className={styles.gateFooter}>
      <span>
        External volumes only in this version. Drives are identified by volume ID, not by drive
        letter.
      </span>
      <FoundationSummary />
    </footer>
  );
}

export function DriveEmptyState({ onRescan }: { onRescan: () => void }): React.JSX.Element {
  return (
    <EmptyState
      icon={<HardDrive size={26} aria-hidden="true" />}
      title="No external drives detected"
      action={
        <button className={styles.secondaryButton} type="button" onClick={onRescan}>
          <RefreshCw size={14} aria-hidden="true" />
          Rescan drives
        </button>
      }
    >
      Connect an external drive, then rescan. Memory Lane never creates a catalog on the Windows
      system drive.
    </EmptyState>
  );
}

export function DriveListError({
  message,
  onRescan,
}: {
  message: string;
  onRescan: () => void;
}): React.JSX.Element {
  return (
    <Callout tone="red" title="Drives could not be listed" role="alert">
      <span>{message}</span>
      <button className={styles.inlineButton} type="button" onClick={onRescan}>
        Try again
      </button>
    </Callout>
  );
}

export function DrivesLoading(): React.JSX.Element {
  return (
    <div className={styles.loadingList} aria-live="polite">
      <div className={styles.skeleton} aria-hidden="true" />
      <div className={styles.skeleton} aria-hidden="true" />
      <p className={styles.muted}>Scanning Windows volumes and registered drives…</p>
    </div>
  );
}

export function UnsupportedDriveCallout(): React.JSX.Element {
  return (
    <div className={styles.unsupportedCallout}>
      <Callout
        tone="amber"
        title="No supported external drive is connected"
        icon={<AlertTriangle size={17} aria-hidden="true" />}
      >
        Connect an external volume and rescan. Offline drives keep their catalogs, but they must be
        reconnected before they can be opened.
      </Callout>
    </div>
  );
}
