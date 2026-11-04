import { Link } from "react-router-dom";
import { HardDrive } from "lucide-react";
import type { DestinationDetail, DestinationSummary } from "@shared/contracts/replication/types";
import { Pill } from "../../components/ui/Pill";
import { formatCount, formatDateTime } from "../../lib/format";
import { connectionLabel, connectionTone, CoverageMap, formatSize, Stat } from "./components";
import styles from "./replication.module.css";

const FULL_THRESHOLD_BYTES = 64 * 1024 ** 2;

function goalShortLabel(goal: DestinationSummary["goal"]): string {
  return goal === "full_copy" ? "Full copy" : "Partial";
}

function percentOf(part: number, whole: number): number {
  return whole <= 0 ? 0 : Math.min(100, Math.max(0, (part / whole) * 100));
}

interface DestinationCoverageState {
  verifiedFiles: number;
  verifiedBytes: number;
  totalFiles: number;
  isEmpty: boolean;
  fullyVerified: boolean;
}

interface DestinationCapacityState {
  hasCapacity: boolean;
  isFull: boolean;
  isDone: boolean;
  usedPercent: number;
  reservePercent: number;
  safeLabel: string;
  freeLabel: string;
  freeTitle: string | undefined;
}

interface CoveragePresentation {
  mark: string;
  markClass: string | undefined;
  coverageClass: string | undefined;
  text: string;
}

function destinationCoverage(destination: DestinationSummary): DestinationCoverageState {
  const verifiedFiles = Math.max(
    0,
    destination.verifiedFiles - destination.attention.sourceMissingFiles,
  );
  const verifiedBytes = Math.max(
    0,
    destination.verifiedBytes - destination.attention.sourceMissingBytes,
  );
  const totalFiles = verifiedFiles + destination.unverifiedFiles;
  return {
    verifiedFiles,
    verifiedBytes,
    totalFiles,
    isEmpty: totalFiles === 0,
    fullyVerified: totalFiles > 0 && destination.unverifiedFiles === 0,
  };
}

function destinationCapacity(
  destination: DestinationSummary,
  fullyVerified: boolean,
): DestinationCapacityState {
  const hasCapacity = destination.totalBytes > 0;
  const isFull = hasCapacity && destination.availableBytes < FULL_THRESHOLD_BYTES;
  const usedPercent = percentOf(
    destination.totalBytes - destination.freeBytes,
    destination.totalBytes,
  );
  const reservePercent = Math.min(
    percentOf(destination.reserveBytes, destination.totalBytes),
    Math.max(0, 100 - usedPercent),
  );
  const safeLabel = !hasCapacity
    ? "Space unavailable"
    : isFull
      ? destination.availableBytes === 0
        ? "No safe space"
        : `${formatSize(destination.availableBytes)} safe`
      : `${formatSize(destination.availableBytes)} safe to add`;
  const freeLabel = !hasCapacity
    ? "—"
    : isFull
      ? `${formatSize(destination.reserveBytes)} reserve`
      : `${formatSize(destination.freeBytes)} free`;
  return {
    hasCapacity,
    isFull,
    isDone: isFull && fullyVerified,
    usedPercent,
    reservePercent,
    safeLabel,
    freeLabel,
    freeTitle: hasCapacity
      ? `Includes ${formatSize(destination.reserveBytes)} safety reserve`
      : undefined,
  };
}

function coveragePresentation(
  coverage: DestinationCoverageState,
  isDone: boolean,
): CoveragePresentation {
  if (coverage.isEmpty) {
    return {
      mark: "–",
      markClass: styles.stateMarkEmpty,
      coverageClass: styles.coverageEmpty,
      text: "No present source files",
    };
  }
  if (isDone) {
    return {
      mark: "✓",
      markClass: styles.stateMarkDone,
      coverageClass: styles.coverageDone,
      text: `${formatSize(coverage.verifiedBytes)} · ${formatCount(coverage.verifiedFiles)} source files verified`,
    };
  }
  if (!coverage.fullyVerified) {
    return {
      mark: "!",
      markClass: styles.stateMarkUnverified,
      coverageClass: styles.coverageUnverified,
      text: `${formatCount(coverage.verifiedFiles)} of ${formatCount(coverage.totalFiles)} source files verified`,
    };
  }
  return {
    mark: "✓",
    markClass: styles.stateMarkVerified,
    coverageClass: undefined,
    text: `${formatSize(coverage.verifiedBytes)} · ${formatCount(coverage.verifiedFiles)} source files verified`,
  };
}

