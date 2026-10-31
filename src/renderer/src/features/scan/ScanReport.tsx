import { CheckCircle2, Info, ShieldCheck } from "lucide-react";
import { Callout } from "../../components/ui/Callout";
import { Pill } from "../../components/ui/Pill";
import { formatCount, formatDateTime, formatDuration } from "../../lib/format";
import {
  scanDurationSeconds,
  scanIntensityLabel,
  type ScanReport as ScanReportData,
  type ScanStageId,
  type ScanState,
} from "./types";
import styles from "./ScanPage.module.css";

function stageCount(state: ScanState, stageId: ScanStageId): number {
  return state.stages.find((stage) => stage.id === stageId)?.processed ?? 0;
}

function ReportRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className={styles.detailRow}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Stat({
  value,
  label,
  hint,
  tone,
}: {
  value: string;
  label: string;
  hint: string;
  tone?: string | undefined;
}): React.JSX.Element {
  return (
    <div className={styles.stat}>
      <span className={tone === undefined ? styles.statValue : `${styles.statValue} ${tone}`}>
        {value}
      </span>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statHint}>{hint}</span>
    </div>
  );
}

function ReportStats({ report }: { report: ScanReportData }): React.JSX.Element {
  return (
    <div className={styles.statStrip}>
      <Stat value={formatCount(report.newFiles)} label="New files" hint="Added to the catalog" />
      <Stat
        value={formatCount(report.changedFiles)}
        label="Changed files"
        hint="Metadata refreshed"
        tone={styles.statAmber}
      />
      <Stat
        value={formatCount(report.missingFiles)}
        label="Missing files"
        hint="Retained in the catalog"
        tone={styles.statRed}
      />
      <Stat
        value={formatCount(report.movedCandidates)}
        label="Likely moved"
        hint="Matched by hash"
        tone={styles.statGreen}
      />
    </div>
  );
}

function ReportDetails({
  state,
  driveLabel,
  catalogPath,
}: {
  state: ScanState;
  driveLabel: string;
  catalogPath: string;
}): React.JSX.Element {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <div>
          <h2 id="scan-report-title">Scan report</h2>
          <p className={styles.panelDescription}>
            Finished {formatDateTime(state.finishedAt)} ·{" "}
            {formatDuration(scanDurationSeconds(state))} · Read-only throughout.
          </p>
        </div>
        <Pill tone="green" icon={<CheckCircle2 size={11} aria-hidden="true" />}>
          Success
        </Pill>
      </div>
      <ReportRow label="Files cataloged" value={formatCount(stageCount(state, "catalog"))} />
      <ReportRow label="Metadata processed" value={formatCount(stageCount(state, "metadata"))} />
      <ReportRow
        label="Thumbnails generated"
        value={formatCount(stageCount(state, "thumbnails"))}
      />
      <ReportRow label="Hashes calculated" value={formatCount(stageCount(state, "hashes"))} />
      <ReportRow label="Drive" value={driveLabel} />
      <ReportRow label="Started" value={formatDateTime(state.startedAt)} />
      <ReportRow label="Intensity" value={scanIntensityLabel(state.intensity)} />
      <div className={styles.catalogPath}>
        <span>Catalog</span>
        <code>{catalogPath}</code>
      </div>
    </div>
  );
}

function missingTitle(report: ScanReportData): string {
  return report.missingFiles > 0
    ? `${formatCount(report.missingFiles)} files are missing`
    : "No missing files found";
}

function missingBody(report: ScanReportData): string {
  if (report.missingFiles === 0) {
    return "Every cataloged path was still present at the end of this scan.";
  }
  return `${formatCount(report.missingFiles)} items may have been moved or removed outside Memory Lane. They remain cataloged, and ${formatCount(report.movedCandidates)} likely matches were found by hash.`;
}

function ReportSide({ report }: { report: ScanReportData }): React.JSX.Element {
  return (
    <div className={styles.reportSide}>
      <div className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>What changed</h2>
        </div>
        <Callout
          tone={report.missingFiles > 0 ? "amber" : "green"}
          icon={<ShieldCheck size={17} aria-hidden="true" />}
          title={missingTitle(report)}
        >
          {missingBody(report)}
        </Callout>
        <div className={styles.reportCallout}>
          <Callout tone="amber" icon={<Info size={17} aria-hidden="true" />} title="Next phases">
            Date assignment arrives in Phase 3, and Library health arrives in Phase 4. The scan
            report above is the Phase 2 result, and Scan again is safe to run at any time.
          </Callout>
        </div>
      </div>
    </div>
  );
}

export function ScanReport({
  state,
  driveLabel,
  catalogPath,
}: {
  state: ScanState;
  driveLabel: string;
  catalogPath: string;
}): React.JSX.Element {
  const report = state.report;

  if (report === null) {
    return (
      <Callout
        tone="amber"
        title="Scan report unavailable"
        icon={<Info size={17} aria-hidden="true" />}
      >
        The scan finished without a report. Run another scan to refresh the counts.
      </Callout>
    );
  }

  return (
    <section aria-labelledby="scan-report-title">
      <ReportStats report={report} />
      <div className={styles.reportGrid}>
        <ReportDetails state={state} driveLabel={driveLabel} catalogPath={catalogPath} />
        <ReportSide report={report} />
      </div>
    </section>
  );
}
