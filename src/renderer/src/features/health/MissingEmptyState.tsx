import { CheckCircle2 } from "lucide-react";
import type { MissingFilesPage } from "@shared/contracts/health";
import { EmptyState } from "../../components/ui/EmptyState";
import styles from "./HealthPage.module.css";

export type MissingEmptyMode = "disregarded" | "none" | null;

export function emptyModeFor(data: MissingFilesPage, showDismissed: boolean): MissingEmptyMode {
  if (showDismissed && data.total === 0) {
    return "disregarded";
  }
  return data.total === 0 && data.dismissedTotal === 0 ? "none" : null;
}

export function MissingEmptyState({
  mode,
  onShowActive,
}: {
  mode: Exclude<MissingEmptyMode, null>;
  onShowActive: () => void;
}): React.JSX.Element {
  if (mode === "disregarded") {
    return (
      <section className={styles.tableCard} aria-label="Missing files">
        <p className={styles.muted}>No disregarded missing files.</p>
        <div className={styles.actions}>
          <button className={styles.secondaryButton} type="button" onClick={onShowActive}>
            Back to active missing files
          </button>
        </div>
      </section>
    );
  }
  return (
    <EmptyState
      icon={<CheckCircle2 size={26} aria-hidden="true" />}
      title="No missing files"
      action={null}
    >
      Every cataloged path currently resolves on the archive drive. Missing files remain cataloged
      until the user decides what to do with them.
    </EmptyState>
  );
}
