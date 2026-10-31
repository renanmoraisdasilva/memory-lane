import { FolderOpen, HardDrive, Lock, ShieldCheck, Usb } from "lucide-react";
import type { CatalogSummary } from "@shared/contracts/drives";
import { Callout } from "../../components/ui/Callout";
import { Modal } from "../../components/ui/Modal";
import { Pill } from "../../components/ui/Pill";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { formatBytes, formatCount, formatDateTime } from "../../lib/format";
import { FoundationDetails } from "../foundation/FoundationStatus";
import { driveLetterLabel, type DriveSelectionItem } from "../drives/types";
import type { ScanState } from "../scan/types";
import { useScanState } from "../scan/use-scan";
import styles from "./AppShell.module.css";

function capacityPercent(drive: DriveSelectionItem): number | null {
  if (drive.totalBytes <= 0) {
    return null;
  }
  return Math.min(100, Math.round(((drive.totalBytes - drive.freeBytes) / drive.totalBytes) * 100));
}

function drawerRecords(scan: ScanState | null | undefined, catalog: CatalogSummary): number {
  const stage = scan?.stages.find((candidate) => candidate.id === "catalog");
  return stage?.processed ?? catalog.fileCount;
}

function drawerLastScan(
  scan: ScanState | null | undefined,
  drive: DriveSelectionItem,
): string | null {
  return scan?.finishedAt ?? drive.lastScanAt;
}

function connectionLabel(drive: DriveSelectionItem): string {
  return drive.connection === "connected" ? "Connected" : "Not connected";
}

function connectionTone(drive: DriveSelectionItem): "green" | "muted" {
  return drive.connection === "connected" ? "green" : "muted";
}

function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className={styles.kv}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function DriveSummary({ drive }: { drive: DriveSelectionItem }): React.JSX.Element {
  return (
    <div className={styles.drawerDrive}>
      <span className={styles.drawerDriveIcon}>
        {drive.connection === "connected" ? (
          <HardDrive size={20} aria-hidden="true" />
        ) : (
          <Usb size={20} aria-hidden="true" />
        )}
      </span>
      <div className={styles.drawerDriveBody}>
        <strong>{drive.label}</strong>
        <span>
          {drive.serialNumber ?? "Serial unavailable"} · {drive.fileSystem}
        </span>
      </div>
      <Pill tone={connectionTone(drive)}>
        {drive.connection === "connected" ? "Healthy" : "Offline"}
      </Pill>
    </div>
  );
}

function IdentitySection({ drive }: { drive: DriveSelectionItem }): React.JSX.Element {
  return (
    <section className={styles.drawerSection} aria-labelledby="drawer-identity-title">
      <h3 id="drawer-identity-title" className={styles.drawerSectionLabel}>
        Identity
      </h3>
      <Row label="Label" value={drive.label} />
      <Row label="Volume ID" value={drive.volumeId} />
      <Row label="Serial" value={drive.serialNumber ?? "Unavailable"} />
      <Row label="Filesystem" value={drive.fileSystem} />
      <Row label="Assigned letter" value={driveLetterLabel(drive)} />
      <Row label="Connection" value={connectionLabel(drive)} />
    </section>
  );
}

function StorageSection({
  drive,
  percent,
}: {
  drive: DriveSelectionItem;
  percent: number | null;
}): React.JSX.Element {
  return (
    <section className={styles.drawerSection} aria-labelledby="drawer-storage-title">
      <h3 id="drawer-storage-title" className={styles.drawerSectionLabel}>
        Storage
      </h3>
      <div className={styles.capacityMeta}>
        <span>
          {formatBytes(drive.totalBytes - drive.freeBytes)} used · {formatBytes(drive.freeBytes)}{" "}
          free
        </span>
        <span>{percent === null ? "Unknown" : `${percent}%`}</span>
      </div>
      <ProgressBar
        processed={drive.totalBytes - drive.freeBytes}
        total={drive.totalBytes}
        label="Drive capacity used"
        tone="green"
      />
      <div className={styles.capacityTotal}>{formatBytes(drive.totalBytes)} total</div>
    </section>
  );
}

function CatalogSection({
  drive,
  catalog,
  records,
  lastScanAt,
}: {
  drive: DriveSelectionItem;
  catalog: CatalogSummary;
  records: number;
  lastScanAt: string | null;
}): React.JSX.Element {
  return (
    <section className={styles.drawerSection} aria-labelledby="drawer-catalog-title">
      <h3 id="drawer-catalog-title" className={styles.drawerSectionLabel}>
        Catalog
      </h3>
      <div className={styles.drawerPath}>{catalog.catalogPath}</div>
      <Row label="Status" value="Catalog open" />
      <Row label="Schema" value={`v${catalog.schemaVersion}`} />
      <Row label="Records" value={formatCount(records)} />
      <Row label="Last seen" value={formatDateTime(drive.lastSeenAt)} />
      <Row
        label="Last scan"
        value={lastScanAt === null ? "Not reported" : formatDateTime(lastScanAt)}
      />
    </section>
  );
}

function FoundationSection(): React.JSX.Element {
  return (
    <section className={styles.drawerSection} aria-labelledby="drawer-foundation-title">
      <h3 id="drawer-foundation-title" className={styles.drawerSectionLabel}>
        Local foundation
      </h3>
      <FoundationDetails />
    </section>
  );
}

export function DriveDrawer({
  drive,
  catalog,
  onClose,
  onSwitchDrive,
}: {
  drive: DriveSelectionItem;
  catalog: CatalogSummary;
  onClose: () => void;
  onSwitchDrive: () => void;
}): React.JSX.Element {
  const percent = capacityPercent(drive);
  const scan = useScanState(drive.volumeId);
  const records = drawerRecords(scan.data, catalog);
  const lastScanAt = drawerLastScan(scan.data, drive);

  return (
    <Modal
      drawer
      title={drive.label}
      description={`${driveLetterLabel(drive)} · ${drive.connection === "connected" ? "Connected and read-only" : "Not connected"}`}
      onClose={onClose}
      footer={
        <>
          <button className={styles.secondaryButton} type="button" onClick={onSwitchDrive}>
            Switch drive
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            disabled
            title="Explorer reveal arrives with the library screens in Phase 2."
          >
            <FolderOpen size={14} aria-hidden="true" />
            Reveal in Explorer
          </button>
        </>
      }
    >
      <DriveSummary drive={drive} />
      <IdentitySection drive={drive} />
      <StorageSection drive={drive} percent={percent} />
      <CatalogSection drive={drive} catalog={catalog} records={records} lastScanAt={lastScanAt} />
      <FoundationSection />
      <Callout
        tone="green"
        icon={<ShieldCheck size={17} aria-hidden="true" />}
        title="Read-only archive"
      >
        Memory Lane can open or reveal original files in later phases, but never moves, renames,
        edits, or deletes them.
      </Callout>
      <p className={styles.drawerHint}>
        <Lock size={13} aria-hidden="true" />
        Unmount, format, repair, and delete actions are deliberately absent. Explorer reveal is
        disabled in Phase 1 and will be wired with the library screens.
      </p>
    </Modal>
  );
}
