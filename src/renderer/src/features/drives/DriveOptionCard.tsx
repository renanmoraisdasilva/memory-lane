import {
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  FolderPlus,
  HardDrive,
  RefreshCw,
  Usb,
} from "lucide-react";
import { useId } from "react";
import { Pill } from "../../components/ui/Pill";
import { formatBytes, formatCount, formatDateTime } from "../../lib/format";
import {
  catalogStatusLabel,
  driveLetterLabel,
  isSupportedDrive,
  type DriveSelectionItem,
} from "./types";
import styles from "./DriveSelectionPage.module.css";

interface DriveActionProps {
  drive: DriveSelectionItem;
  busy: boolean;
  onOpen: (drive: DriveSelectionItem) => void;
  onSetup: (drive: DriveSelectionItem) => void;
  onReviewLetter: (drive: DriveSelectionItem) => void;
}

function unsupportedActionReason(drive: DriveSelectionItem): string {
  if (drive.isExternal) {
    return "This volume type is not supported. Choose a removable or external drive.";
  }
  return "Windows system drives cannot be cataloged. Choose an external volume instead.";
}

function unsupportedWarning(drive: DriveSelectionItem): string {
  if (drive.isExternal) {
    return "This volume type is not supported. Memory Lane can only catalog removable or external volumes.";
  }
  return "Windows system drive. Memory Lane only catalogs external volumes, so this drive cannot be opened or set up.";
}

function DriveAction({
  drive,
  busy,
  onOpen,
  onSetup,
  onReviewLetter,
}: DriveActionProps): React.JSX.Element {
  if (drive.connection === "offline") {
    return (
      <>
        <button className={styles.disabledButton} type="button" disabled>
          <Usb size={14} aria-hidden="true" />
          Reconnect to browse
        </button>
        <p className={styles.actionReason}>
          Connect this drive, then choose Rescan drives. The catalog was not removed.
        </p>
      </>
    );
  }

  if (!isSupportedDrive(drive)) {
    return (
      <>
        <button className={styles.disabledButton} type="button" disabled>
          <AlertTriangle size={14} aria-hidden="true" />
          Not supported
        </button>
        <p className={styles.actionReason}>{unsupportedActionReason(drive)}</p>
      </>
    );
  }

  if (drive.pendingLetterChange !== null) {
    return (
      <button
        className={styles.primaryButton}
        type="button"
        disabled={busy}
        onClick={() => onReviewLetter(drive)}
      >
        <RefreshCw size={14} aria-hidden="true" />
        Review new letter
      </button>
    );
  }

  if (drive.catalogStatus === "ready") {
    return (
      <button
        className={styles.primaryButton}
        type="button"
        disabled={busy}
        aria-label={`Open Memory Lane on ${drive.label}`}
        onClick={() => onOpen(drive)}
      >
        <FolderOpen size={14} aria-hidden="true" />
        {busy ? "Opening…" : "Open existing catalog"}
      </button>
    );
  }

  return (
    <button
      className={styles.primaryButton}
      type="button"
      disabled={busy}
      aria-label={`Set up a new catalog on ${drive.label}`}
      onClick={() => onSetup(drive)}
    >
      <FolderPlus size={14} aria-hidden="true" />
      {busy ? "Preparing…" : "Set up this drive"}
    </button>
  );
}

function DriveStats({ drive }: { drive: DriveSelectionItem }): React.JSX.Element {
  return (
    <div className={styles.stats}>
      <div className={styles.stat}>
        <span className={styles.statValue}>{formatBytes(drive.totalBytes)}</span>
        <span className={styles.statLabel}>Capacity</span>
      </div>
      <div className={styles.stat}>
        <span className={styles.statValue}>{formatBytes(drive.freeBytes)}</span>
        <span className={styles.statLabel}>Free</span>
      </div>
      <div className={styles.stat}>
        <span className={styles.statValue}>
          {drive.lastScanAt === null ? "Not reported" : formatDateTime(drive.lastScanAt)}
        </span>
        <span className={styles.statLabel}>Last scan</span>
      </div>
      <div className={styles.stat}>
        <span className={styles.statValue}>
          {drive.indexedItemCount === null ? "Not reported" : formatCount(drive.indexedItemCount)}
        </span>
        <span className={styles.statLabel}>Indexed items</span>
      </div>
    </div>
  );
}