function destinationMeta(
  destination: DestinationSummary,
  capacity: DestinationCapacityState,
  coverage: DestinationCoverageState,
): string {
  const goal = goalShortLabel(destination.goal);
  if (capacity.isDone) {
    return `${goal} · done`;
  }
  if (capacity.isFull && !coverage.fullyVerified) {
    return `${goal} · needs verification`;
  }
  return `${goal} · priority ${String(destination.priority + 1)}`;
}

function DestinationTop({
  destination,
  meta,
  presentation,
  isFull,
}: {
  destination: DestinationSummary;
  meta: string;
  presentation: CoveragePresentation;
  isFull: boolean;
}): React.JSX.Element {
  const letter = destination.letter === null ? "" : ` (${destination.letter})`;
  return (
    <div className={styles.destinationTop}>
      <div>
        <div className={styles.destinationTitle}>
          <h3 className={styles.destinationName}>
            {destination.label}
            {letter}
          </h3>
          <span className={`${styles.stateMark} ${presentation.markClass}`} aria-hidden="true">
            {presentation.mark}
          </span>
        </div>
        <p className={styles.destinationMeta}>{meta}</p>
      </div>
      <div className={styles.statusPills}>
        <Pill tone={connectionTone(destination.connection)}>
          {connectionLabel(destination.connection)}
        </Pill>
        {isFull ? <Pill>Full</Pill> : null}
      </div>
    </div>
  );
}

function DestinationSpace({ capacity }: { capacity: DestinationCapacityState }): React.JSX.Element {
  const usedLabel = capacity.hasCapacity ? `${String(Math.round(capacity.usedPercent))}%` : "—";
  return (
    <div className={styles.spaceBlock}>
      <div className={styles.spaceHead}>
        <span>Space used</span>
        <strong>{usedLabel}</strong>
      </div>
      <div
        className={styles.spaceTrack}
        role="img"
        aria-label={
          capacity.hasCapacity
            ? `${String(Math.round(capacity.usedPercent))} percent of the drive is used`
            : "Space unavailable"
        }
      >
        <span
          className={capacity.isFull ? styles.spaceUsedFull : styles.spaceUsed}
          style={{ width: `${String(capacity.usedPercent)}%` }}
        />
        {capacity.reservePercent > 0 ? (
          <span
            className={styles.spaceReserve}
            style={{ width: `${String(capacity.reservePercent)}%` }}
            aria-hidden="true"
          />
        ) : null}
      </div>
      <div className={styles.spaceFoot}>
        <span className={styles.spaceSafe}>{capacity.safeLabel}</span>
        <span className={styles.spaceFree} title={capacity.freeTitle}>
          {capacity.freeLabel}
        </span>
      </div>
    </div>
  );
}

function DestinationCoverage({
  presentation,
}: {
  presentation: CoveragePresentation;
}): React.JSX.Element {
  return (
    <div
      className={`${styles.coverageLine}${presentation.coverageClass === undefined ? "" : ` ${presentation.coverageClass}`}`}
    >
      <span className={styles.coverageCheck}>{presentation.mark}</span>
      {presentation.text}
    </div>
  );
}

export function DestinationCard({
  destination,
  href,
}: {
  destination: DestinationSummary;
  href: string;
}): React.JSX.Element {
  const coverage = destinationCoverage(destination);
  const capacity = destinationCapacity(destination, coverage.fullyVerified);
  const presentation = coveragePresentation(coverage, capacity.isDone);
  const meta = destinationMeta(destination, capacity, coverage);
  return (
    <Link
      className={`${styles.destinationCard}${capacity.isDone ? ` ${styles.destinationCardDone}` : ""}`}
      to={href}
    >
      <DestinationTop
        destination={destination}
        meta={meta}
        presentation={presentation}
        isFull={capacity.isFull}
      />
      <DestinationSpace capacity={capacity} />
      <DestinationCoverage presentation={presentation} />
    </Link>
  );
}

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
