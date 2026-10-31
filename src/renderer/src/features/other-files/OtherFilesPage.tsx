import { useMemo, useState, type ReactNode } from "react";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  File,
  FileArchive,
  FileAudio,
  FileQuestion,
  FileSpreadsheet,
  FileText,
  FileType2,
  Files,
  FolderOpen,
  Presentation,
} from "lucide-react";
import type {
  OtherFile,
  OtherFileCategory,
  OtherFilesPage as OtherFilesPageData,
} from "@shared/contracts/other-files";
import { Alert } from "../../components/ui/Callout";
import { EmptyState } from "../../components/ui/EmptyState";
import { Pill } from "../../components/ui/Pill";
import { formatBytes, formatCount, formatDateTime } from "../../lib/format";
import { useFileActions, useOtherFiles } from "./use-other-files";
import styles from "./OtherFilesPage.module.css";

const PAGE_SIZE = 50;

const CATEGORY_LABELS: Record<OtherFileCategory, string> = {
  all: "All",
  documents: "Documents",
  spreadsheets: "Spreadsheets",
  presentations: "Presentations",
  pdfs: "PDFs",
  audio: "Audio",
  archives: "Archives",
  other: "Other",
};

const CATEGORY_OPTIONS: ReadonlyArray<{
  id: OtherFileCategory;
  label: string;
  icon: ReactNode;
}> = [
  { id: "all", label: "All", icon: <Files size={14} aria-hidden="true" /> },
  { id: "documents", label: "Documents", icon: <FileText size={14} aria-hidden="true" /> },
  {
    id: "spreadsheets",
    label: "Spreadsheets",
    icon: <FileSpreadsheet size={14} aria-hidden="true" />,
  },
  {
    id: "presentations",
    label: "Presentations",
    icon: <Presentation size={14} aria-hidden="true" />,
  },
  { id: "pdfs", label: "PDFs", icon: <FileType2 size={14} aria-hidden="true" /> },
  { id: "audio", label: "Audio", icon: <FileAudio size={14} aria-hidden="true" /> },
  { id: "archives", label: "Archives", icon: <FileArchive size={14} aria-hidden="true" /> },
  { id: "other", label: "Other", icon: <File size={14} aria-hidden="true" /> },
];

function CategoryChips({
  counts,
  selected,
  onSelect,
}: {
  counts: OtherFilesPageData["counts"];
  selected: OtherFileCategory;
  onSelect: (category: OtherFileCategory) => void;
}): React.JSX.Element {
  return (
    <div className={styles.chips} role="tablist" aria-label="Other file categories">
      {CATEGORY_OPTIONS.map((option) => (
        <button
          key={option.id}
          className={`${styles.chip}${selected === option.id ? ` ${styles.chipActive}` : ""}`}
          type="button"
          role="tab"
          aria-selected={selected === option.id}
          onClick={() => onSelect(option.id)}
        >
          {option.icon}
          {option.label}
          <span className={styles.chipCount}>{formatCount(counts[option.id])}</span>
        </button>
      ))}
    </div>
  );
}

function FileActions({
  file,
  disabled,
  onOpen,
  onReveal,
}: {
  file: OtherFile;
  disabled: boolean;
  onOpen: (fileId: number) => void;
  onReveal: (fileId: number) => void;
}): React.JSX.Element {
  if (file.state === "missing") {
    return <span className={styles.missingText}>Missing</span>;
  }
  return (
    <span className={styles.rowActions}>
      <button
        className={styles.iconButton}
        type="button"
        aria-label={`Open ${file.name}`}
        title="Open with the default application"
        disabled={disabled}
        onClick={() => onOpen(file.fileId)}
      >
        <ExternalLink size={14} aria-hidden="true" />
      </button>
      <button
        className={styles.iconButton}
        type="button"
        aria-label={`Reveal ${file.name} in Explorer`}
        title="Reveal in Explorer"
        disabled={disabled}
        onClick={() => onReveal(file.fileId)}
      >
        <FolderOpen size={14} aria-hidden="true" />
      </button>
    </span>
  );
}

function FileRow({
  file,
  disabled,
  onOpen,
  onReveal,
}: {
  file: OtherFile;
  disabled: boolean;
  onOpen: (fileId: number) => void;
  onReveal: (fileId: number) => void;
}): React.JSX.Element {
  return (
    <div className={styles.tableRow}>
      <span className={styles.fileCell}>
        <span className={styles.fileName}>{file.name}</span>
        <span className={styles.fileType}>{file.format ?? file.extension ?? "File"}</span>
      </span>
      <span className={styles.categoryCell}>{CATEGORY_LABELS[file.category]}</span>
      <span className={styles.folderCell} title={file.folder}>
        {file.folder}
      </span>
      <span className={styles.sizeCell}>{formatBytes(file.sizeBytes)}</span>
      <span className={styles.dateCell}>{formatDateTime(file.modifiedAtFs)}</span>
      <FileActions file={file} disabled={disabled} onOpen={onOpen} onReveal={onReveal} />
    </div>
  );
}

