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

function isContractMissing(error: unknown): boolean {
  return (
    error instanceof AppError &&
    error.code === APP_ERROR_CODES.INTERNAL &&
    error.message.includes("library IPC contract")
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
  const contractMissing = isContractMissing(error);
  const title = driveUnavailable
    ? "Drive unavailable"
    : contractMissing
      ? "Library isn't connected yet"
      : "Memory Lane couldn't load";
  const body = contractMissing
    ? "The renderer is ready, but the Phase 2 library IPC bridge is not available in this build. Connect the shared library contract to load the timeline."
    : driveUnavailable
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