function DrivePills({ drive }: { drive: DriveSelectionItem }): React.JSX.Element {
  return (
    <>
      {drive.connection === "offline" ? (
        <Pill tone="muted" icon={<Usb size={11} aria-hidden="true" />}>
          Not connected
        </Pill>
      ) : (
        <Pill tone="green" icon={<CheckCircle2 size={11} aria-hidden="true" />}>
          Connected
        </Pill>
      )}
      <Pill tone={drive.catalogStatus === "ready" ? "green" : "muted"}>
        {catalogStatusLabel(drive)}
      </Pill>
      {drive.driveType === "development" ? <Pill tone="amber">Development folder</Pill> : null}
    </>
  );
}

function DriveWarnings({ drive }: { drive: DriveSelectionItem }): React.JSX.Element {
  return (
    <>
      {isSupportedDrive(drive) || drive.connection === "offline" ? null : (
        <p className={styles.warning}>{unsupportedWarning(drive)}</p>
      )}
      {drive.connection === "offline" ? (
        <p className={styles.warning}>
          Previously registered · last seen {formatDateTime(drive.lastSeenAt)}. Reconnect it to
          browse the preserved catalog.
        </p>
      ) : null}
      {drive.catalogStatus === "registered" && drive.connection === "connected" ? (
        <p className={styles.warning}>
          The app remembers this drive, but its catalog database is not at the current path. Set up
          a new catalog only if you no longer have the original.
        </p>
      ) : null}
      {drive.pendingLetterChange === null ? null : (
        <p className={styles.letterWarning}>
          <RefreshCw size={12} aria-hidden="true" />
          Windows mounted this volume as {drive.pendingLetterChange.newLetter} instead of{" "}
          {drive.pendingLetterChange.previousLetter}. Confirm the new catalog root before opening.
        </p>
      )}
    </>
  );
}

function cardClassFor(drive: DriveSelectionItem): string {
  const classes = [styles.driveCard];
  if (drive.catalogStatus === "ready" && drive.connection === "connected") {
    classes.push(styles.driveCardPrimary);
  }
  if (drive.connection === "offline") {
    classes.push(styles.driveCardOffline);
  }
  return classes.join(" ");
}

function driveTitle(drive: DriveSelectionItem): string {
  const letter = driveLetterLabel(drive);
  return drive.label.includes(`(${letter})`) ? drive.label : `${drive.label} (${letter})`;
}

export function DriveOptionCard({
  drive,
  busy,
  onOpen,
  onSetup,
  onReviewLetter,
}: DriveActionProps): React.JSX.Element {
  const headingId = useId();
  const supported = isSupportedDrive(drive);
  const offline = drive.connection === "offline";

  return (
    <article className={cardClassFor(drive)} aria-labelledby={headingId} aria-busy={busy}>
      <div className={styles.driveIcon}>
        {supported || offline ? (
          <HardDrive size={20} aria-hidden="true" />
        ) : (
          <AlertTriangle size={20} aria-hidden="true" />
        )}
      </div>

      <div className={styles.driveBody}>
        <div className={styles.titleRow}>
          <h3 id={headingId} className={styles.driveTitle}>
            {driveTitle(drive)}
          </h3>
          <DrivePills drive={drive} />
        </div>

        <p className={styles.driveMeta}>
          {driveLetterLabel(drive)} · {drive.fileSystem} ·{" "}
          {drive.serialNumber ?? "Serial unavailable"}
        </p>
        <p className={styles.driveVolumeId}>Volume ID {drive.volumeId}</p>

        <DriveStats drive={drive} />
        <DriveWarnings drive={drive} />
      </div>

      <div className={styles.actionColumn}>
        <DriveAction
          drive={drive}
          busy={busy}
          onOpen={onOpen}
          onSetup={onSetup}
          onReviewLetter={onReviewLetter}
        />
      </div>
    </article>
  );
}
