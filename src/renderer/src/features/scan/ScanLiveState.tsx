import { AlertTriangle, Pause, Play, RefreshCw, ScanLine, ShieldCheck } from "lucide-react";
import { Callout, Spinner } from "../../components/ui/Callout";
import { formatDateTime } from "../../lib/format";
import type { DriveSelectionItem } from "../drives/types";
import { IntensityControl } from "./IntensityControl";
import { ScanDetails } from "./ScanDetails";
import { ScanHero } from "./ScanHero";
import { StageCard } from "./StageCard";
import {
  SCAN_STAGE_LABELS,
  SCAN_STAGE_ORDER,
  activeStage,
  type ScanIntensity,
  type ScanState,
} from "./types";
import styles from "./ScanPage.module.css";

interface ScanLiveStateProps {
  state: ScanState;
  drive: DriveSelectionItem;
  catalogPath: string;
  intensityPending: boolean;
  pausePending: boolean;
  resumePending: boolean;
  onPause: () => void;
  onResume: () => void;
  onIntensity: (value: ScanIntensity) => void;
  onRetry: () => void;
  onSwitchDrive: () => void;
}

interface LiveCopy {
  title: string;
  description: string;
}

function currentStageText(state: ScanState): string {
  const stage = activeStage(state.stages);
  if (stage === null) {
    return "Preparing the next stage";
  }
  const index = SCAN_STAGE_ORDER.indexOf(stage.id);
  return `Stage ${index + 1} of 4 · ${SCAN_STAGE_LABELS[stage.id]}`;
}

function liveCopy(state: ScanState, drive: DriveSelectionItem): LiveCopy {
  switch (state.status) {
    case "active":
      return {
        title: `Scanning ${drive.label}`,
        description: `${currentStageText(state)}. Stage progress is saved as work completes.`,
      };
    case "paused":
      return {
        title: "Background processing paused",
        description:
          "Progress is saved. Resume when you are ready; nothing restarts automatically.",
      };
    case "interrupted":
      return {
        title: "Scan stopped — progress saved",
        description:
          "The drive was disconnected or the app closed. Reconnect the drive and resume manually; nothing starts automatically.",
      };
    case "error":
      return {
        title: "Scan unavailable",
        description:
          state.errorMessage ??
          "The scan stopped before it could finish. Reconnect the drive and try again.",
      };
    case "idle":
    case "complete":
      return { title: "Scan status", description: "No scan is running." };
  }
}

function LiveActions({
  state,
  pausePending,
  resumePending,
  onPause,
  onResume,
  onRetry,
  onSwitchDrive,
}: Omit<
  ScanLiveStateProps,
  "drive" | "catalogPath" | "intensityPending" | "onIntensity"
>): React.JSX.Element {
  if (state.status === "active") {
    return (
      <button
        className={styles.secondaryButton}
        type="button"
        disabled={pausePending}
        onClick={onPause}
      >
        {pausePending ? <Spinner /> : <Pause size={14} aria-hidden="true" />}
        {pausePending ? "Pausing…" : "Pause"}
      </button>
    );
  }

  if (state.status === "error") {
    return (
      <>
        <button
          className={styles.primaryButton}
          type="button"
          disabled={resumePending}
          onClick={onResume}
        >
          {resumePending ? <Spinner /> : <Play size={14} aria-hidden="true" />}
          {resumePending ? "Resuming…" : "Resume scan"}
        </button>
        <button className={styles.secondaryButton} type="button" onClick={onRetry}>
          <RefreshCw size={14} aria-hidden="true" />
          Retry status
        </button>
        <button className={styles.secondaryButton} type="button" onClick={onSwitchDrive}>
          Switch drive
        </button>
      </>
    );
  }

  return (
    <>
      <button
        className={styles.primaryButton}
        type="button"
        disabled={resumePending}
        onClick={onResume}
      >
        {resumePending ? <Spinner /> : <Play size={14} aria-hidden="true" />}
        {resumePending ? "Resuming…" : "Resume scan"}
      </button>
      {state.status === "interrupted" ? (
        <button className={styles.secondaryButton} type="button" onClick={onSwitchDrive}>
          Switch drive
        </button>
      ) : null}
    </>
  );
}

function StateNote({ state }: { state: ScanState }): React.JSX.Element {
  if (state.status === "paused") {
    return (
      <Callout
        tone="green"
        icon={<ShieldCheck size={17} aria-hidden="true" />}
        title="No work is lost"
      >
        Completed items and stage progress are persisted. Paused work resumes only when you ask it
        to.
      </Callout>
    );
  }
  if (state.status === "interrupted") {
    return (
      <Callout
        tone="red"
        icon={<AlertTriangle size={17} aria-hidden="true" />}
        title="Why resume is manual"
      >
        Memory Lane never resumes a scan without you. If the drive letter changed, confirm the drive
        identity first in Drive selection.
      </Callout>
    );
  }
  if (state.status === "error") {
    return (
      <Callout
        tone="red"
        icon={<AlertTriangle size={17} aria-hidden="true" />}
        title="Drive unavailable"
      >
        Reconnect the drive and retry. Catalog records and saved stage progress are retained.
      </Callout>
    );
  }
  return (
    <Callout
      tone="amber"
      icon={<ShieldCheck size={17} aria-hidden="true" />}
      title="Safe interruption"
    >
      If the app closes or the drive disconnects, work stops safely. Progress is saved, and nothing
      resumes until you choose Resume.
    </Callout>
  );
}

export function ScanLiveState(props: ScanLiveStateProps): React.JSX.Element {
  const { state, drive, catalogPath, intensityPending, onIntensity } = props;
  const copy = liveCopy(state, drive);

  return (
    <>
      <ScanHero
        title={copy.title}
        description={copy.description}
        actions={
          <LiveActions
            state={state}
            pausePending={props.pausePending}
            resumePending={props.resumePending}
            onPause={props.onPause}
            onResume={props.onResume}
            onRetry={props.onRetry}
            onSwitchDrive={props.onSwitchDrive}
          />
        }
      />

      <div className={styles.scanLayout}>
        <div className={styles.mainColumn}>
          <section className={styles.panel} aria-labelledby="pipeline-stages-title">
            <div className={styles.panelHead}>
              <div>
                <h2 id="pipeline-stages-title">Pipeline stages</h2>
                <p className={styles.panelDescription}>
                  Four independent stages. Completed work is kept across pauses and interruptions.
                </p>
              </div>
              <span className={styles.lastSaved}>
                Last saved {formatDateTime(state.lastSavedAt)}
              </span>
            </div>
            <div className={styles.stageList}>
              {state.stages.map((stage, index) => (
                <StageCard key={stage.id} stage={stage} scanStatus={state.status} index={index} />
              ))}
            </div>
          </section>

          <StateNote state={state} />
        </div>

        <aside className={styles.aside}>
          {state.status === "error" ? null : (
            <IntensityControl
              value={state.intensity}
              pending={intensityPending}
              onChange={onIntensity}
            />
          )}
          <ScanDetails state={state} driveLabel={drive.label} catalogPath={catalogPath} />
          <Callout
            tone="amber"
            icon={<ScanLine size={17} aria-hidden="true" />}
            title="Phase 1 handoff"
          >
            The Memory Lane timeline is not available in this build. You can monitor the scan here;
            browsing arrives in Phase 2.
          </Callout>
        </aside>
      </div>
    </>
  );
}
