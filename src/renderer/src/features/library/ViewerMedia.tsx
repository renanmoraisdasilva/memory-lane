import { Film, FolderOpen, Image as ImageIcon } from "lucide-react";
import { Callout } from "../../components/ui/Callout";
import type { LibraryItemDetails } from "./types";
import styles from "./MediaViewer.module.css";

export type ZoomMode = "fit" | "actual";

function UnsupportedMedia({
  mediaClass,
  onOpen,
  openPending,
}: {
  mediaClass: "image" | "video";
  onOpen: () => void;
  openPending: boolean;
}): React.JSX.Element {
  return (
    <div className={styles.unavailable} role="status">
      {mediaClass === "video" ? (
        <Film size={30} aria-hidden="true" />
      ) : (
        <ImageIcon size={30} aria-hidden="true" />
      )}
      <h2>
        {mediaClass === "video"
          ? "This video format cannot be played here"
          : "This image cannot be displayed here"}
      </h2>
      <p>
        The original file is still cataloged and untouched. Open it in the default Windows app to
        view it.
      </p>
      <button
        className={styles.secondaryButton}
        type="button"
        disabled={openPending}
        onClick={onOpen}
      >
        <FolderOpen size={14} aria-hidden="true" />
        {openPending ? "Opening…" : "Open externally"}
      </button>
    </div>
  );
}

function PhotoStage({
  details,
  mediaError,
  zoom,
  onError,
  onOpen,
  openPending,
}: {
  details: LibraryItemDetails;
  mediaError: boolean;
  zoom: ZoomMode;
  onError: () => void;
  onOpen: () => void;
  openPending: boolean;
}): React.JSX.Element {
  if (mediaError) {
    return <UnsupportedMedia mediaClass="image" onOpen={onOpen} openPending={openPending} />;
  }
  return (
    <div
      className={`${styles.imageStage}${zoom === "actual" ? ` ${styles.imageStageActual}` : ""}`}
    >
      <img
        className={styles.photo}
        src={details.mediaUrl ?? undefined}
        alt={details.item.name}
        width={details.item.width ?? undefined}
        height={details.item.height ?? undefined}
        onError={onError}
      />
    </div>
  );
}

function VideoStage({
  details,
  mediaError,
  onError,
  onOpen,
  openPending,
}: {
  details: LibraryItemDetails;
  mediaError: boolean;
  onError: () => void;
  onOpen: () => void;
  openPending: boolean;
}): React.JSX.Element {
  if (mediaError) {
    return <UnsupportedMedia mediaClass="video" onOpen={onOpen} openPending={openPending} />;
  }
  return (
    <div className={styles.videoStage}>
      {details.item.thumbnailUrl === null ? (
        <span className={styles.videoPlaceholder}>
          <Film size={16} aria-hidden="true" />
          Thumbnail unavailable
        </span>
      ) : null}
      <video
        className={styles.video}
        src={details.mediaUrl ?? undefined}
        poster={details.item.thumbnailUrl ?? undefined}
        controls
        preload="metadata"
        data-media-controls
        onError={onError}
      >
        <track kind="captions" />
        Your browser cannot play this video.
      </video>
    </div>
  );
}

export function ViewerMedia({
  details,
  mediaError,
  zoom,
  onMediaError,
  onOpen,
  openPending,
}: {
  details: LibraryItemDetails;
  mediaError: boolean;
  zoom: ZoomMode;
  onMediaError: () => void;
  onOpen: () => void;
  openPending: boolean;
}): React.JSX.Element {
  const missing = details.item.isMissing;
  const mediaUnavailable = details.mediaUrl === null;
  return (
    <div className={styles.mediaArea}>
      {missing ? (
        <Callout tone="red" title="File missing" icon={<ImageIcon size={18} aria-hidden="true" />}>
          This file is missing from the connected drive. Its metadata remains available, and the
          original path is unchanged. Reconnect the drive and retry.
        </Callout>
      ) : null}
      {!missing && mediaUnavailable ? (
        <Callout
          tone="amber"
          title="Media unavailable"
          icon={<ImageIcon size={18} aria-hidden="true" />}
        >
          The file is cataloged but cannot be read right now. Reconnect the drive or open it
          externally.
        </Callout>
      ) : null}
      {!missing && !mediaUnavailable && details.item.mediaClass === "image" ? (
        <PhotoStage
          details={details}
          mediaError={mediaError}
          zoom={zoom}
          onError={onMediaError}
          onOpen={onOpen}
          openPending={openPending}
        />
      ) : null}
      {!missing && !mediaUnavailable && details.item.mediaClass === "video" ? (
        <VideoStage
          details={details}
          mediaError={mediaError}
          onError={onMediaError}
          onOpen={onOpen}
          openPending={openPending}
        />
      ) : null}
    </div>
  );
}
