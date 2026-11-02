import { ChevronRight, ShieldCheck } from "lucide-react";
import type { VolumeId } from "@shared/contracts/drives";
import { ScanChip } from "./ScanChip";
import { ReplicationChip } from "./ReplicationChip";
import { AdoptionChip } from "./AdoptionChip";
import styles from "./AppShell.module.css";

export function TopBar({
  crumbs,
  volumeId,
}: {
  crumbs: string[];
  volumeId: VolumeId;
}): React.JSX.Element {
  return (
    <header className={styles.topbar}>
      <nav className={styles.crumbs} aria-label="Breadcrumb">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <span className={styles.crumb} key={`${crumb}-${String(index)}`}>
              {index > 0 ? <ChevronRight size={13} aria-hidden="true" /> : null}
              {last ? <strong>{crumb}</strong> : <span>{crumb}</span>}
            </span>
          );
        })}
      </nav>
      <div className={styles.topbarRight}>
        <ReplicationChip />
        <AdoptionChip />
        <ScanChip volumeId={volumeId} />
        <span className={styles.readonlyPill}>
          <ShieldCheck size={13} aria-hidden="true" />
          Read-only
        </span>
      </div>
    </header>
  );
}
