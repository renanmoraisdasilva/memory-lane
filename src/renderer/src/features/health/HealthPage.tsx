import { Copy, ShieldAlert, ShieldCheck } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Pill } from "../../components/ui/Pill";
import { formatBytes, formatCount, formatDateTime } from "../../lib/format";
import { DuplicatesTab } from "./DuplicatesTab";
import { MissingTab } from "./MissingTab";
import { ValidationTab } from "./ValidationTab";
import { useHealthSummary } from "./use-health";
import styles from "./HealthPage.module.css";

type HealthTab = "missing" | "duplicates" | "validation";

function parseTab(value: string | null): HealthTab {
  if (value === "duplicates" || value === "validation") {
    return value;
  }
  return "missing";
}

function HealthHeader({ summary }: { summary: ReturnType<typeof useHealthSummary>["data"] }) {
  return (
    <header className={styles.header}>
      <div>
        <div className={styles.eyebrow}>Library health</div>
        <div className={styles.titleRow}>
          <h1>Integrity information</h1>
          <Pill tone="green" icon={<ShieldCheck size={11} aria-hidden="true" />}>
            Read-only
          </Pill>
        </div>
        <p className={styles.summary}>
          {summary === undefined
            ? "Loading catalog health…"
            : `${formatCount(summary.duplicateGroups)} duplicate groups · ${formatCount(summary.missingFiles)} missing files · ${formatCount(summary.movedCandidates)} moved candidates · last validation ${formatDateTime(summary.lastValidationAt)}`}
        </p>
      </div>
      {summary === undefined ? null : (
        <div className={styles.statsRow}>
          <span>{formatBytes(summary.duplicateBytes)} in duplicate copies</span>
        </div>
      )}
    </header>
  );
}

function HealthTabs({
  tab,
  summary,
  onSelect,
}: {
  tab: HealthTab;
  summary: ReturnType<typeof useHealthSummary>["data"];
  onSelect: (tab: HealthTab) => void;
}): React.JSX.Element {
  const missing =
    summary === undefined ? null : (
      <span className={styles.tabCount}>{formatCount(summary.missingFiles)}</span>
    );
  const duplicates =
    summary === undefined ? null : (
      <span className={styles.tabCount}>{formatCount(summary.duplicateGroups)}</span>
    );
  return (
    <div className={styles.tabs} role="tablist" aria-label="Library health sections">
      <button
        className={`${styles.tab}${tab === "missing" ? ` ${styles.tabActive}` : ""}`}
        type="button"
        role="tab"
        aria-selected={tab === "missing"}
        onClick={() => onSelect("missing")}
      >
        <ShieldAlert size={15} aria-hidden="true" />
        Missing files
        {missing}
      </button>
      <button
        className={`${styles.tab}${tab === "duplicates" ? ` ${styles.tabActive}` : ""}`}
        type="button"
        role="tab"
        aria-selected={tab === "duplicates"}
        onClick={() => onSelect("duplicates")}
      >
        <Copy size={15} aria-hidden="true" />
        Duplicates
        {duplicates}
      </button>
      <button
        className={`${styles.tab}${tab === "validation" ? ` ${styles.tabActive}` : ""}`}
        type="button"
        role="tab"
        aria-selected={tab === "validation"}
        onClick={() => onSelect("validation")}
      >
        <ShieldCheck size={15} aria-hidden="true" />
        Validation
      </button>
    </div>
  );
}

export function HealthPage(): React.JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));
  const summary = useHealthSummary();

  function selectTab(next: HealthTab): void {
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    setSearchParams(params, { replace: true });
  }

  return (
    <div className={styles.page}>
      <HealthHeader summary={summary.data} />
      <HealthTabs tab={tab} summary={summary.data} onSelect={selectTab} />
      <div className={styles.tabPanel} role="tabpanel">
        {tab === "missing" ? <MissingTab /> : null}
        {tab === "duplicates" ? <DuplicatesTab limit={25} /> : null}
        {tab === "validation" ? <ValidationTab /> : null}
      </div>
    </div>
  );
}
