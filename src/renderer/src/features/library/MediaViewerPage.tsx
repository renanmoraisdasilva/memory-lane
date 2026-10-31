import { useState } from "react";
import { DateAssignmentDialog } from "./DateAssignmentDialog";
import { localDateParts } from "./date-format";
import { MediaViewerStage, type ZoomMode } from "./MediaViewerStage";
import { useClearLibraryDate, useLibraryItemActions, useSetLibraryDate } from "./use-library";
import { useViewerNavigation } from "./use-viewer-navigation";
import { ViewerDetails, type ViewerActionState } from "./ViewerDetails";
import type { LibraryDensity, LibraryFilter, LibraryItemDetails } from "./types";
import styles from "./MediaViewer.module.css";

export function MediaViewerPage({
  details,
  filter,
  density,
}: {
  details: LibraryItemDetails;
  filter: LibraryFilter;
  density: LibraryDensity;
}): React.JSX.Element {
  const actions = useLibraryItemActions(details.item.fileId);
  const setDate = useSetLibraryDate();
  const clearDate = useClearLibraryDate();
  const [zoom, setZoom] = useState<ZoomMode>("fit");
  const [mediaError, setMediaError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  useViewerNavigation({ details, filter, density, dateDialogOpen });

  function openExternally(): void {
    actions.open.mutate(undefined, {
      onSuccess: () => setNotice("Opened in the default Windows app."),
    });
  }

  function revealInExplorer(): void {
    actions.reveal.mutate(undefined, {
      onSuccess: () => setNotice("Revealed in Explorer."),
    });
  }

  function applyDate(year: number, month: number | null): void {
    setDate.mutate(
      { fileIds: [details.item.fileId], year, month },
      {
        onSuccess: () => {
          setDateDialogOpen(false);
          setNotice("Catalog date updated. Originals were not changed.");
        },
      },
    );
  }

  function clearManualDate(): void {
    clearDate.mutate(
      { fileIds: [details.item.fileId] },
      {
        onSuccess: () => setNotice("Manual date cleared. The extracted date was restored."),
      },
    );
  }

  const dateParts = localDateParts(details.item.date.value);
  const initialMonth = details.item.date.precision === "month" ? (dateParts?.month ?? null) : null;

  const actionState: ViewerActionState = {
    revealPending: actions.reveal.isPending,
    openPending: actions.open.isPending,
    datePending: setDate.isPending || clearDate.isPending,
    error: actions.reveal.error ?? actions.open.error,
    dateError: setDate.error ?? clearDate.error,
    notice,
    onReveal: revealInExplorer,
    onOpen: openExternally,
    onSetDate: () => setDateDialogOpen(true),
    onClearDate: clearManualDate,
  };

  return (
    <div className={styles.viewer}>
      <MediaViewerStage
        details={details}
        filter={filter}
        density={density}
        zoom={zoom}
        onZoom={setZoom}
        mediaError={mediaError}
        onMediaError={() => setMediaError(true)}
        onOpen={openExternally}
        openPending={actions.open.isPending}
      />
      <ViewerDetails details={details} actions={actionState} />
      {dateDialogOpen ? (
        <DateAssignmentDialog
          initialYear={dateParts?.year ?? null}
          initialMonth={initialMonth}
          pending={setDate.isPending}
          error={setDate.error}
          onClose={() => setDateDialogOpen(false)}
          onApply={applyDate}
        />
      ) : null}
    </div>
  );
}
