import type { DuplicateCleanupSummary } from "@shared/contracts/health";
import { formatBytes, formatCount } from "../../lib/format";
import { skippedSummary } from "./duplicate-cleanup-labels";
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
    <>
      <section className={styles.cleanupBar} aria-labelledby="cleanup-bar-title">
        <div>
          <h2 id="cleanup-bar-title">{formatCount(totalGroups)} duplicate groups</h2>
          <p>
            {formatCount(totalFiles)} files · {formatBytes(totalBytes)} in duplicate copies ·{" "}
            {formatBytes(totalExcessBytes)} excess
          </p>
          <p className={styles.cleanupBarHint}>
            One keeper per group. The rest move to quarantine. Nothing is deleted.
          </p>
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
      <div className={styles.cleanupRule}>
        <strong>Keep:</strong> oldest copy → older modified time → shallower and shorter path →
        shorter name. Groups without a verified keeper backup, with date overrides, hard links,
        empty files, or files under 1 KB are skipped.
      </div>
      {summary === undefined ? null : (
        <div className={styles.cleanupEligibility}>
          <span>
            {formatCount(summary.eligibleGroups)} eligible · {formatCount(summary.filesToMove)}{" "}
            files · {formatBytes(summary.bytesToMove)}
          </span>
          <span>
            {formatCount(summary.skippedGroups)} skipped
            {summary.skippedGroups > 0 ? `: ${skippedSummary(summary)}` : ""}
          </span>
        </div>
      )}
      {error === null || error === undefined ? null : (
        <p className={styles.error} role="alert">
          {error instanceof Error ? error.message : "Cleanup eligibility could not be loaded."}
        </p>
      )}
    </>
  );
}
