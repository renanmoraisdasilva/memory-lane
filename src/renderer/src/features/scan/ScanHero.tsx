import type { ReactNode } from "react";
import styles from "./ScanPage.module.css";

export function ScanHero({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions: ReactNode;
}): React.JSX.Element {
  return (
    <section className={styles.hero}>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className={styles.heroActions}>{actions}</div>
    </section>
  );
}
