import { AlertTriangle, ImageOff, Play } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { formatBytes, formatMediaDuration } from "../../lib/format";
import { viewerPath } from "./library-url";
import type { LibraryDensity, LibraryFilter, LibraryItem } from "./types";
import styles from "./LibraryPage.module.css";

type ThumbnailState = "skeleton" | "ready" | "failed";

interface ThumbnailFlags {
  hasUrl: boolean;
  showSkeleton: boolean;
  showPlaceholder: boolean;
  state: ThumbnailState;
}

function thumbnailFlags(item: LibraryItem, loaded: boolean, failed: boolean): ThumbnailFlags {
  const isFailed = failed || item.thumbnailStatus === "failed";
  const hasUrl = item.thumbnailUrl !== null && !isFailed;
  const showSkeleton = item.thumbnailStatus === "pending" || (hasUrl && !loaded);
  const showPlaceholder = isFailed || (!hasUrl && item.thumbnailStatus !== "pending");
  const state: ThumbnailState = isFailed ? "failed" : showSkeleton ? "skeleton" : "ready";
  return { hasUrl, showSkeleton, showPlaceholder, state };
}

function tileLabel(item: LibraryItem): string {
  const kind = item.mediaClass === "video" ? "video" : "photo";
  const missing = item.isMissing ? ", missing file" : "";
  return `${item.name}, ${kind}${missing}`;
}

function ThumbnailSurface({
  item,
  loaded,
  failed,
  onLoad,
  onError,
}: {
  item: LibraryItem;
  loaded: boolean;
  failed: boolean;
  onLoad: () => void;
  onError: () => void;
}): React.JSX.Element {
  const flags = thumbnailFlags(item, loaded, failed);
  return (
    <>
      {flags.showSkeleton ? <span className={styles.thumbnailSkeleton} aria-hidden="true" /> : null}
      {flags.hasUrl ? (
        <img
          className={`${styles.tileImage}${loaded ? ` ${styles.tileImageReady}` : ""}`}
          src={item.thumbnailUrl ?? undefined}
          alt=""
          loading="lazy"
          decoding="async"
          width={item.width ?? 320}
          height={item.height ?? 200}
          onLoad={onLoad}
          onError={onError}
        />
      ) : null}
      {flags.showPlaceholder ? (
        <span className={styles.thumbnailPlaceholder}>
          <ImageOff size={24} aria-hidden="true" />
          <span>Preview unavailable</span>
        </span>
      ) : null}
    </>
  );
}

function TileOverlays({ item }: { item: LibraryItem }): React.JSX.Element {
  const duration = formatMediaDuration(item.durationSeconds);
  return (
    <>
      <span className={styles.tileTop}>
        {item.isMissing ? (
          <span className={styles.missingBadge}>
            <AlertTriangle size={11} aria-hidden="true" />
            Missing
          </span>
        ) : (
          <span />
        )}
        {item.mediaClass === "video" ? (
          <span className={styles.videoBadge}>
            <Play size={10} aria-hidden="true" />
            {duration ?? "Video"}
          </span>
        ) : null}
      </span>
      {item.mediaClass === "video" ? (
        <span className={styles.playGlyph} aria-hidden="true">
          <Play size={18} />
        </span>
      ) : null}
      <span className={styles.tileCaption}>
        <span className={styles.tileName}>{item.name}</span>
        <span className={styles.tileSub}>
          {formatBytes(item.sizeBytes)}
          {item.width !== null && item.height !== null
            ? ` · ${String(item.width)} × ${String(item.height)}`
            : ""}
        </span>
      </span>
    </>
  );
}

export function MediaTile({
  item,
  filter,
  density,
}: {
  item: LibraryItem;
  filter: LibraryFilter;
  density: LibraryDensity;
}): React.JSX.Element {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const flags = thumbnailFlags(item, loaded, failed);

  return (
    <Link
      className={styles.tile}
      to={viewerPath(item.fileId, filter, density)}
      aria-label={tileLabel(item)}
      data-thumbnail-state={flags.state}
    >
      <span className={styles.tileFrame}>
        <ThumbnailSurface
          item={item}
          loaded={loaded}
          failed={failed}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
        <TileOverlays item={item} />
      </span>
    </Link>
  );
}
