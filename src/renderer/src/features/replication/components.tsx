import { Link } from "react-router-dom";
import { CircleDashed, HardDrive, ShieldCheck } from "lucide-react";
import type {
  CoverageMapCell,
  CoverageSummary,
  DestinationConnection,
  DestinationSummary,
} from "@shared/contracts/replication/types";
import { Pill, type PillTone } from "../../components/ui/Pill";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { formatBytes, formatCount, formatDateTime } from "../../lib/format";
import styles from "./replication.module.css";

export function formatSize(bytes: number): string {
  return bytes === 0 ? "0 B" : formatBytes(bytes);
}

export function Stat({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className={styles.stat}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function goalLabel(goal: DestinationSummary["goal"]): string {
  return goal === "full_copy" ? "Full copy" : "Partial coverage";
}

export function connectionTone(connection: DestinationConnection): PillTone {
  if (connection === "connected") return "green";
  if (connection === "offline") return "amber";
  return "red";
}

export function connectionLabel(connection: DestinationConnection): string {
  if (connection === "connected") return "Connected";
  if (connection === "offline") return "Offline";
  if (connection === "retired") return "Retired";
  return "Lost";
}

export function CoverageCard({ coverage }: { coverage: CoverageSummary }): React.JSX.Element {
  return (
    <section className={styles.card}>
      <header className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <span className={styles.icon}>
            <ShieldCheck size={16} aria-hidden="true" />
          </span>
          <div>
            <h2>Verified coverage</h2>
            <p>Only hash-verified copies count. A file on two destinations counts once.</p>
          </div>
        </div>
        <span className={styles.muted}>{formatDateTime(coverage.coverageAsOf)}</span>
      </header>
      <div className={styles.progressBlock}>
        <ProgressBar
          processed={coverage.allDestinationFiles}
          total={coverage.sourceFiles}
          label="Verified source coverage"
          tone="green"
        />
        <div className={styles.progressLegend}>
          <span>
            {formatCount(coverage.allDestinationFiles)} of {formatCount(coverage.sourceFiles)}{" "}
            source files verified
          </span>
          <span>{coverage.allDestinationPercent.toFixed(1)}%</span>
        </div>
      </div>
      <div className={styles.statGrid}>
        <Stat
          label="Partial drives only"
          value={`${coverage.partialPercent.toFixed(1)}% · ${formatSize(coverage.partialBytes)}`}
        />
        <Stat
          label="Partial remainder"
          value={`${formatCount(coverage.partialRemainderFiles)} · ${formatSize(coverage.partialRemainderBytes)}`}
        />
        <Stat
          label="Full copies"
          value={
            coverage.fullCopyFiles === 0
              ? "None"
              : `${formatCount(coverage.fullCopyFiles)} · ${formatSize(coverage.fullCopyBytes)}`
          }
        />
      </div>
      {coverage.overlapBytes === 0 ? null : (
        <p className={styles.note}>
          {formatSize(coverage.overlapBytes)} intentionally overlap between destinations.
        </p>
      )}
    </section>
  );
}

export function DestinationCard({
  destination,
  href,
}: {
  destination: DestinationSummary;
  href: string;
}): React.JSX.Element {
  const letter = destination.letter === null ? "" : ` (${destination.letter})`;
  const attention =
    destination.attention.onlyOnDriveFiles + destination.attention.sourceMissingFiles;
  return (
    <Link className={styles.destinationCard} to={href}>
      <div className={styles.destinationTop}>
        <div>
          <h3 className={styles.destinationName}>
            {destination.label}
            {letter}
          </h3>
          <p className={styles.destinationMeta}>
            {goalLabel(destination.goal)} · priority {String(destination.priority + 1)}
            {destination.isFirstInFillOrder ? " · fills first" : ""}
          </p>
        </div>
        <Pill tone={connectionTone(destination.connection)}>
          {connectionLabel(destination.connection)}
        </Pill>
      </div>
      <div className={styles.badges}>
        <Pill tone={destination.goal === "full_copy" ? "blue" : "neutral"}>
          <HardDrive size={12} aria-hidden="true" /> {formatSize(destination.verifiedBytes)}
        </Pill>
        <Pill tone="muted">{formatCount(destination.verifiedFiles)} files</Pill>
        {destination.fullCopyStatus === "complete" ? (
          <Pill tone="green">Full copy complete</Pill>
        ) : null}
      </div>
      <div className={styles.progressBlock}>
        <ProgressBar
          processed={destination.verifiedFiles}
          total={
            destination.verifiedFiles + destination.attention.sourceMissingFiles > 0
              ? destination.verifiedFiles + destination.attention.sourceMissingFiles
              : null
          }
          label={`${destination.label} verified coverage`}
          tone="green"
          thin
        />
        <div className={styles.progressLegend}>
          <span>{formatSize(destination.availableBytes)} safe to add</span>
          <span>{formatSize(destination.freeBytes)} free</span>
        </div>
      </div>
      {attention === 0 ? null : (
        <p className={styles.attention}>
          {formatCount(attention)} files need attention on this drive.
        </p>
      )}
    </Link>
  );
}

export function CoverageMap({ cells }: { cells: CoverageMapCell[] }): React.JSX.Element {
  if (cells.length === 0) {
    return (
      <p className={styles.muted}>
        <CircleDashed size={13} aria-hidden="true" /> No dated verified files yet.
      </p>
    );
  }
  const max = Math.max(...cells.map((cell) => cell.count), 1);
  const groups = new Map<number, { months: Map<number, number>; yearOnly: number }>();
  for (const cell of cells) {
    const group = groups.get(cell.year) ?? { months: new Map<number, number>(), yearOnly: 0 };
    if (cell.month === null) {
      group.yearOnly += cell.count;
    } else {
      group.months.set(cell.month, cell.count);
    }
    groups.set(cell.year, group);
  }
  const years = [...groups.entries()].sort(([left], [right]) => left - right);

  function barHeight(count: number): string {
    return `${String(Math.max(3, (count / max) * 56))}px`;
  }

  return (
    <div className={styles.coverageMap} role="img" aria-label="Verified files by month">
      {years.map(([year, group]) => (
        <div className={styles.coverageYearGroup} key={String(year)}>
          <div className={styles.coverageBars}>
            {Array.from({ length: 12 }, (_, index) => {
              const month = index + 1;
              const count = group.months.get(month) ?? 0;
              return (
                <span
                  key={String(month)}
                  className={`${styles.coverageBar}${count === 0 ? ` ${styles.coverageBarEmpty}` : ""}`}
                  style={{ height: count === 0 ? undefined : barHeight(count) }}
                  title={`${String(year)}-${String(month).padStart(2, "0")}: ${formatCount(count)} files`}
                />
              );
            })}
            {group.yearOnly === 0 ? null : (
              <span
                className={`${styles.coverageBar} ${styles.coverageBarYearOnly}`}
                style={{ height: barHeight(group.yearOnly) }}
                title={`${String(year)}: ${formatCount(group.yearOnly)} files with year-only dates`}
              />
            )}
          </div>
          <span className={styles.coverageYear}>{String(year)}</span>
        </div>
      ))}
    </div>
  );
}
