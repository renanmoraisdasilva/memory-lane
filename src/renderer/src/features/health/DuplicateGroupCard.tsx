import { DatabaseBackup, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import type { DuplicateGroup } from "@shared/contracts/health";
import { formatBytes, formatCount } from "../../lib/format";
import { viewerPath } from "../library/library-url";
import { skipReasonLabel } from "./duplicate-cleanup-labels";
import styles from "./HealthPage.module.css";

function mediaLink(fileId: number, mediaClass: "image" | "video" | "other"): string | null {
  return mediaClass === "other" ? null : viewerPath(fileId, "all", "comfortable");
}

export function DuplicateGroupCard({ group }: { group: DuplicateGroup }): React.JSX.Element {
  return (
    <article className={styles.groupCard}>
      <header className={styles.groupHead}>
        <div>
          <h2>{formatCount(group.fileCount)} exact copies</h2>
          <p>
            SHA-256 {group.sha256.slice(0, 16)}… · {formatBytes(group.totalBytes)} total ·{" "}
            {group.eligible
              ? `${formatBytes(group.excessBytes)} excess · keeper: ${group.keeperReason}`
              : `skipped: ${skipReasonLabel(group.skipReason)}`}
          </p>
        </div>
        <div className={styles.cleanupBadges}>
          {group.eligible ? (
            <>
              <span className={`${styles.cleanupBadge} ${styles.cleanupBadgeKeep}`}>
                <DatabaseBackup size={10} aria-hidden="true" />1 KEEP
              </span>
              <span className={`${styles.cleanupBadge} ${styles.cleanupBadgeMove}`}>
                {formatCount(group.fileCount - 1)} MOVE
              </span>
            </>
          ) : (
            <span className={`${styles.cleanupBadge} ${styles.cleanupBadgeSkip}`}>SKIP</span>
          )}
        </div>
      </header>
      <div className={styles.fileList}>
        {group.files.map((file) => {
          const link = mediaLink(file.fileId, file.mediaClass);
          const keeper = group.eligible && file.fileId === group.keeperFileId;
          const moving = group.eligible && file.fileId !== group.keeperFileId;
          return (
            <div className={styles.fileRow} key={file.fileId}>
              {group.eligible ? (
                <span
                  className={`${styles.cleanupBadge} ${
                    keeper ? styles.cleanupBadgeKeep : styles.cleanupBadgeMove
                  }`}
                >
                  {keeper ? "KEEP" : "MOVE"}
                </span>
              ) : null}
              <span className={styles.fileCopy}>
                <span className={styles.fileName}>
                  {file.name}
                  {file.hasVerifiedReplica ? (
                    <DatabaseBackup size={12} aria-label="Has a verified backup copy" />
                  ) : null}
                </span>
                <span className={styles.filePath}>{file.path}</span>
              </span>
              <span className={styles.fileSize}>{formatBytes(file.sizeBytes)}</span>
              {link === null || moving ? null : (
                <Link className={styles.openLink} to={link} aria-label={`Open ${file.name}`}>
                  <ExternalLink size={13} aria-hidden="true" />
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </article>
  );
}
