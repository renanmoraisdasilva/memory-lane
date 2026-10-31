import type { ReactNode } from "react";
import styles from "./ui.module.css";

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}): React.JSX.Element {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyStateIcon}>{icon}</span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action === undefined ? null : <div className={styles.emptyStateAction}>{action}</div>}
    </div>
  );
}
