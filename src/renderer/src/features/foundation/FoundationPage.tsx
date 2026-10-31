import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, FolderCheck, Gauge, HardDrive, Info, RefreshCw } from "lucide-react";
import type { CatalogSummary, DriveInfo } from "@shared/contracts/drives";
import type { AppInfo } from "@shared/contracts/ipc";
import { DriveCard } from "./DriveCard";
import { api } from "../../lib/ipc-client";
import { queryKeys } from "../../lib/query-keys";
import styles from "./FoundationPage.module.css";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

function databaseValue(loading: boolean, database: AppInfo["database"] | undefined): string {
  if (loading) {
    return "Starting";
  }
  return database?.state === "ready" ? "Ready" : "Unavailable";
}

function databaseHint(database: AppInfo["database"] | undefined): string {
  if (database?.state === "ready") {
    return `Schema v${database.schemaVersion}`;
  }
  return database?.message ?? "Worker not ready";
}

function databaseClassName(database: AppInfo["database"] | undefined): string {
  return database?.state === "ready" ? (styles.good ?? "") : (styles.bad ?? "");
}

function StatusOverview({ appInfo, loading }: { appInfo: AppInfo | undefined; loading: boolean }) {
  const database = appInfo?.database;

  return (
    <section className={styles.statusGrid} aria-label="Application status">
      <article className={styles.statusCard}>
        <Database size={17} aria-hidden="true" />
        <span className={styles.statusLabel}>Database</span>
        <strong className={databaseClassName(database)}>{databaseValue(loading, database)}</strong>
        <span className={styles.statusHint}>{databaseHint(database)}</span>
      </article>
      <article className={styles.statusCard}>
        <HardDrive size={17} aria-hidden="true" />
        <span className={styles.statusLabel}>Runtime</span>
        <strong>{appInfo?.electronVersion ?? "—"}</strong>
        <span className={styles.statusHint}>Electron</span>
      </article>
      <article className={styles.statusCard}>
        <Gauge size={17} aria-hidden="true" />
        <span className={styles.statusLabel}>Build</span>
        <strong>{appInfo?.appVersion ?? "—"}</strong>
        <span className={styles.statusHint}>
          {appInfo?.isPackaged ? "Packaged" : "Development"}
        </span>
      </article>
      <article className={styles.statusCard}>
        <FolderCheck size={17} aria-hidden="true" />
        <span className={styles.statusLabel}>Catalog</span>
        <strong>{database?.state === "ready" ? "app.db" : "—"}</strong>
        <span className={styles.statusHint}>Single writer worker</span>
      </article>
    </section>
  );
}

function PathCard({ appInfo }: { appInfo: AppInfo | undefined }) {
  return (
    <section className={styles.pathCard} aria-label="Application paths">
      <div>
        <span className={styles.statusLabel}>Application data</span>
        <code>{appInfo?.userDataPath ?? "Starting…"}</code>
      </div>
      <div>
        <span className={styles.statusLabel}>Logs</span>
        <code>{appInfo?.logPath ?? "Starting…"}</code>
      </div>
      <div>
        <span className={styles.statusLabel}>App catalog</span>
        <code>{appInfo?.database.appDbPath ?? "Starting…"}</code>
      </div>
    </section>
  );
}

interface DriveSectionProps {
  drives: DriveInfo[];
  loading: boolean;
  busy: boolean;
  error: string | null;
  onRefresh: () => void;
  onInitialize: (volumeId: DriveInfo["volumeId"]) => void;
  onOpen: (volumeId: DriveInfo["volumeId"]) => void;
}

