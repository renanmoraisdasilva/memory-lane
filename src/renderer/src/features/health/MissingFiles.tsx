import { AlertTriangle, EyeOff, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { MissingFile, MissingFilesPage } from "@shared/contracts/health";
import { formatBytes, formatCount, formatDateTime } from "../../lib/format";
import { emptyModeFor, MissingEmptyState } from "./MissingEmptyState";
import { useDismissMissing, useHealthMissing, useRestoreMissing } from "./use-health";
import { MissingPagination } from "./MissingPagination";
import styles from "./HealthPage.module.css";
const MISSING_PAGE_SIZE = 100;
function MissingRow({
  item,
  selected,
  onToggle,
}: {
  item: MissingFile;
  selected: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  return (
    <label className={styles.tableRow}>
      <input
        type="checkbox"
        checked={selected}
        aria-label={`Select ${item.name}`}
        onChange={onToggle}
      />
      <span className={styles.fileCopy}>
        <span className={styles.fileName}>
          {item.name}
          {item.hasMovedCandidate ? (
            <AlertTriangle size={12} aria-label="Moved candidate available" />
          ) : null}
          {item.dismissedAt === null ? null : <EyeOff size={12} aria-label="Disregarded" />}
        </span>
        <span className={styles.filePath}>
          {item.path}
          {item.dismissedAt === null ? "" : ` · Disregarded ${formatDateTime(item.dismissedAt)}`}
        </span>
      </span>
      <span className={styles.muted}>{formatDateTime(item.lastSeenAt)}</span>
      <span className={styles.fileSize}>{formatBytes(item.sizeBytes)}</span>
    </label>
  );
}

function MissingRows({
  page,
  selected,
  onToggle,
}: {
  page: MissingFilesPage;
  selected: Set<number>;
  onToggle: (id: number) => void;
}): React.JSX.Element {
  if (page.items.length === 0) {
    return (
      <p className={styles.muted}>
        All missing files are currently disregarded. Show disregarded to restore them.
      </p>
    );
  }
  return (
    <>
      <div className={styles.tableHead}>
        <span aria-hidden="true" />
        <span>File</span>
        <span>Last seen</span>
        <span>Size</span>
      </div>
      {page.items.map((item) => (
        <MissingRow
          key={item.fileId}
          item={item}
          selected={selected.has(item.fileId)}
          onToggle={() => onToggle(item.fileId)}
        />
      ))}
    </>
  );
}

function SelectAllButton({
  page,
  allSelected,
  pending,
  onToggleAll,
}: {
  page: MissingFilesPage;
  allSelected: boolean;
  pending: boolean;
  onToggleAll: () => void;
}): React.JSX.Element {
  return (
    <button
      className={styles.secondaryButton}
      type="button"
      disabled={pending || page.fileIds.length === 0}
      onClick={onToggleAll}
    >
      {allSelected ? "Clear selection" : `Select all (${formatCount(page.total)})`}
    </button>
  );
}

function PrimaryActionButton({
  showDismissed,
  selectedCount,
  pending,
  onDismiss,
  onRestore,
}: {
  showDismissed: boolean;
  selectedCount: number;
  pending: boolean;
  onDismiss: () => void;
  onRestore: () => void;
}): React.JSX.Element {
  const label = showDismissed ? "Restore selected" : "Disregard these files";
  return (
    <button
      className={styles.secondaryButton}
      type="button"
      disabled={pending || selectedCount === 0}
      onClick={showDismissed ? onRestore : onDismiss}
    >
      {showDismissed ? (
        <RotateCcw size={14} aria-hidden="true" />
      ) : (
        <EyeOff size={14} aria-hidden="true" />
      )}
      {label}
      {selectedCount > 0 ? ` (${formatCount(selectedCount)})` : ""}
    </button>
  );
}

function ViewButton({
  dismissedTotal,
  showDismissed,
  pending,
  onToggle,
}: {
  dismissedTotal: number;
  showDismissed: boolean;
  pending: boolean;
  onToggle: () => void;
}): React.JSX.Element | null {
  if (dismissedTotal === 0) {
    return null;
  }
  return (
    <button className={styles.secondaryButton} type="button" disabled={pending} onClick={onToggle}>
      {showDismissed
        ? "Back to active missing files"
        : `Show disregarded (${formatCount(dismissedTotal)})`}
    </button>
  );
}

function ToolbarNote({ showDismissed }: { showDismissed: boolean }): React.JSX.Element {
  const message = showDismissed
    ? "Restoring brings these files back into the missing list. Catalog rows are never deleted."
    : "Disregarding hides the selected files from the health report and dismisses their pending move suggestions. Files on the archive and backup drives are not changed.";
  return (
    <p className={styles.tableNote}>
      {message} Select all covers every matching file across pages.
    </p>
  );
}

function ToolbarError({ error }: { error: unknown }): React.JSX.Element | null {
  if (error === null || error === undefined) {
    return null;
  }
  return (
    <p className={styles.error} role="alert">
      {error instanceof Error ? error.message : "Missing files could not be updated."}
    </p>
  );
}

function MissingToolbar({
  page,
  selectedCount,
  allSelected,
  showDismissed,
  pending,
  error,
  onToggleAll,
  onDismiss,
  onRestore,
  onToggleView,
}: {
  page: MissingFilesPage;
  selectedCount: number;
  allSelected: boolean;
  showDismissed: boolean;
  pending: boolean;
  error: unknown;
  onToggleAll: () => void;
  onDismiss: () => void;
  onRestore: () => void;
  onToggleView: () => void;
}): React.JSX.Element {
  return (
    <div className={styles.missingToolbar}>
      <div className={styles.actions}>
        <SelectAllButton
          page={page}
          allSelected={allSelected}
          pending={pending}
          onToggleAll={onToggleAll}
        />
        <PrimaryActionButton
          showDismissed={showDismissed}
          selectedCount={selectedCount}
          pending={pending}
          onDismiss={onDismiss}
          onRestore={onRestore}
        />
        <ViewButton
          dismissedTotal={page.dismissedTotal}
          showDismissed={showDismissed}
          pending={pending}
          onToggle={onToggleView}
        />
      </div>
      <ToolbarNote showDismissed={showDismissed} />
      <ToolbarError error={error} />
    </div>
  );
}

function MissingResults({
  page,
  pageNumber,
  pageCount,
  showDismissed,
  onToggleView,
  onPreviousPage,
  onNextPage,
  onMutated,
}: {
  page: MissingFilesPage;
  pageNumber: number;
  pageCount: number;
  showDismissed: boolean;
  onToggleView: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onMutated: () => void;
}): React.JSX.Element {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const dismiss = useDismissMissing();
  const restore = useRestoreMissing();
  const pending = dismiss.isPending || restore.isPending;
  const allSelected =
    page.fileIds.length > 0 && page.fileIds.every((fileId) => selected.has(fileId));

  function toggle(id: number): void {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
  }

  function toggleView(): void {
    setSelected(new Set());
    onToggleView();
  }

  function dismissSelected(): void {
    dismiss.mutate(
      { fileIds: [...selected] },
      {
        onSuccess: () => {
          setSelected(new Set());
          onMutated();
        },
      },
    );
  }

  function restoreSelected(): void {
    restore.mutate(
      { fileIds: [...selected] },
      {
        onSuccess: () => {
          setSelected(new Set());
          onMutated();
        },
      },
    );
  }

  return (
    <section className={styles.tableCard} aria-label="Missing files">
      <MissingToolbar
        page={page}
        selectedCount={selected.size}
        allSelected={allSelected}
        showDismissed={showDismissed}
        pending={pending}
        error={dismiss.error ?? restore.error}
        onToggleAll={() => setSelected(allSelected ? new Set() : new Set(page.fileIds))}
        onDismiss={dismissSelected}
        onRestore={restoreSelected}
        onToggleView={toggleView}
      />
      <MissingRows page={page} selected={selected} onToggle={toggle} />
      <MissingPagination
        page={pageNumber}
        pageCount={pageCount}
        pending={pending}
        onPrevious={onPreviousPage}
        onNext={onNextPage}
      />
    </section>
  );
}

export function MissingFiles(): React.JSX.Element {
  const [showDismissed, setShowDismissed] = useState(false);
  const [page, setPage] = useState(0);
  const query = useHealthMissing({
    offset: page * MISSING_PAGE_SIZE,
    limit: MISSING_PAGE_SIZE,
    dismissedOnly: showDismissed,
  });
  const pageCount = Math.max(1, Math.ceil((query.data?.total ?? 0) / MISSING_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const toggleView = (): void => {
    setPage(0);
    setShowDismissed((current) => !current);
  };
  if (query.isLoading) {
    return <p className={styles.muted}>Loading missing files…</p>;
  }
  if (query.error !== null && query.error !== undefined) {
    return (
      <p className={styles.error}>
        {query.error instanceof Error ? query.error.message : "Missing files could not be loaded."}
      </p>
    );
  }
  if (query.data === undefined) {
    return <p className={styles.muted}>No missing files</p>;
  }
  const emptyMode = emptyModeFor(query.data, showDismissed);
  if (emptyMode !== null) {
    return <MissingEmptyState mode={emptyMode} onShowActive={toggleView} />;
  }
  return (
    <MissingResults
      page={query.data}
      pageNumber={currentPage}
      pageCount={pageCount}
      showDismissed={showDismissed}
      onToggleView={toggleView}
      onPreviousPage={() => setPage(Math.max(0, currentPage - 1))}
      onNextPage={() => setPage(Math.min(pageCount - 1, currentPage + 1))}
      onMutated={() => setPage(0)}
    />
  );
}
