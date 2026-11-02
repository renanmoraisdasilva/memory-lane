import { AlertTriangle, CheckCircle2, EyeOff, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { MissingFile, MissingFilesPage } from "@shared/contracts/health";
import { EmptyState } from "../../components/ui/EmptyState";
import { formatBytes, formatCount, formatDateTime } from "../../lib/format";
import { useDismissMissing, useHealthMissing, useRestoreMissing } from "./use-health";
import styles from "./HealthPage.module.css";

const MISSING_LIMIT = 100;

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

function ToolbarNote({
  page,
  showDismissed,
}: {
  page: MissingFilesPage;
  showDismissed: boolean;
}): React.JSX.Element {
  const message = showDismissed
    ? "Restoring brings these files back into the missing list. Catalog rows are never deleted."
    : "Disregarding hides the selected files from the health report and dismisses their pending move suggestions. Files on the archive and backup drives are not changed.";
  const hidden =
    page.total > page.items.length
      ? ` Showing the first ${formatCount(page.items.length)} of ${formatCount(page.total)}; Select all still covers every matching file.`
      : "";
  return (
    <p className={styles.tableNote}>
      {message}
      {hidden}
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
      <ToolbarNote page={page} showDismissed={showDismissed} />
      <ToolbarError error={error} />
    </div>
  );
}

function MissingResults({
  page,
  showDismissed,
  onToggleView,
}: {
  page: MissingFilesPage;
  showDismissed: boolean;
  onToggleView: () => void;
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
    dismiss.mutate({ fileIds: [...selected] }, { onSuccess: () => setSelected(new Set()) });
  }

  function restoreSelected(): void {
    restore.mutate({ fileIds: [...selected] }, { onSuccess: () => setSelected(new Set()) });
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
    </section>
  );
}

export function MissingFiles(): React.JSX.Element {
  const [showDismissed, setShowDismissed] = useState(false);
  const query = useHealthMissing({ limit: MISSING_LIMIT, dismissedOnly: showDismissed });

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
  if (showDismissed && query.data.total === 0) {
    return (
      <section className={styles.tableCard} aria-label="Missing files">
        <p className={styles.muted}>No disregarded missing files.</p>
        <div className={styles.actions}>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => setShowDismissed(false)}
          >
            Back to active missing files
          </button>
        </div>
      </section>
    );
  }
  if (query.data.total === 0 && query.data.dismissedTotal === 0) {
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
    <MissingResults
      page={query.data}
      showDismissed={showDismissed}
      onToggleView={() => setShowDismissed((current) => !current)}
    />
  );
}
