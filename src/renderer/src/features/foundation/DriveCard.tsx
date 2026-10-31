import { AlertTriangle, CheckCircle2, FolderOpen, FolderPlus, HardDrive } from "lucide-react";
import type { DriveInfo } from "@shared/contracts/drives";
import { formatBytes } from "../../lib/format";
import styles from "./DriveCard.module.css";

interface DriveCardProps {
  drive: DriveInfo;
  busy: boolean;
  onInitialize: (volumeId: DriveInfo["volumeId"]) => void;
  onOpen: (volumeId: DriveInfo["volumeId"]) => void;
}

interface StatusMeta {
  label: string;
  className: string;
  ready: boolean;
}

function getStatusMeta(drive: DriveInfo): StatusMeta {
  if (drive.catalogStatus === "ready") {
    return { label: "Catalog ready", className: styles.statusReady ?? "", ready: true };
  }
  if (drive.catalogStatus === "registered") {
    return { label: "Catalog registered", className: styles.statusWarn ?? "", ready: false };
  }
  return { label: "No catalog", className: styles.statusMuted ?? "", ready: false };
}

function StatusPill({ drive }: { drive: DriveInfo }) {
  const meta = getStatusMeta(drive);
  return (
    <span className={`${styles.status} ${meta.className}`}>
      {meta.ready ? (
        <CheckCircle2 size={12} aria-hidden="true" />
      ) : (
        <AlertTriangle size={12} aria-hidden="true" />
      )}
      {meta.label}
    </span>
  );
}

interface DriveActionsProps {
  drive: DriveInfo;
  supported: boolean;
  busy: boolean;
  onInitialize: DriveCardProps["onInitialize"];
  onOpen: DriveCardProps["onOpen"];
}

function DriveActions({ drive, supported, busy, onInitialize, onOpen }: DriveActionsProps) {
  if (drive.catalogStatus === "ready") {
    return (
      <button
        className={styles.primaryButton}
        type="button"
        disabled={busy}
        onClick={() => onOpen(drive.volumeId)}
      >
        <FolderOpen size={15} aria-hidden="true" />
        Open catalog
      </button>
    );
  }

  if (supported && drive.catalogStatus === "none") {
    return (
      <button
        className={styles.primaryButton}
        type="button"
        disabled={busy}
        onClick={() => onInitialize(drive.volumeId)}
      >
        <FolderPlus size={15} aria-hidden="true" />
        Create catalog
      </button>
    );
  }

  return (
    <button className={styles.disabledButton} type="button" disabled>
      <AlertTriangle size={15} aria-hidden="true" />
      Unavailable
    </button>
  );
}

export function DriveCard({
  drive,
  busy,
  onInitialize,
  onOpen,
}: DriveCardProps): React.JSX.Element {
  const supported = drive.isExternal && drive.driveType !== "unknown";

  return (
    <article className={styles.card} aria-busy={busy}>
      <div className={styles.icon}>
        <HardDrive size={20} aria-hidden="true" />
      </div>

      <div className={styles.body}>
        <div className={styles.titleRow}>
          <h3 className={styles.title}>{drive.label}</h3>
          <StatusPill drive={drive} />
          {drive.driveType === "development" ? (
            <span className={styles.devPill}>Dev drive</span>
          ) : null}
        </div>

        <p className={styles.meta}>
          {drive.letter ?? "Folder"} · {drive.fileSystem}
          {drive.serialNumber ? ` · ${drive.serialNumber}` : ""}
        </p>

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
            <span className={styles.statValue}>{drive.isExternal ? "External" : "System"}</span>
            <span className={styles.statLabel}>Scope</span>
          </div>
        </div>

        {!supported ? (
          <p className={styles.warning}>
            Windows system drives are not supported. Select an external drive.
          </p>
        ) : null}

        {drive.catalogStatus === "registered" ? (
          <p className={styles.warning}>
            The catalog is registered, but its database file is not on this drive. Reconnect the
            correct drive.
          </p>
        ) : null}
      </div>

      <div className={styles.actions}>
        <DriveActions
          drive={drive}
          supported={supported}
          busy={busy}
          onInitialize={onInitialize}
          onOpen={onOpen}
        />
      </div>
    </article>
  );
}
