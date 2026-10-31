import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { libraryPath, viewerPath } from "./library-url";
import { MediaViewerStage, type ZoomMode } from "./MediaViewerStage";
import { useLibraryItemActions } from "./use-library";
import { ViewerDetails, type ViewerActionState } from "./ViewerDetails";
import type { LibraryDensity, LibraryFilter, LibraryItemDetails } from "./types";
import styles from "./MediaViewer.module.css";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.closest(
      "input, textarea, select, video, audio, [contenteditable='true'], [data-media-controls]",
    ) !== null
  );
}

export function MediaViewerPage({
  details,
  filter,
  density,
}: {
  details: LibraryItemDetails;
  filter: LibraryFilter;
  density: LibraryDensity;
}): React.JSX.Element {
  const navigate = useNavigate();
  const actions = useLibraryItemActions(details.item.fileId);
  const [zoom, setZoom] = useState<ZoomMode>("fit");
  const [mediaError, setMediaError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        void navigate(libraryPath(filter, density));
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }
      if (event.key === "ArrowLeft" && details.previousFileId !== null) {
        event.preventDefault();
        void navigate(viewerPath(details.previousFileId, filter, density));
      }
      if (event.key === "ArrowRight" && details.nextFileId !== null) {
        event.preventDefault();
        void navigate(viewerPath(details.nextFileId, filter, density));
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [density, details.nextFileId, details.previousFileId, filter, navigate]);

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

  const actionState: ViewerActionState = {
    revealPending: actions.reveal.isPending,
    openPending: actions.open.isPending,
    error: actions.reveal.error ?? actions.open.error,
    notice,
    onReveal: revealInExplorer,
    onOpen: openExternally,
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
    </div>
  );
}
