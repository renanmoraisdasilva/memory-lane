import { AlertTriangle, ArrowRight, CheckCircle2, X } from "lucide-react";
import { useState } from "react";
import type { MovedCandidate } from "@shared/contracts/health";
import { formatBytes, formatCount } from "../../lib/format";
import { useConfirmMoved, useDismissMoved, useHealthMoved, useHealthSummary } from "./use-health";
import { MissingDuplicates } from "./MissingDuplicates";
import { MissingFiles } from "./MissingFiles";
import styles from "./HealthPage.module.css";

const MOVED_PAGE_SIZE = 50;

function MovedActions({
  hasCandidates,
  selectedCount,
  allPageSelected,
  pending,
  error,
  onTogglePage,
  onConfirm,
  onDismiss,
}: {
  hasCandidates: boolean;
  selectedCount: number;
  allPageSelected: boolean;
  pending: boolean;
  error: unknown;
  onTogglePage: () => void;
  onConfirm: () => void;
  onDismiss: () => void;
}): React.JSX.Element {
  return (
    <>
      <div className={styles.actions}>
        <button
          className={styles.secondaryButton}
          type="button"
          disabled={pending || !hasCandidates}
          onClick={onTogglePage}
        >
          {allPageSelected ? "Clear page" : "Select page"}
        </button>
        <button
          className={styles.primaryButton}
          type="button"
          disabled={pending || selectedCount === 0}
          onClick={onConfirm}
        >
          <CheckCircle2 size={14} aria-hidden="true" />
          Confirm selected{selectedCount > 0 ? ` (${formatCount(selectedCount)})` : ""}
        </button>
        <button
          className={styles.secondaryButton}
          type="button"
          disabled={pending || selectedCount === 0}
          onClick={onDismiss}
        >
          <X size={14} aria-hidden="true" />
          Keep as missing{selectedCount > 0 ? ` (${formatCount(selectedCount)})` : ""}
        </button>
      </div>
      {error === null || error === undefined ? null : (
        <p className={styles.error} role="alert">
          {error instanceof Error ? error.message : "Moved files could not be updated."}
        </p>
      )}
    </>
  );
}

function MovedList({
  candidates,
  selected,
  page,
  pageCount,
  pending,
  onToggle,
  onPreviousPage,
  onNextPage,
}: {
  candidates: MovedCandidate[];
  selected: Set<number>;
  page: number;
  pageCount: number;
  pending: boolean;
  onToggle: (id: number) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}): React.JSX.Element {
  return (
    <>
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
      {pageCount > 1 ? (
        <div className={styles.pagination}>
          <button
            className={styles.secondaryButton}
            type="button"
            disabled={pending || page === 0}
            onClick={onPreviousPage}
          >
            Previous
          </button>
          <span className={styles.muted}>
            Page {formatCount(page + 1)} of {formatCount(pageCount)}
          </span>
          <button
            className={styles.secondaryButton}
            type="button"
            disabled={pending || page + 1 >= pageCount}
            onClick={onNextPage}
          >
            Next
          </button>
        </div>
      ) : null}
    </>
  );
}

function MovedSection({
  candidates,
  total,
  selected,
  page,
  pageCount,
  pending,
  error,
  onToggle,
  onTogglePage,
  onPreviousPage,
  onNextPage,
  onConfirm,
  onDismiss,
}: {
  candidates: MovedCandidate[];
  total: number;
  selected: Set<number>;
  page: number;
  pageCount: number;
  pending: boolean;
  error: unknown;
  onToggle: (id: number) => void;
  onTogglePage: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onConfirm: () => void;
  onDismiss: () => void;
}): React.JSX.Element | null {
  if (total === 0) {
    return null;
  }
  const allPageSelected =
    candidates.length > 0 && candidates.every((candidate) => selected.has(candidate.id));
  return (
    <section className={styles.groupCard} aria-labelledby="moved-title">
      <header className={styles.groupHead}>
        <div>
          <h2 id="moved-title">Likely moved files</h2>
          <p>
            {formatCount(total)} missing files match a newly discovered file by SHA-256. Confirming
            updates the catalog path only.
          </p>
        </div>
        <span className={styles.countBadge}>{formatCount(total)}</span>
      </header>
      <p className={styles.tableNote}>
        <AlertTriangle size={13} aria-hidden="true" /> If these missing copies were duplicates
        deleted outside Memory Lane, use Missing duplicates above instead of confirming the moves.
        {total > MOVED_PAGE_SIZE
          ? ` This list shows ${formatCount(MOVED_PAGE_SIZE)} files at a time.`
          : ""}
      </p>
      <MovedActions
        hasCandidates={candidates.length > 0}
        selectedCount={selected.size}
        allPageSelected={allPageSelected}
        pending={pending}
        error={error}
        onTogglePage={onTogglePage}
        onConfirm={onConfirm}
        onDismiss={onDismiss}
      />
      <MovedList
        candidates={candidates}
        selected={selected}
        page={page}
        pageCount={pageCount}
        pending={pending}
        onToggle={onToggle}
        onPreviousPage={onPreviousPage}
        onNextPage={onNextPage}
      />
    </section>
  );
}

export function MissingTab(): React.JSX.Element {
  const summary = useHealthSummary();
  const [page, setPage] = useState(0);
  const total = summary.data?.movedCandidates ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / MOVED_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const moved = useHealthMoved({
    offset: currentPage * MOVED_PAGE_SIZE,
    limit: MOVED_PAGE_SIZE,
  });
  const confirm = useConfirmMoved();
  const dismiss = useDismissMoved();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const candidates = moved.data?.items ?? [];
  const selection = new Set(
    candidates.filter((candidate) => selected.has(candidate.id)).map((candidate) => candidate.id),
  );
  const pending = confirm.isPending || dismiss.isPending;

  function toggle(id: number): void {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
  }

  function togglePage(): void {
    const allSelected =
      candidates.length > 0 && candidates.every((candidate) => selection.has(candidate.id));
    setSelected(allSelected ? new Set() : new Set(candidates.map((candidate) => candidate.id)));
  }

  function previousPage(): void {
    setPage(Math.max(0, currentPage - 1));
    setSelected(new Set());
  }

  function nextPage(): void {
    setPage(Math.min(pageCount - 1, currentPage + 1));
    setSelected(new Set());
  }

  function confirmSelected(): void {
    const ids = [...selection];
    if (ids.length > 0) {
      confirm.mutate({ candidateIds: ids }, { onSuccess: () => setSelected(new Set()) });
    }
  }

  function dismissSelected(): void {
    const ids = [...selection];
    if (ids.length > 0) {
      dismiss.mutate({ candidateIds: ids }, { onSuccess: () => setSelected(new Set()) });
    }
  }

  return (
    <div className={styles.stack}>
      <MissingDuplicates />
      <MovedSection
        candidates={candidates}
        total={total}
        selected={selection}
        page={currentPage}
        pageCount={pageCount}
        pending={pending}
        error={moved.error ?? confirm.error ?? dismiss.error}
        onToggle={toggle}
        onTogglePage={togglePage}
        onPreviousPage={previousPage}
        onNextPage={nextPage}
        onConfirm={confirmSelected}
        onDismiss={dismissSelected}
      />
      <MissingFiles />
    </div>
  );
}
