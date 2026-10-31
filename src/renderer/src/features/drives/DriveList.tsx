import { RefreshCw } from "lucide-react";
import { DriveOptionCard } from "./DriveOptionCard";
import {
  DriveEmptyState,
  DriveListError,
  DrivesLoading,
  UnsupportedDriveCallout,
} from "./DriveGateSections";
import { isSupportedDrive, type DriveSelectionItem } from "./types";
import styles from "./DriveSelectionPage.module.css";

function driveCountLabel(count: number): string {
  if (count === 0) {
    return "No drives yet";
  }
  return `${count} ${count === 1 ? "drive" : "drives"} visible`;
}

function supportedConnectedCount(drives: DriveSelectionItem[]): number {
  return drives.filter((drive) => isSupportedDrive(drive) && drive.connection === "connected")
    .length;
}

function DriveListFeedback({
  drives,
  loading,
  error,
  onRescan,
}: {
  drives: DriveSelectionItem[];
  loading: boolean;
  error: string | null;
  onRescan: () => void;
}): React.JSX.Element | null {
  if (error !== null) {
    return <DriveListError message={error} onRescan={onRescan} />;
  }
  if (loading) {
    return <DrivesLoading />;
  }
  if (drives.length === 0) {
    return <DriveEmptyState onRescan={onRescan} />;
  }
  if (supportedConnectedCount(drives) === 0) {
    return <UnsupportedDriveCallout />;
  }
  return null;
}

export interface DriveListProps {
  drives: DriveSelectionItem[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  busyVolumeId: string | null;
  onRescan: () => void;
  onOpen: (drive: DriveSelectionItem) => void;
  onSetup: (drive: DriveSelectionItem) => void;
  onReviewLetter: (drive: DriveSelectionItem) => void;
}

export function DriveList({
  drives,
  loading,
  refreshing,
  error,
  busyVolumeId,
  onRescan,
  onOpen,
  onSetup,
  onReviewLetter,
}: DriveListProps): React.JSX.Element {
  return (
    <section aria-labelledby="available-drives">
      <div className={styles.listHeader}>
        <div>
          <div className={styles.eyebrow}>Detected volumes</div>
          <h2 id="available-drives">{driveCountLabel(drives.length)}</h2>
        </div>
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={onRescan}
          disabled={loading || refreshing}
        >
          <RefreshCw
            size={14}
            aria-hidden="true"
            className={refreshing ? styles.spinning : undefined}
          />
          {refreshing ? "Scanning…" : "Rescan drives"}
        </button>
      </div>

      <DriveListFeedback drives={drives} loading={loading} error={error} onRescan={onRescan} />

      <div className={styles.driveList}>
        {loading
          ? null
          : drives.map((drive) => (
              <DriveOptionCard
                key={drive.volumeId}
                drive={drive}
                busy={busyVolumeId === drive.volumeId}
                onOpen={onOpen}
                onSetup={onSetup}
                onReviewLetter={onReviewLetter}
              />
            ))}
      </div>
    </section>
  );
}
