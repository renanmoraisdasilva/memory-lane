import type { ReactNode } from "react";
import styles from "./ui.module.css";

export type CalloutTone = "neutral" | "amber" | "green" | "red";

const TONE_CLASS: Record<CalloutTone, string | undefined> = {
  neutral: undefined,
  amber: styles.calloutAmber,
  green: styles.calloutGreen,
  red: styles.calloutRed,
};

export function Callout({
  tone = "neutral",
  icon,
  title,
  children,
  role,
}: {
  tone?: CalloutTone;
  icon?: ReactNode;
  title: string;
  children: ReactNode;
  role?: "alert" | "status";
}): React.JSX.Element {
  const toneClass = TONE_CLASS[tone];
  return (
    <div
      className={toneClass === undefined ? styles.callout : `${styles.callout} ${toneClass}`}
      role={role}
    >
      {icon === undefined ? null : <span className={styles.calloutIcon}>{icon}</span>}
      <div>
        <div className={styles.calloutTitle}>{title}</div>
        <div className={styles.calloutBody}>{children}</div>
      </div>
    </div>
  );
}

export function Alert({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <p className={styles.alert} role="alert">
      {children}
    </p>
  );
}

export function Spinner(): React.JSX.Element {
  return <span className={styles.spinner} aria-hidden="true" />;
}
