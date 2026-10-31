import { formatPercent } from "../../lib/format";
import styles from "./ui.module.css";

export type ProgressTone = "amber" | "green" | "red";

const TONE_CLASS: Record<ProgressTone, string | undefined> = {
  amber: undefined,
  green: styles.progressGreen,
  red: styles.progressRed,
};

function progressClass(known: boolean, thin: boolean, tone: ProgressTone): string {
  const classes = [styles.progress];
  if (!known) {
    classes.push(styles.progressIndeterminate);
  }
  if (thin) {
    classes.push(styles.progressThin);
  }
  const toneClass = TONE_CLASS[tone];
  if (toneClass !== undefined) {
    classes.push(toneClass);
  }
  return classes.join(" ");
}

function progressAria(
  processed: number,
  total: number | null,
  percent: string | null,
): { min: number | undefined; max: number | undefined; now: number | undefined; text: string } {
  if (percent === null || total === null) {
    return { min: undefined, max: undefined, now: undefined, text: "Total being discovered" };
  }
  return {
    min: 0,
    max: total,
    now: Math.min(processed, total),
    text: `${percent} complete`,
  };
}

export function ProgressBar({
  processed,
  total,
  label,
  tone = "amber",
  thin = false,
}: {
  processed: number;
  total: number | null;
  label: string;
  tone?: ProgressTone;
  thin?: boolean;
}): React.JSX.Element {
  const percent = formatPercent(processed, total);
  const known = percent !== null && total !== null;
  const aria = progressAria(processed, total, percent);
  const width = percent === null ? undefined : { width: percent };

  return (
    <div
      className={progressClass(known, thin, tone)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={aria.min}
      aria-valuemax={aria.max}
      aria-valuenow={aria.now}
      aria-valuetext={aria.text}
    >
      <span className={styles.progressFill} style={width} />
    </div>
  );
}
