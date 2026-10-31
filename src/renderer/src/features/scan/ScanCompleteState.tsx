import { Play } from "lucide-react";
import type { CatalogSummary } from "@shared/contracts/drives";
import { Spinner } from "../../components/ui/Callout";
import { formatCount, formatDuration } from "../../lib/format";
import type { DriveSelectionItem } from "../drives/types";
import { ScanHero } from "./ScanHero";
import { ScanReport } from "./ScanReport";
import { scanDurationSeconds, type ScanState } from "./types";
import styles from "./ScanPage.module.css";

export function CompleteState({
  drive,
  catalog,
  state,
  startPending,
  onStart,
}: {
  drive: DriveSelectionItem;
  catalog: CatalogSummary;
  state: ScanState;
  startPending: boolean;
  onStart: () => void;
}): React.JSX.Element {
  const seconds = scanDurationSeconds(state);
  const cataloged =
    state.stages.find((stage) => stage.id === "catalog")?.processed ?? catalog.fileCount;
  const duration = seconds === null ? "" : ` in ${formatDuration(seconds)}`;

  return (
    <>
      <ScanHero
        title="Scan complete"
        description={`Cataloged ${formatCount(cataloged)} files${duration}. New, changed, missing, and likely moved files are summarized below.`}
        actions={
          <button
            className={styles.primaryButton}
            type="button"
            disabled={startPending}
            onClick={onStart}
          >
            {startPending ? <Spinner /> : <Play size={14} aria-hidden="true" />}
            {startPending ? "Starting…" : "Scan again"}
          </button>
        }
      />
      <ScanReport state={state} driveLabel={drive.label} catalogPath={catalog.catalogPath} />
    </>
  );
}
