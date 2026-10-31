import { Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../components/ui/EmptyState";
import { formatBytes, formatCount } from "../../lib/format";
import { viewerPath } from "../library/library-url";
import { useHealthDuplicates } from "./use-health";
import styles from "./HealthPage.module.css";

function mediaLink(fileId: number, mediaClass: "image" | "video" | "other"): string | null {
  return mediaClass === "other" ? null : viewerPath(fileId, "all", "comfortable");
}

export function DuplicatesTab({ limit }: { limit: number }): React.JSX.Element {
  const [pageSize, setPageSize] = useState(limit);
  const query = useHealthDuplicates({ limit: pageSize });

  if (query.isLoading) {
    return <p className={styles.muted}>Finding exact duplicate files…</p>;
  }
  if (query.isError) {
    return (
      <p className={styles.error}>
        {query.error instanceof Error ? query.error.message : "Duplicates could not be loaded."}
      </p>
    );
  }
  if (query.data === undefined || query.data.totalGroups === 0) {
    return (
      <EmptyState
        icon={<Copy size={26} aria-hidden="true" />}
        title="No exact duplicates"
        action={null}
      >
        No two cataloged files share the same SHA-256 hash. Duplicate detection is informational; no
        copy is ever deleted or moved.
      </EmptyState>
    );
  }

  return (
    <div className={styles.stack}>
      <div className={styles.statsRow}>
        <span>{formatCount(query.data.totalGroups)} duplicate groups</span>
        <span>{formatCount(query.data.totalFiles)} files</span>
        <span>
          {formatBytes(query.data.totalBytes)} recoverable if copies are removed externally
        </span>
      </div>
      {query.data.groups.map((group) => (
        <article className={styles.groupCard} key={group.groupId}>
          <header className={styles.groupHead}>
            <div>
              <h2>{formatCount(group.fileCount)} exact copies</h2>
              <p>
                SHA-256 {group.sha256.slice(0, 16)}… · {formatBytes(group.totalBytes)} total
              </p>
            </div>
            <span className={styles.groupSize}>{formatBytes(group.totalBytes)}</span>
          </header>
          <div className={styles.fileList}>
            {group.files.map((file) => {
              const link = mediaLink(file.fileId, file.mediaClass);
              return (
                <div className={styles.fileRow} key={file.fileId}>
                  <span className={styles.fileCopy}>
                    <span className={styles.fileName}>{file.name}</span>
                    <span className={styles.filePath}>{file.path}</span>
                  </span>
                  <span className={styles.fileSize}>{formatBytes(file.sizeBytes)}</span>
                  {link === null ? null : (
                    <Link className={styles.openLink} to={link} aria-label={`Open ${file.name}`}>
                      <ExternalLink size={13} aria-hidden="true" />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </article>
      ))}
      {pageSize < query.data.totalGroups ? (
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={() => setPageSize((current) => current + limit)}
        >
          Load more groups
        </button>
      ) : null}
    </div>
  );
}
