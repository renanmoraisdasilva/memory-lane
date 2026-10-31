import { useId } from "react";
import { Pill, type PillTone } from "../../components/ui/Pill";
import { ProgressBar, type ProgressTone } from "../../components/ui/ProgressBar";
import { formatCount, formatPercent } from "../../lib/format";
import { STAGE_ICONS } from "./stage-meta";
import {
  SCAN_STAGE_DESCRIPTIONS,
  SCAN_STAGE_LABELS,
  type ScanStage,
  type ScanStageState,
  type ScanStatus,
} from "./types";
import styles from "./ScanPage.module.css";

interface StageCardProps {
  stage: ScanStage;
  scanStatus: ScanStatus;
  index: number;
}

interface StageVisual {
  label: string;
  tone: PillTone;
  cardClass: string | undefined;
  progressTone: ProgressTone;
}

function stageLabel(state: ScanStageState, scanStatus: ScanStatus): string {
  if (state === "complete") {
    return "Complete";
  }
  if (state === "failed") {
    return "Failed";
  }
  if (state === "queued") {
    return "Queued";
  }
  if (scanStatus === "paused") {
    return "Paused";
  }
  if (scanStatus === "interrupted" || scanStatus === "error") {
    return "Stopped";
  }
  return state === "paused" ? "Paused" : "Active";
}

function stageVisual(state: ScanStageState, scanStatus: ScanStatus): StageVisual {
  const label = stageLabel(state, scanStatus);
  if (state === "complete") {
    return {
      label,
      tone: "green",
      cardClass: styles.stageComplete,
      progressTone: "green",
    };
  }
  if (state === "failed") {
    return { label, tone: "red", cardClass: styles.stageFailed, progressTone: "red" };
  }
  if (state === "active" || state === "paused") {
    return { label, tone: "amber", cardClass: styles.stageActive, progressTone: "amber" };
  }
  return { label, tone: "muted", cardClass: undefined, progressTone: "amber" };
}

export function StageCard({ stage, scanStatus, index }: StageCardProps): React.JSX.Element {
  const headingId = useId();
  const Icon = STAGE_ICONS[stage.id];
  const visual = stageVisual(stage.state, scanStatus);
  const percent = formatPercent(stage.processed, stage.total);
  const cardClass = [styles.stageCard, visual.cardClass]
    .filter((item): item is string => item !== undefined)
    .join(" ");

  return (
    <article className={cardClass} aria-labelledby={headingId}>
      <div className={styles.stageIcon}>
        <Icon size={17} aria-hidden="true" />
      </div>
      <div className={styles.stageContent}>
        <div className={styles.stageHead}>
          <h3 id={headingId}>
            {index + 1}. {SCAN_STAGE_LABELS[stage.id]}
          </h3>
          <Pill tone={visual.tone}>{visual.label}</Pill>
        </div>
        <p className={styles.stageDescription}>{SCAN_STAGE_DESCRIPTIONS[stage.id]}</p>
        <div className={styles.stageProgressRow}>
          <span>
            {stage.total === null
              ? `${formatCount(stage.processed)} processed · total being discovered`
              : `${formatCount(stage.processed)} / ${formatCount(stage.total)} files`}
          </span>
          <span>{percent === null ? "Discovering" : percent}</span>
        </div>
        <ProgressBar
          processed={stage.processed}
          total={stage.total}
          label={`${SCAN_STAGE_LABELS[stage.id]} progress`}
          tone={visual.progressTone}
          thin
        />
      </div>
    </article>
  );
}
