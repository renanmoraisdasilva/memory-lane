import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { libraryPath, viewerPath } from "./library-url";
import type { LibraryDensity, LibraryFilter, LibraryItemDetails } from "./types";

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

export function useViewerNavigation({
  details,
  filter,
  density,
  dateDialogOpen,
}: {
  details: LibraryItemDetails;
  filter: LibraryFilter;
  density: LibraryDensity;
  dateDialogOpen: boolean;
}): void {
  const navigate = useNavigate();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (dateDialogOpen) {
        return;
      }
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
  }, [dateDialogOpen, density, details.nextFileId, details.previousFileId, filter, navigate]);
}