function DriveSection({
  drives,
  loading,
  busy,
  error,
  onRefresh,
  onInitialize,
  onOpen,
}: DriveSectionProps) {
  return (
    <section className={styles.section} aria-labelledby="drives-heading">
      <div className={styles.sectionHead}>
        <div>
          <div className={styles.eyebrow}>Archive source</div>
          <h2 id="drives-heading">Detected drives</h2>
        </div>
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw size={14} aria-hidden="true" />
          Rescan
        </button>
      </div>

      {error !== null ? <p className={styles.error}>{error}</p> : null}

      {loading ? <p className={styles.muted}>Scanning Windows volumes…</p> : null}

      {!loading && drives.length === 0 && error === null ? (
        <div className={styles.empty}>
          <HardDrive size={22} aria-hidden="true" />
          <h3>No external drive detected</h3>
          <p>
            Connect an external drive and rescan. For development, start the app with
            <code> MEMORY_LANE_DEV_DRIVE </code>
            pointing at a folder.
          </p>
        </div>
      ) : null}

      <div className={styles.driveList}>
        {drives.map((drive) => (
          <DriveCard
            key={drive.volumeId}
            drive={drive}
            busy={busy}
            onInitialize={onInitialize}
            onOpen={onOpen}
          />
        ))}
      </div>
    </section>
  );
}

function CatalogSummaryCard({ summary }: { summary: CatalogSummary }) {
  return (
    <section className={styles.catalogCard} aria-live="polite">
      <div className={styles.catalogIcon}>
        <FolderCheck size={20} aria-hidden="true" />
      </div>
      <div>
        <div className={styles.eyebrow}>Catalog ready</div>
        <h2>{summary.driveLabel}</h2>
        <p className={styles.muted}>
          Schema v{summary.schemaVersion} · {summary.fileCount.toLocaleString()} files
        </p>
        <code>{summary.catalogPath}</code>
      </div>
      <span className={styles.good}>Read-only</span>
    </section>
  );
}

export function FoundationPage() {
  const queryClient = useQueryClient();
  const [activeCatalog, setActiveCatalog] = useState<CatalogSummary | null>(null);

  const appInfoQuery = useQuery({ queryKey: queryKeys.appInfo, queryFn: api.getAppInfo });
  const drivesQuery = useQuery({ queryKey: queryKeys.drives, queryFn: api.listDrives });

  const initialize = useMutation({
    mutationFn: (volumeId: DriveInfo["volumeId"]) => api.initializeCatalog(volumeId),
    onSuccess: (summary) => {
      setActiveCatalog(summary);
      void queryClient.invalidateQueries({ queryKey: queryKeys.drives });
    },
  });

  const open = useMutation({
    mutationFn: (volumeId: DriveInfo["volumeId"]) => api.openCatalog(volumeId),
    onSuccess: (summary) => {
      setActiveCatalog(summary);
      void queryClient.invalidateQueries({ queryKey: queryKeys.drives });
    },
  });

  const actionError = initialize.error ?? open.error;
  const queryError = appInfoQuery.error ?? drivesQuery.error;
  const busy = initialize.isPending || open.isPending;

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <div className={styles.eyebrow}>Foundation · Phase 0</div>
          <h1>Your archive, indexed in place.</h1>
          <p>
            Memory Lane reads external drives and keeps its catalog beside the archive. No files are
            moved, renamed, edited, or deleted.
          </p>
        </div>
        <div className={styles.heroNote}>
          <Info size={17} aria-hidden="true" />
          <span>
            The scan pipeline arrives in Phase 1. This build proves drive identity, the database
            worker, and the secure IPC boundary end to end.
          </span>
        </div>
      </section>

      <StatusOverview appInfo={appInfoQuery.data} loading={appInfoQuery.isLoading} />
      <PathCard appInfo={appInfoQuery.data} />

      {queryError !== null ? <p className={styles.error}>{errorMessage(queryError)}</p> : null}
      {actionError !== null ? <p className={styles.error}>{errorMessage(actionError)}</p> : null}

      <DriveSection
        drives={drivesQuery.data ?? []}
        loading={drivesQuery.isLoading}
        busy={busy}
        error={drivesQuery.error !== null ? errorMessage(drivesQuery.error) : null}
        onRefresh={() => void drivesQuery.refetch()}
        onInitialize={(volumeId) => initialize.mutate(volumeId)}
        onOpen={(volumeId) => open.mutate(volumeId)}
      />

      {activeCatalog !== null ? <CatalogSummaryCard summary={activeCatalog} /> : null}

      <section className={styles.note}>
        <strong>Read-only boundary active.</strong> Catalog files live under
        <code> .memorylane </code>
        on the selected drive. Original folders are never written to.
      </section>
    </div>
  );
}
