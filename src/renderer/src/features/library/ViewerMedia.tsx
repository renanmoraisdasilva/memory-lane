import { useState } from "react";
import { Film, FolderOpen, Image as ImageIcon } from "lucide-react";
import { Callout } from "../../components/ui/Callout";
import { ProgressBar } from "../../components/ui/ProgressBar";
import type { LibraryItemDetails } from "./types";
import { useVideoProxy } from "./use-video-proxy";
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

function VideoPreparing({ progress }: { progress: number | null }): React.JSX.Element {
  return (
    <div className={styles.unavailable} role="status">
      <Film size={30} aria-hidden="true" />
      <h2>Preparing compatible playback</h2>
      <p>
        This video is being converted to a temporary MP4 copy. The original file stays untouched.
      </p>
      <div className={styles.proxyProgress}>
        <ProgressBar
          processed={progress ?? 0}
          total={progress === null ? null : 1}
          label="Video preparation progress"
        />
      </div>
    </div>
  );
}

function VideoPreparationFailed({
  detail,
  onOpen,
  openPending,
  onRetry,
}: {
  detail: string | null;
  onOpen: () => void;
  openPending: boolean;
  onRetry: () => void;
}): React.JSX.Element {
  return (
    <div className={styles.unavailable} role="status">
      <Film size={30} aria-hidden="true" />
      <h2>This video could not be prepared for playback</h2>
      <p>{detail ?? "The original file is still cataloged and untouched."}</p>
      <div className={styles.inlineActions}>
        <button className={styles.secondaryButton} type="button" onClick={onRetry}>
          Try again
        </button>
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
    </div>
  );
}

function needsProxy(fileName: string): boolean {
  const extension = fileName.toLowerCase().split(".").pop();
  return extension === "wmv" || extension === "3gp";
}

function DirectVideoStage({
  details,
  onError,
}: {
  details: LibraryItemDetails;
  onError: () => void;
}): React.JSX.Element {
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

function ProxyVideoStage({
  details,
  proxy,
  onOpen,
  openPending,
  onRetry,
  onPlaybackError,
}: {
  details: LibraryItemDetails;
  proxy: ReturnType<typeof useVideoProxy>;
  onOpen: () => void;
  openPending: boolean;
  onRetry: () => void;
  onPlaybackError: () => void;
}): React.JSX.Element {
  if (proxy?.status === "ready" && proxy.mediaUrl !== null) {
    return (
      <div className={styles.videoStage}>
        <video
          className={styles.video}
          src={proxy.mediaUrl}
          poster={details.item.thumbnailUrl ?? undefined}
          controls
          preload="metadata"
          data-media-controls
          onError={onPlaybackError}
        >
          <track kind="captions" />
          Your browser cannot play this compatible copy.
        </video>
      </div>
    );
  }
  if (proxy?.status === "failed") {
    return (
      <VideoPreparationFailed
        detail={proxy.errorMessage}
        onOpen={onOpen}
        openPending={openPending}
        onRetry={onRetry}
      />
    );
  }
  return <VideoPreparing progress={proxy?.progress ?? null} />;
}

function VideoStage({
  details,
  onOpen,
  openPending,
}: {
  details: LibraryItemDetails;
  onOpen: () => void;
  openPending: boolean;
}): React.JSX.Element {
  const [proxyActive, setProxyActive] = useState(() => needsProxy(details.item.name));
  const [proxyFailed, setProxyFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const proxy = useVideoProxy(details.item.fileId, proxyActive, retryKey);

  function retry(): void {
    setProxyFailed(false);
    setRetryKey((value) => value + 1);
  }

  if (proxyFailed) {
    return (
      <VideoPreparationFailed
        detail="The converted copy could not be played. Open the original in its default Windows app."
        onOpen={onOpen}
        openPending={openPending}
        onRetry={retry}
      />
    );
  }

  if (proxyActive) {
    return (
      <ProxyVideoStage
        details={details}
        proxy={proxy}
        onOpen={onOpen}
        openPending={openPending}
        onRetry={retry}
        onPlaybackError={() => setProxyFailed(true)}
      />
    );
  }

  return <DirectVideoStage details={details} onError={() => setProxyActive(true)} />;
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
        <VideoStage details={details} onOpen={onOpen} openPending={openPending} />
      ) : null}
    </div>
  );
}
