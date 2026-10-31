import { CheckCircle2, Database, HardDriveDownload, Info, ScanLine, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { BackupResult, CacheClearResult, SettingsInfo } from "@shared/contracts/settings";
import { Alert, Callout } from "../../components/ui/Callout";
import { Modal } from "../../components/ui/Modal";
import { Pill } from "../../components/ui/Pill";
import { formatBytes, formatCount, formatDateTime } from "../../lib/format";
import { useClearCache, useRunBackup, useSettingsInfo } from "./use-settings";
import styles from "./SettingsPage.module.css";

function formatSize(bytes: number): string {
  return bytes === 0 ? "0 B" : formatBytes(bytes);
}

function SettingsCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <section className={styles.card}>
      <header className={styles.cardHead}>
        <span className={styles.cardIcon}>{icon}</span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function Detail({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}): React.JSX.Element {
  return (
    <div className={styles.detail}>
      <span>{label}</span>
      <strong className={mono ? styles.mono : undefined} title={value}>
        {value}
      </strong>
    </div>
  );
}

function CacheCard({
  info,
  clearing,
  result,
  error,
  onClear,
}: {
  info: SettingsInfo;
  clearing: boolean;
  result: CacheClearResult | undefined;
  error: unknown;
  onClear: () => void;
}): React.JSX.Element {
  return (
    <SettingsCard
      icon={<Trash2 size={17} aria-hidden="true" />}
      title="Generated cache"
      description="Thumbnails and previews can be regenerated from the originals at any time."
    >
      <div className={styles.details}>
        <Detail label="Cache location" value={info.cache.path} mono />
        <Detail label="Cache size" value={formatSize(info.cache.bytes)} />
        <Detail label="Cached files" value={formatCount(info.cache.files)} />
      </div>
      <div className={styles.actions}>
        <button className={styles.dangerButton} type="button" disabled={clearing} onClick={onClear}>
          <Trash2 size={14} aria-hidden="true" />
          Clear generated cache
        </button>
      </div>
      {result === undefined ? null : (
        <Callout
          tone="green"
          icon={<CheckCircle2 size={15} aria-hidden="true" />}
          title="Cache cleared"
          role="status"
        >
          Removed {formatCount(result.removedFiles)} generated files and freed{" "}
          {formatSize(result.freedBytes)}. The catalog and originals were not changed.
        </Callout>
      )}
      {error === null || error === undefined ? null : (
        <Alert>
          {error instanceof Error ? error.message : "The generated cache could not be cleared."}
        </Alert>
      )}
    </SettingsCard>
  );
}

function BackupCard({
  info,
  running,
  result,
  error,
  onBackup,
}: {
  info: SettingsInfo;
  running: boolean;
  result: BackupResult | undefined;
  error: unknown;
  onBackup: () => void;
}): React.JSX.Element {
  const status =
    info.backup.lastStatus === "success" ? (
      <Pill tone="green">Last backup succeeded</Pill>
    ) : info.backup.lastStatus === "failed" ? (
      <Pill tone="red">Last backup failed</Pill>
    ) : (
      <Pill tone="muted">No backup yet</Pill>
    );
  return (
    <SettingsCard
      icon={<HardDriveDownload size={17} aria-hidden="true" />}
      title="Catalog backups"
      description="Memory Lane safely copies both SQLite databases every 15 minutes while open and once when the app closes."
    >
      <div className={styles.statusRow}>{status}</div>
      <div className={styles.details}>
        <Detail label="Backup location" value={info.backup.path} mono />
        <Detail label="Last backup" value={formatDateTime(info.backup.lastBackupAt)} />
        <Detail
          label="Last backup size"
          value={
            info.backup.lastBytes === null ? "Not available" : formatSize(info.backup.lastBytes)
          }
        />
      </div>
      <div className={styles.actions}>
        <button
          className={styles.primaryButton}
          type="button"
          disabled={running}
          onClick={onBackup}
        >
          <HardDriveDownload size={14} aria-hidden="true" />
          Back up now
        </button>
        <span className={styles.hint}>
          Recovery is manual; no restore action changes the catalog.
        </span>
      </div>
      {result === undefined ? null : (
        <Callout
          tone="green"
          icon={<CheckCircle2 size={15} aria-hidden="true" />}
          title="Backup complete"
          role="status"
        >
          Saved {formatSize(result.bytes)} at {formatDateTime(result.createdAt)}.
        </Callout>
      )}
      {error === null || error === undefined ? null : (
        <Alert>
          {error instanceof Error ? error.message : "The backup could not be completed."}
        </Alert>
      )}
    </SettingsCard>
  );
}

function CatalogCard({ info }: { info: SettingsInfo }): React.JSX.Element {
  return (
    <SettingsCard
      icon={<Database size={17} aria-hidden="true" />}
      title="Catalog"
      description="The catalog stores paths, metadata, dates, hashes, and health information. Original files stay on the archive drive."
    >
      <div className={styles.details}>
        <Detail label="Catalog database" value={info.catalog.path} mono />
        <Detail label="Catalog size" value={formatSize(info.catalog.bytes)} />
      </div>
    </SettingsCard>
  );
}

function BackgroundCard(): React.JSX.Element {
  return (
    <SettingsCard
      icon={<ScanLine size={17} aria-hidden="true" />}
      title="Background processing"
      description="Scan pauses, resume, and intensity controls remain in one place."
    >
      <div className={styles.actions}>
        <Link className={styles.linkButton} to="/scan">
          <ScanLine size={14} aria-hidden="true" />
          Open scan &amp; processing
        </Link>
      </div>
    </SettingsCard>
  );
}

function AboutCard({ info }: { info: SettingsInfo }): React.JSX.Element {
  return (
    <SettingsCard
      icon={<Info size={17} aria-hidden="true" />}
      title="About Memory Lane"
      description="A local-first, read-only archive catalog for Windows."
    >
      <div className={styles.details}>
        <Detail label="App version" value={info.appVersion} />
        <Detail label="Electron" value={info.electronVersion} />
        <Detail label="Platform" value={info.platform} />
      </div>
      <div className={styles.statusRow}>
        <Pill tone="green">Offline by design</Pill>
        <span className={styles.hint}>
          No telemetry, accounts, or network services.{" "}
          {info.isPackaged ? "Packaged build" : "Development build"}.
        </span>
      </div>
    </SettingsCard>
  );
}

function ClearCacheDialog({
  pending,
  onConfirm,
  onClose,
}: {
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <Modal
      title="Clear generated cache?"
      description="Only thumbnails and previews are removed."
      onClose={onClose}
      footer={
        <>
          <button className={styles.secondaryButton} type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className={styles.dangerButton}
            type="button"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? "Clearing…" : "Clear cache"}
          </button>
        </>
      }
    >
      <p className={styles.dialogText}>
        Thumbnails and previews will be regenerated when needed. The catalog, original files, and
        date overrides are not affected.
      </p>
    </Modal>
  );
}