function FilesTable({
  data,
  openError,
  revealError,
  pendingFileId,
  onOpen,
  onReveal,
}: {
  data: OtherFilesPageData;
  openError: unknown;
  revealError: unknown;
  pendingFileId: number | null;
  onOpen: (fileId: number) => void;
  onReveal: (fileId: number) => void;
}): React.JSX.Element {
  return (
    <section className={styles.tableCard} aria-label="Other cataloged files">
      {openError === null || openError === undefined ? null : (
        <Alert>
          {openError instanceof Error ? openError.message : "The file could not be opened."}
        </Alert>
      )}
      {revealError === null || revealError === undefined ? null : (
        <Alert>
          {revealError instanceof Error ? revealError.message : "Explorer could not be opened."}
        </Alert>
      )}
      <div className={styles.tableHead}>
        <span>File</span>
        <span>Category</span>
        <span>Folder</span>
        <span>Size</span>
        <span>Modified</span>
        <span className={styles.actionsHead} />
      </div>
      {data.items.map((file) => (
        <FileRow
          key={file.fileId}
          file={file}
          disabled={pendingFileId === file.fileId}
          onOpen={onOpen}
          onReveal={onReveal}
        />
      ))}
    </section>
  );
}

function FilesPlaceholder({
  loading,
  error,
}: {
  loading: boolean;
  error: unknown;
}): React.JSX.Element | null {
  if (loading) {
    return <p className={styles.muted}>Loading other files…</p>;
  }
  if (error !== null && error !== undefined) {
    return (
      <Alert>{error instanceof Error ? error.message : "Other files could not be loaded."}</Alert>
    );
  }
  return null;
}

function EmptyFiles(): React.JSX.Element {
  return (
    <EmptyState
      icon={<FileQuestion size={26} aria-hidden="true" />}
      title="No files in this category"
      action={null}
    >
      Non-media files appear here after a scan. Memory Lane never moves, renames, edits, or deletes
      an original file.
    </EmptyState>
  );
}

function Pager({
  offset,
  total,
  onOffset,
}: {
  offset: number;
  total: number;
  onOffset: (offset: number) => void;
}): React.JSX.Element {
  const start = total === 0 ? 0 : offset + 1;
  const end = Math.min(offset + PAGE_SIZE, total);
  return (
    <nav className={styles.pager} aria-label="Other files pages">
      <span>
        {formatCount(start)}–{formatCount(end)} of {formatCount(total)}
      </span>
      <div className={styles.pagerButtons}>
        <button
          className={styles.secondaryButton}
          type="button"
          disabled={offset === 0}
          onClick={() => onOffset(Math.max(0, offset - PAGE_SIZE))}
        >
          <ChevronLeft size={14} aria-hidden="true" />
          Previous
        </button>
        <button
          className={styles.secondaryButton}
          type="button"
          disabled={offset + PAGE_SIZE >= total}
          onClick={() => onOffset(offset + PAGE_SIZE)}
        >
          Next
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

export function OtherFilesPage(): React.JSX.Element {
  const [category, setCategory] = useState<OtherFileCategory>("all");
  const [offset, setOffset] = useState(0);
  const query = useOtherFiles({ category, offset, limit: PAGE_SIZE });
  const actions = useFileActions();
  const pendingFileId = useMemo(() => {
    if (actions.open.isPending) {
      return actions.open.variables ?? null;
    }
    if (actions.reveal.isPending) {
      return actions.reveal.variables ?? null;
    }
    return null;
  }, [
    actions.open.isPending,
    actions.open.variables,
    actions.reveal.isPending,
    actions.reveal.variables,
  ]);

  function selectCategory(next: OtherFileCategory): void {
    setCategory(next);
    setOffset(0);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Catalog</div>
          <div className={styles.titleRow}>
            <h1>Other files</h1>
            <Pill tone="green" icon={<Archive size={11} aria-hidden="true" />}>
              Read-only
            </Pill>
          </div>
          <p className={styles.summary}>
            {query.data === undefined
              ? "Loading non-media files…"
              : `${formatCount(query.data.counts.all)} cataloged non-media files. Open or reveal them in Explorer; nothing is edited.`}
          </p>
        </div>
      </header>

      <CategoryChips
        counts={
          query.data?.counts ?? {
            all: 0,
            documents: 0,
            spreadsheets: 0,
            presentations: 0,
            pdfs: 0,
            audio: 0,
            archives: 0,
            other: 0,
          }
        }
        selected={category}
        onSelect={selectCategory}
      />

      <FilesPlaceholder loading={query.isLoading} error={query.error} />

      {query.data === undefined ? null : query.data.total === 0 ? (
        <EmptyFiles />
      ) : (
        <FilesTable
          data={query.data}
          openError={actions.open.error}
          revealError={actions.reveal.error}
          pendingFileId={pendingFileId}
          onOpen={(fileId) => actions.open.mutate(fileId)}
          onReveal={(fileId) => actions.reveal.mutate(fileId)}
        />
      )}

      {query.data === undefined ? null : (
        <Pager offset={offset} total={query.data.total} onOffset={setOffset} />
      )}
    </div>
  );
}
