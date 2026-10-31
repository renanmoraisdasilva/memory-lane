import type { ReactNode } from "react";
import styles from "./ui.module.css";

export type PillTone = "neutral" | "amber" | "green" | "red" | "blue" | "muted";

const TONE_CLASS: Record<PillTone, string | undefined> = {
  neutral: undefined,
  amber: styles.pillAmber,
  green: styles.pillGreen,
  red: styles.pillRed,
  blue: styles.pillBlue,
  muted: styles.pillMuted,
};

export function Pill({
  tone = "neutral",
  icon,
  children,
}: {
  tone?: PillTone;
  icon?: ReactNode;
  children: ReactNode;
}): React.JSX.Element {
  const toneClass = TONE_CLASS[tone];
  return (
    <span className={toneClass === undefined ? styles.pill : `${styles.pill} ${toneClass}`}>
      {icon}
      {children}
    </span>
  );
}
