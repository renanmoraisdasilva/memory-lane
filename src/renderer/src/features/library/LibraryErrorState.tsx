import { AlertTriangle, HardDrive, RefreshCw } from "lucide-react";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import { EmptyState } from "../../components/ui/EmptyState";
import styles from "./LibraryPage.module.css";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The library could not be loaded.";
}

function isDriveUnavailable(error: unknown): boolean {
  if (!(error instanceof AppError)) {
    return false;
  }
  return (
    error.code === APP_ERROR_CODES.DRIVE_NOT_FOUND ||
    error.code === APP_ERROR_CODES.DRIVE_UNSUPPORTED ||
    error.code === APP_ERROR_CODES.CATALOG_NOT_FOUND
  );
}

export function LibraryErrorState({
  error,
  onRetry,
  onSwitchDrive,
}: {
  error: unknown;
  onRetry: () => void;
  onSwitchDrive?: () => void;
}): React.JSX.Element {
  const driveUnavailable = isDriveUnavailable(error);
  const title = driveUnavailable ? "Drive unavailable" : "Memory Lane couldn't load";
  const body = driveUnavailable
    ? "Reconnect the drive that holds this catalog, then retry."
    : errorMessage(error);

  return (
    <EmptyState
      icon={
        driveUnavailable ? (
          <HardDrive size={26} aria-hidden="true" />
        ) : (
          <AlertTriangle size={26} aria-hidden="true" />
        )
      }
      title={title}
      action={
        <div className={styles.errorActions}>
          <button className={styles.secondaryButton} type="button" onClick={onRetry}>
            <RefreshCw size={14} aria-hidden="true" />
            Retry
          </button>
          {onSwitchDrive === undefined ? null : (
            <button className={styles.secondaryButton} type="button" onClick={onSwitchDrive}>
              Switch drive
            </button>
          )}
        </div>
      }
    >
      {body}
    </EmptyState>
  );
}
