import { ArrowLeft, ChevronLeft, ChevronRight, Maximize2, ZoomIn } from "lucide-react";
import { Link } from "react-router-dom";
import { Pill } from "../../components/ui/Pill";
import { formatBytes, formatCount } from "../../lib/format";
import { formatLibraryDateValue } from "./date-format";
import { libraryPath, viewerPath } from "./library-url";
import { ViewerMedia } from "./ViewerMedia";
import type { ZoomMode } from "./ViewerMedia";
import type { LibraryDensity, LibraryFilter, LibraryItemDetails } from "./types";
import styles from "./MediaViewer.module.css";

export type { ZoomMode } from "./ViewerMedia";

function positionLabel(details: LibraryItemDetails): string {
  return `${formatCount(details.position)} of ${formatCount(details.total)}`;
}

function summaryMeta(details: LibraryItemDetails): string {
  const item = details.item;
  const parts = [formatLibraryDateValue(item.date), formatBytes(item.sizeBytes)];
  if (item.width !== null && item.height !== null) {
    parts.push(`${String(item.width)} × ${String(item.height)}`);
  }
  return parts.join(" · ");
}

function NavButton({
  fileId,
  label,
  filter,
  density,
  icon,
}: {
  fileId: number | null;
  label: string;
  filter: LibraryFilter;
  density: LibraryDensity;
  icon: React.JSX.Element;
}): React.JSX.Element {
  if (fileId === null) {
    return (
      <button className={styles.iconButton} type="button" aria-label={label} disabled>
        {icon}
      </button>
    );
  }
  return (
    <Link className={styles.iconButton} to={viewerPath(fileId, filter, density)} aria-label={label}>
      {icon}
    </Link>
  );
}

function StageHeader({
  details,
  filter,
  density,
}: {
  details: LibraryItemDetails;
  filter: LibraryFilter;
  density: LibraryDensity;
}): React.JSX.Element {
  return (
    <header className={styles.stageBar}>
      <div className={styles.stageHeading}>
        <Link
          className={styles.iconButton}
          to={libraryPath(filter, density)}
          aria-label="Back to Memory Lane"
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </Link>
        <div className={styles.stageTitle}>
          <h1>{details.item.name}</h1>
          <p>{summaryMeta(details)}</p>
        </div>
      </div>
      <div className={styles.stageNav}>
        <Pill tone="muted">{positionLabel(details)}</Pill>
        <NavButton
          fileId={details.previousFileId}
          label="Previous item"
          filter={filter}
          density={density}
          icon={<ChevronLeft size={16} aria-hidden="true" />}
        />
        <NavButton
          fileId={details.nextFileId}
          label="Next item"
          filter={filter}
          density={density}
          icon={<ChevronRight size={16} aria-hidden="true" />}
        />
      </div>
    </header>
  );
}

function StageControls({
  details,
  zoom,
  onZoom,
}: {
  details: LibraryItemDetails;
  zoom: ZoomMode;
  onZoom: (mode: ZoomMode) => void;
}): React.JSX.Element {
  return (
    <footer className={styles.stageControls}>
      {details.item.mediaClass === "image" ? (
        <div className={styles.zoomGroup} role="group" aria-label="Photo zoom" data-media-controls>
          <button
            className={`${styles.zoomButton}${zoom === "fit" ? ` ${styles.zoomButtonActive}` : ""}`}
            type="button"
            aria-pressed={zoom === "fit"}
            onClick={() => onZoom("fit")}
          >
            <Maximize2 size={14} aria-hidden="true" />
            Fit
          </button>
          <button
            className={`${styles.zoomButton}${zoom === "actual" ? ` ${styles.zoomButtonActive}` : ""}`}
            type="button"
            aria-pressed={zoom === "actual"}
            onClick={() => onZoom("actual")}
          >
            <ZoomIn size={14} aria-hidden="true" />
            100%
          </button>
        </div>
      ) : (
        <span className={styles.playbackNote}>In-app playback · read-only original</span>
      )}
      <span className={styles.readonlyNote}>Native controls · no transcoding</span>
    </footer>
  );
}

export function MediaViewerStage({
  details,
  filter,
  density,
  zoom,
  onZoom,
  mediaError,
  onMediaError,
  onOpen,
  openPending,
}: {
  details: LibraryItemDetails;
  filter: LibraryFilter;
  density: LibraryDensity;
  zoom: ZoomMode;
  onZoom: (mode: ZoomMode) => void;
  mediaError: boolean;
  onMediaError: () => void;
  onOpen: () => void;
  openPending: boolean;
}): React.JSX.Element {
  return (
    <section
      className={styles.stage}
      aria-label={`${details.item.mediaClass === "video" ? "Video" : "Photo"} viewer`}
    >
      <StageHeader details={details} filter={filter} density={density} />
      <ViewerMedia
        details={details}
        mediaError={mediaError}
        zoom={zoom}
        onMediaError={onMediaError}
        onOpen={onOpen}
        openPending={openPending}
      />
      <StageControls details={details} zoom={zoom} onZoom={onZoom} />
    </section>
  );
}