export function SettingsPage(): React.JSX.Element {
  const info = useSettingsInfo();
  const clear = useClearCache();
  const backup = useRunBackup();
  const [confirming, setConfirming] = useState(false);

  function confirmClear(): void {
    clear.mutate(undefined, { onSuccess: () => setConfirming(false) });
  }

  if (info.isLoading) {
    return <p className={styles.loading}>Loading settings…</p>;
  }
  if (info.isError || info.data === undefined) {
    return (
      <div className={styles.page}>
        <Alert>
          {info.error instanceof Error ? info.error.message : "Settings could not be loaded."}
        </Alert>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Settings</div>
          <h1>Storage and app details</h1>
          <p className={styles.summary}>
            Local-only controls for generated files, catalog backups, and background processing.
          </p>
        </div>
      </header>

      <div className={styles.grid}>
        <CacheCard
          info={info.data}
          clearing={clear.isPending}
          result={clear.data}
          error={clear.error}
          onClear={() => setConfirming(true)}
        />
        <CatalogCard info={info.data} />
        <BackupCard
          info={info.data}
          running={backup.isPending}
          result={backup.data}
          error={backup.error}
          onBackup={() => backup.mutate()}
        />
        <BackgroundCard />
        <AboutCard info={info.data} />
      </div>

      {confirming ? (
        <ClearCacheDialog
          pending={clear.isPending}
          onConfirm={confirmClear}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </div>
  );
}
