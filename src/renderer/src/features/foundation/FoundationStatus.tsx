import { AlertTriangle, CheckCircle2, FolderCog, Info } from "lucide-react";
import { Pill } from "../../components/ui/Pill";
import { Spinner } from "../../components/ui/Callout";
import { useAppInfo } from "./use-app-info";
import styles from "./FoundationStatus.module.css";

export function FoundationSummary(): React.JSX.Element {
  const query = useAppInfo();

  if (query.isLoading) {
    return (
      <span className={styles.summary}>
        <Spinner />
        Checking the local app database…
      </span>
    );
  }

  if (query.isError || query.data === undefined) {
    return (
      <span className={styles.summary}>
        <AlertTriangle size={13} aria-hidden="true" />
        Local app status is unavailable
      </span>
    );
  }

  const { database } = query.data;
  const ready = database.state === "ready";
  return (
    <span className={styles.summary}>
      {ready ? (
        <CheckCircle2 size={13} aria-hidden="true" className={styles.good} />
      ) : (
        <AlertTriangle size={13} aria-hidden="true" className={styles.bad} />
      )}
      Local database {ready ? "ready" : "unavailable"} · schema v{database.schemaVersion} · v
      {query.data.appVersion}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className={styles.row}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function FoundationDetails(): React.JSX.Element {
  const query = useAppInfo();

  if (query.isLoading) {
    return (
      <p className={styles.loading}>
        <Spinner />
        Reading local app status…
      </p>
    );
  }

  if (query.isError || query.data === undefined) {
    return (
      <p className={styles.error}>
        <AlertTriangle size={14} aria-hidden="true" />
        Local app status is unavailable. Restart the application if this persists.
      </p>
    );
  }

  const info = query.data;
  const ready = info.database.state === "ready";

  return (
    <div className={styles.details}>
      <div className={styles.sectionLabel}>Foundation status</div>
      <div className={styles.statusRow}>
        <Pill
          tone={ready ? "green" : "red"}
          icon={ready ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
        >
          {ready ? "Database ready" : "Database error"}
        </Pill>
        {ready ? null : (
          <span className={styles.errorText}>
            {info.database.message ?? "The database worker is not ready."}
          </span>
        )}
      </div>
      <Row label="app.db schema" value={`v${info.database.schemaVersion}`} />
      <Row label="Application" value={`v${info.appVersion} · Electron ${info.electronVersion}`} />
      <Row label="Build" value={info.isPackaged ? "Packaged" : "Development"} />
      <Row label="App data" value={info.userDataPath} />
      <Row label="Database file" value={info.database.appDbPath} />
      <Row label="Logs" value={info.logPath} />
      <div className={styles.note}>
        <Info size={13} aria-hidden="true" />
        <span>Local only. Memory Lane sends no telemetry.</span>
      </div>
      <div className={styles.pathHint}>
        <FolderCog size={12} aria-hidden="true" />
        Catalog and cache folders stay inside each drive&apos;s app-managed .memorylane directory.
      </div>
    </div>
  );
}
