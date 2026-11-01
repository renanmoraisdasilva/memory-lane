import { HardDrive } from "lucide-react";
import type { DestinationDetail } from "@shared/contracts/replication/types";
import { formatCount, formatDateTime } from "../../lib/format";
import { CoverageMap, Stat, formatSize } from "./components";
import styles from "./replication.module.css";

export function DestinationCoverageCard({
  detail,
}: {
  detail: DestinationDetail;
}): React.JSX.Element {
  return (
    <section className={styles.card}>
      <header className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <span className={styles.icon}>
            <HardDrive size={16} aria-hidden="true" />
          </span>
          <div>
            <h2>Coverage map</h2>
            <p>Verified source files on this drive, by month.</p>
          </div>
        </div>
      </header>
      <CoverageMap cells={detail.coverageMap} />
      <div className={styles.statGrid}>
        <Stat
          label="Source index"
          value={
            detail.sourceIndexUpdatedAt === null
              ? "Not written"
              : formatDateTime(detail.sourceIndexUpdatedAt)
          }
        />
        <Stat label="Last verified" value={formatDateTime(detail.lastVerifiedAt)} />
        <Stat label="Last seen" value={formatDateTime(detail.lastSeenAt)} />
      </div>
    </section>
  );
}

export function DestinationAttentionCard({
  detail,
}: {
  detail: DestinationDetail;
}): React.JSX.Element {
  return (
    <section className={styles.card}>
      <header className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <div>
            <h2>Attention</h2>
            <p>These files stay visible without changing source coverage.</p>
          </div>
        </div>
      </header>
      <div className={styles.statGrid}>
        <Stat label="Only on this drive" value={formatCount(detail.attention.onlyOnDriveFiles)} />
        <Stat label="Only on drive bytes" value={formatSize(detail.attention.onlyOnDriveBytes)} />
        <Stat
          label="Source missing copies"
          value={formatCount(detail.attention.sourceMissingFiles)}
        />
        <Stat
          label="Source missing bytes"
          value={formatSize(detail.attention.sourceMissingBytes)}
        />
        <Stat label="Conflicts" value={formatCount(detail.conflictFiles)} />
        <Stat label="Unreadable" value={formatCount(detail.adoption?.unreadableFiles ?? 0)} />
      </div>
      <p className={styles.note}>
        Restore-to-source is not part of this release. A source-missing verified copy can only be
        revealed or opened in a later update.
      </p>
    </section>
  );
}
