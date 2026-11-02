import { AlertTriangle, ArrowRight, CheckCircle2, X } from "lucide-react";
import { useState } from "react";
import type { MovedCandidate } from "@shared/contracts/health";
import { EmptyState } from "../../components/ui/EmptyState";
import { formatBytes, formatCount, formatDateTime } from "../../lib/format";
import { useConfirmMoved, useDismissMoved, useHealthMissing, useHealthMoved } from "./use-health";
import { MissingDuplicates } from "./MissingDuplicates";
import styles from "./HealthPage.module.css";

function selectionFor(selected: Set<number> | null, ids: number[]): Set<number> {
  return selected ?? new Set(ids);
}

function MovedSection({
  candidates,
  selected,
  pending,
  error,
  onToggle,
  onConfirm,
  onDismiss,
}: {
  candidates: MovedCandidate[];
  selected: Set<number>;
  pending: boolean;
  error: unknown;
  onToggle: (id: number) => void;
  onConfirm: () => void;
  onDismiss: () => void;
}): React.JSX.Element | null {
  if (candidates.length === 0) {
    return null;
  }
  return (
    <section className={styles.groupCard} aria-labelledby="moved-title">
      <header className={styles.groupHead}>
        <div>
          <h2 id="moved-title">Likely moved files</h2>
          <p>
            {formatCount(candidates.length)} missing files match a newly discovered file by SHA-256.
            Confirming updates the catalog path only.
          </p>
        </div>
        <span className={styles.countBadge}>{formatCount(candidates.length)}</span>
      </header>
      <div className={styles.movedList}>
        {candidates.map((candidate) => (
          <label className={styles.movedRow} key={candidate.id}>
            <input
              type="checkbox"
              checked={selected.has(candidate.id)}
              aria-label={`Select moved ${candidate.name}`}
              onChange={() => onToggle(candidate.id)}
            />
            <span className={styles.movedCopy}>
              <span className={styles.fileName}>{candidate.name}</span>
              <span className={styles.movedPaths}>
                <span>{candidate.oldPath}</span>
                <ArrowRight size={12} aria-hidden="true" />
                <span>{candidate.newPath}</span>
              </span>
            </span>
            <span className={styles.fileSize}>{formatBytes(candidate.sizeBytes)}</span>
          </label>
        ))}
      </div>
      <div className={styles.actions}>
        <button
          className={styles.primaryButton}
          type="button"
          disabled={pending || selected.size === 0}
          onClick={onConfirm}
        >
          <CheckCircle2 size={14} aria-hidden="true" />
          Confirm selected
        </button>
        <button
          className={styles.secondaryButton}
          type="button"
          disabled={pending || selected.size === 0}
          onClick={onDismiss}
        >
          <X size={14} aria-hidden="true" />
          Keep as missing
        </button>
      </div>
      {error === null || error === undefined ? null : (
        <p className={styles.error} role="alert">
          {error instanceof Error ? error.message : "Moved files could not be confirmed."}
        </p>
      )}
    </section>
  );
}

function MissingList({
  loading,
  error,
  items,
}: {
  loading: boolean;
  error: unknown;
  items: Array<{
    fileId: number;
    name: string;
    path: string;
    lastSeenAt: string | null;
    sizeBytes: number;
    hasMovedCandidate: boolean;
  }>;
}): React.JSX.Element | null {
  if (loading) {
    return <p className={styles.muted}>Loading missing files…</p>;
  }
  if (error !== null && error !== undefined) {
    return (
      <p className={styles.error}>
        {error instanceof Error ? error.message : "Missing files could not be loaded."}
      </p>
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle2 size={26} aria-hidden="true" />}
        title="No missing files"
        action={null}
      >
        Every cataloged path currently resolves on the archive drive. Missing files remain cataloged
        until the user decides what to do with them.
      </EmptyState>
    );
  }
  return (
    <section className={styles.tableCard} aria-label="Missing files">
      <div className={styles.tableHead}>
        <span>File</span>
        <span>Last seen</span>
        <span>Size</span>
      </div>
      {items.map((item) => (
        <div className={styles.tableRow} key={item.fileId}>
          <span className={styles.fileCopy}>
            <span className={styles.fileName}>
              {item.name}
              {item.hasMovedCandidate ? (
                <AlertTriangle size={12} aria-label="Moved candidate available" />
              ) : null}
            </span>
            <span className={styles.filePath}>{item.path}</span>
          </span>
          <span className={styles.muted}>{formatDateTime(item.lastSeenAt)}</span>
          <span className={styles.fileSize}>{formatBytes(item.sizeBytes)}</span>
        </div>
      ))}
      <p className={styles.tableNote}>
        These files may have been moved or removed outside Memory Lane. The app did not delete them.
      </p>
    </section>
  );
}

export function MissingTab(): React.JSX.Element {
  const missing = useHealthMissing({ limit: 100 });
  const moved = useHealthMoved();
  const confirm = useConfirmMoved();
  const dismiss = useDismissMoved();
  const [selected, setSelected] = useState<Set<number> | null>(null);
  const candidates = moved.data?.items ?? [];
  const current = selectionFor(
    selected,
    candidates.map((candidate) => candidate.id),
  );
  const pending = confirm.isPending || dismiss.isPending;

  function toggle(id: number): void {
    const next = new Set(current);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
  }

  function confirmSelected(): void {
    const ids = [...current];
    if (ids.length > 0) {
      confirm.mutate({ candidateIds: ids }, { onSuccess: () => setSelected(null) });
    }
  }

  function dismissSelected(): void {
    const ids = [...current];
    if (ids.length > 0) {
      dismiss.mutate({ candidateIds: ids }, { onSuccess: () => setSelected(null) });
    }
  }

  return (
    <div className={styles.stack}>
      <MissingDuplicates />
      <MovedSection
        candidates={candidates}
        selected={current}
        pending={pending}
        error={confirm.error ?? dismiss.error}
        onToggle={toggle}
        onConfirm={confirmSelected}
        onDismiss={dismissSelected}
      />
      <MissingList
        loading={missing.isLoading}
        error={missing.error}
        items={missing.data?.items ?? []}
      />
    </div>
  );
}
