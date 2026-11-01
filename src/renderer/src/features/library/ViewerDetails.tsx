import { CalendarPlus, ExternalLink, FolderOpen, Info, ShieldCheck, Undo2 } from "lucide-react";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { Callout } from "../../components/ui/Callout";
import { Pill } from "../../components/ui/Pill";
import {
  formatBytes,
  formatDateTime,
  formatFrameRate,
  formatMediaDuration,
} from "../../lib/format";
import { formatDateSource, formatLibraryDateValue, formatPrecisionLabel } from "./date-format";
import type { LibraryItemDetails } from "./types";
import styles from "./MediaViewer.module.css";

export interface ViewerActionState {
  revealPending: boolean;
  openPending: boolean;
  datePending: boolean;
  error: unknown;
  dateError: unknown;
  notice: string | null;
  onReveal: () => void;
  onOpen: () => void;
  onSetDate: () => void;
  onClearDate: () => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The action could not be completed.";
}

function actionDisabledReason(error: unknown): string | null {
  if (error instanceof AppError && error.code === APP_ERROR_CODES.DRIVE_NOT_FOUND) {
    return "Reconnect the drive before opening or revealing this file.";
  }
  return null;
}

function DetailRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className={styles.kv}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function DateDetails({
  details,
  actions,
}: {
  details: LibraryItemDetails;
  actions: ViewerActionState;
}): React.JSX.Element {
  const { date } = details.item;
  return (
    <section className={styles.detailBlock} aria-labelledby="viewer-date-title">
      <h2 id="viewer-date-title" className={styles.detailLabel}>
        Catalog date
      </h2>
      <div className={styles.dateValue}>{formatLibraryDateValue(date)}</div>
      <div className={styles.dateMeta}>
        {formatPrecisionLabel(date.precision)} · {formatDateSource(date.source)}
      </div>
      {date.value === null ? (
        <p className={styles.dateHint}>
          No reliable date was found. Assign a year or year/month without inventing a day.
        </p>
      ) : null}
      <div className={styles.actionRow}>
        <button
          className={styles.secondaryButton}
          type="button"
          disabled={actions.datePending}
          onClick={actions.onSetDate}
        >
          <CalendarPlus size={14} aria-hidden="true" />
          Set date
        </button>
        {date.isOverride === true ? (
          <button
            className={styles.secondaryButton}
            type="button"
            disabled={actions.datePending}
            onClick={actions.onClearDate}
          >
            <Undo2 size={14} aria-hidden="true" />
            Clear manual date
          </button>
        ) : null}
      </div>
      {actions.dateError === null || actions.dateError === undefined ? null : (
        <p className={styles.actionError} role="alert">
          {errorMessage(actions.dateError)}
        </p>
      )}
    </section>
  );
}

function FileDetails({ details }: { details: LibraryItemDetails }): React.JSX.Element {
  const item = details.item;
  const duration = formatMediaDuration(item.durationSeconds);
  const frameRate = formatFrameRate(item.frameRate);
  return (
    <section className={styles.detailBlock} aria-labelledby="viewer-file-title">
      <h2 id="viewer-file-title" className={styles.detailLabel}>
        File
      </h2>
      <DetailRow
        label="Format"
        value={item.format ?? (item.mediaClass === "video" ? "Video" : "Image")}
      />
      <DetailRow label="Size" value={formatBytes(item.sizeBytes)} />
      {item.width !== null && item.height !== null ? (
        <DetailRow label="Dimensions" value={`${String(item.width)} × ${String(item.height)}`} />
      ) : null}
      {duration === null ? null : <DetailRow label="Duration" value={duration} />}
      {item.mediaClass === "video" ? (
        <DetailRow label="Frame rate" value={frameRate ?? "Not recorded"} />
      ) : null}
      <DetailRow label="Modified" value={formatDateTime(details.modifiedAtFs)} />
      {details.createdAtFs === null ? null : (
        <DetailRow label="Created" value={formatDateTime(details.createdAtFs)} />
      )}
    </section>
  );
}

function actionReason(disabled: boolean, error: unknown): string | null {
  if (disabled) {
    return "This file is not available on the connected drive.";
  }
  return actionDisabledReason(error);
}

function ActionButton({
  disabled,
  pending,
  idleLabel,
  pendingLabel,
  title,
  icon,
  onClick,
}: {
  disabled: boolean;
  pending: boolean;
  idleLabel: string;
  pendingLabel: string;
  title: string | undefined;
  icon: React.JSX.Element;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      className={styles.secondaryButton}
      type="button"
      disabled={disabled || pending}
      title={disabled ? title : undefined}
      onClick={onClick}
    >
      {icon}
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}

function LocationDetails({
  details,
  actions,
}: {
  details: LibraryItemDetails;
  actions: ViewerActionState;
}): React.JSX.Element {
  const disabled = details.item.isMissing;
  const reason = actionReason(disabled, actions.error);

  return (
    <section className={styles.detailBlock} aria-labelledby="viewer-location-title">
      <h2 id="viewer-location-title" className={styles.detailLabel}>
        Original location
      </h2>
      <div className={styles.pathBox}>{details.path}</div>
      <div className={styles.actionRow}>
        <ActionButton
          disabled={disabled}
          pending={actions.revealPending}
          idleLabel="Reveal in Explorer"
          pendingLabel="Revealing…"
          title="Reconnect the drive to reveal this file."
          icon={<FolderOpen size={14} aria-hidden="true" />}
          onClick={actions.onReveal}
        />
        <ActionButton
          disabled={disabled}
          pending={actions.openPending}
          idleLabel="Open externally"
          pendingLabel="Opening…"
          title="Reconnect the drive to open this file."
          icon={<ExternalLink size={14} aria-hidden="true" />}
          onClick={actions.onOpen}
        />
      </div>
      {reason === null ? null : <p className={styles.actionHint}>{reason}</p>}
      {actions.error === null ? null : (
        <p className={styles.actionError} role="alert">
          {errorMessage(actions.error)}
        </p>
      )}
      {actions.notice === null ? null : (
        <p className={styles.actionNotice} role="status">
          {actions.notice}
        </p>
      )}
    </section>
  );
}

function TechnicalMetadata({ details }: { details: LibraryItemDetails }): React.JSX.Element | null {
  if (details.metadata.length === 0) {
    return null;
  }
  return (
    <details className={styles.metadata}>
      <summary>Technical metadata ({details.metadata.length})</summary>
      <div className={styles.metadataList}>
        {details.metadata.map((entry) => (
          <DetailRow
            key={`${entry.key}-${entry.source}`}
            label={entry.key}
            value={`${entry.value} · ${entry.source}`}
          />
        ))}
      </div>
    </details>
  );
}

export function ViewerDetails({
  details,
  actions,
}: {
  details: LibraryItemDetails;
  actions: ViewerActionState;
}): React.JSX.Element {
  return (
    <aside className={styles.details} aria-label="Media details">
      <div className={styles.detailsHead}>
        <h2>Details</h2>
        <Pill tone="green" icon={<ShieldCheck size={11} aria-hidden="true" />}>
          Read-only
        </Pill>
      </div>
      <DateDetails details={details} actions={actions} />
      <FileDetails details={details} />
      <LocationDetails details={details} actions={actions} />
      <TechnicalMetadata details={details} />
      <Callout
        tone="neutral"
        icon={<Info size={17} aria-hidden="true" />}
        title="Catalog-only view"
      >
        Memory Lane reads the original file in place. It never moves, renames, edits, or deletes it.
      </Callout>
    </aside>
  );
}
