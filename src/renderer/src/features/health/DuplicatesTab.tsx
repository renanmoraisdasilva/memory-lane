import { useQueryClient } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "../../components/ui/EmptyState";
import { formatCount } from "../../lib/format";
import { queryKeys } from "../../lib/query-keys";
import { DuplicateCleanupBar } from "./DuplicateCleanupBar";
import {
  CleanupCompleteDialog,
  CleanupConfirmDialog,
  CleanupProgressDialog,
} from "./DuplicateCleanupDialog";
import { DuplicateGroupCard } from "./DuplicateGroupCard";
import { skippedSummary } from "./duplicate-cleanup-labels";
import {
  useCancelCleanup,
  useCleanupState,
  useCleanupSummary,
  useHealthDuplicates,
  useRevealCleanupQuarantine,
  useStartCleanup,
} from "./use-health";
import styles from "./HealthPage.module.css";

type Dialog = "confirm" | "progress" | "complete" | null;

function shownDialog(dialog: Dialog, status: string): Dialog {
  if (status === "running") {
    return "progress";
  }
  if (dialog === "progress") {
    return status === "idle" ? "progress" : "complete";
  }
  return dialog;
}

function DuplicatePager({
  offset,
  limit,
  total,
  shown,
  summary,
  onOffset,
}: {
  offset: number;
  limit: number;
  total: number;
  shown: number;
  summary: ReturnType<typeof useCleanupSummary>["data"];
  onOffset: (offset: number) => void;
}): React.JSX.Element {
  const page = Math.floor(offset / limit) + 1;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  return (
    <>
      <p className={styles.cleanupFooterNote}>
        Showing {formatCount(offset + 1)}–{formatCount(offset + shown)} of {formatCount(total)}{" "}
        groups.{summary === undefined ? "" : ` ${skippedSummary(summary)}`}
      </p>
      <div className={styles.pagination}>
        <button
          className={styles.secondaryButton}
          type="button"
          disabled={offset === 0}
          onClick={() => onOffset(Math.max(0, offset - limit))}
        >
          Previous
        </button>
        <span className={styles.muted}>
          Page {page} of {pageCount}
        </span>
        <button
          className={styles.secondaryButton}
          type="button"
          disabled={offset + limit >= total}
          onClick={() => onOffset(offset + limit)}
        >
          Next
        </button>
      </div>
    </>
  );
}

function CleanupDialogs({
  dialog,
  summary,
  state,
  start,
  cancel,
  reveal,
  onDialog,
  onCloseCompletion,
}: {
  dialog: Dialog;
  summary: ReturnType<typeof useCleanupSummary>["data"];
  state: ReturnType<typeof useCleanupState>["data"];
  start: ReturnType<typeof useStartCleanup>;
  cancel: ReturnType<typeof useCancelCleanup>;
  reveal: ReturnType<typeof useRevealCleanupQuarantine>;
  onDialog: (dialog: Dialog) => void;
  onCloseCompletion: () => void;
}): React.JSX.Element | null {
  if (dialog === "confirm" && summary !== undefined) {
    return (
      <CleanupConfirmDialog
        summary={summary}
        pending={start.isPending}
        error={start.error}
        onClose={() => onDialog(null)}
        onStart={() =>
          start.mutate(undefined, {
            onSuccess: () => onDialog("progress"),
          })
        }
      />
    );
  }
  if (dialog === "progress" && state !== undefined) {
    return (
      <CleanupProgressDialog
        state={state}
        cancelling={cancel.isPending}
        onCancel={() => cancel.mutate()}
      />
    );
  }
  if (dialog === "complete" && state !== undefined) {
    return (
      <CleanupCompleteDialog
        state={state}
        revealing={reveal.isPending}
        onClose={onCloseCompletion}
        onReveal={() => reveal.mutate()}
      />
    );
  }
  return null;
}

export function DuplicatesTab({ limit }: { limit: number }): React.JSX.Element {
  const [offset, setOffset] = useState(0);
  const [dialog, setDialog] = useState<Dialog>(null);
  const queryClient = useQueryClient();
  const query = useHealthDuplicates({ offset, limit });
  const summary = useCleanupSummary();
  const cleanup = useCleanupState();
  const start = useStartCleanup();
  const cancel = useCancelCleanup();
  const reveal = useRevealCleanupQuarantine();
  const status = cleanup.data?.status ?? "idle";
  const visibleDialog = shownDialog(dialog, status);

  if (query.isLoading || summary.isLoading) {
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
        No two cataloged files share the same full SHA-256 hash. Duplicate detection stays
        informational until a verified keeper copy exists.
      </EmptyState>
    );
  }

  const total = query.data.totalGroups;
  const cleanupSummary = summary.data;

  return (
    <div className={styles.stack}>
      <DuplicateCleanupBar
        summary={cleanupSummary}
        error={summary.error}
        totalGroups={total}
        totalFiles={query.data.totalFiles}
        totalBytes={query.data.totalBytes}
        totalExcessBytes={query.data.totalExcessBytes}
        running={status === "running"}
        starting={start.isPending}
        onStart={() => setDialog("confirm")}
      />
      {query.data.groups.map((group) => (
        <DuplicateGroupCard group={group} key={group.groupId} />
      ))}
      <DuplicatePager
        offset={offset}
        limit={limit}
        total={total}
        shown={query.data.groups.length}
        summary={cleanupSummary}
        onOffset={setOffset}
      />
      <CleanupDialogs
        dialog={visibleDialog}
        summary={cleanupSummary}
        state={cleanup.data}
        start={start}
        cancel={cancel}
        reveal={reveal}
        onDialog={setDialog}
        onCloseCompletion={() => {
          setDialog(null);
          setOffset(0);
          void Promise.all([
            queryClient.invalidateQueries({ queryKey: ["health"], refetchType: "all" }),
            queryClient.invalidateQueries({ queryKey: ["library"], refetchType: "all" }),
            queryClient.invalidateQueries({ queryKey: ["replication"], refetchType: "all" }),
            queryClient.invalidateQueries({
              queryKey: queryKeys.cleanupSummary,
              refetchType: "all",
            }),
          ]);
        }}
      />
    </div>
  );
}
