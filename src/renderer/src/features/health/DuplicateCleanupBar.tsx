import type { DuplicateCleanupSummary } from "@shared/contracts/health";
import { formatBytes, formatCount } from "../../lib/format";
import styles from "./HealthPage.module.css";

export function DuplicateCleanupBar({
  summary,
  error,
  totalGroups,
  totalFiles,
  totalBytes,
  totalExcessBytes,
  running,
  starting,
  onStart,
}: {
  summary: DuplicateCleanupSummary | undefined;
  error: unknown;
  totalGroups: number;
  totalFiles: number;
  totalBytes: number;
  totalExcessBytes: number;
  running: boolean;
  starting: boolean;
  onStart: () => void;
}): React.JSX.Element {
  const disabled = summary === undefined || summary.eligibleGroups === 0 || running || starting;
  return (
    <section className={styles.cleanupBar} aria-labelledby="cleanup-bar-title">
      <div>
        <h2 id="cleanup-bar-title">
          {formatCount(totalGroups)} duplicate groups · {formatCount(totalFiles)} files ·{" "}
          {formatBytes(totalBytes)} duplicate · {formatBytes(totalExcessBytes)} excess
        </h2>
        {summary === undefined ? null : (
          <p className={styles.cleanupBarMeta}>
            {formatCount(summary.eligibleGroups)} eligible · {formatCount(summary.skippedGroups)}{" "}
            skipped
            {summary.groupsWithoutCoverage > 0 ? (
              <span className={styles.cleanupBarWarning}>
                {" "}
                · {formatCount(summary.groupsWithoutCoverage)} without verified backup
              </span>
            ) : null}
          </p>
        )}
        {error === null || error === undefined ? null : (
          <p className={styles.error} role="alert">
            {error instanceof Error ? error.message : "Cleanup eligibility could not be loaded."}
          </p>
        )}
      </div>
      <div className={styles.cleanupBarActions}>
        <button
          className={styles.primaryButton}
          type="button"
          disabled={disabled}
          onClick={onStart}
        >
          {running ? "Cleanup running…" : "Move duplicates to quarantine"}
        </button>
      </div>
    </section>
  );
}
