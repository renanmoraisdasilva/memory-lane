import { AlertTriangle, RefreshCw } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import type { CatalogSummary } from "@shared/contracts/drives";
import { useWorkspace } from "../../app/workspace";
import { Alert, Spinner } from "../../components/ui/Callout";
import { EmptyState } from "../../components/ui/EmptyState";
import type { DriveSelectionItem } from "../drives/types";
import { CompleteState } from "./ScanCompleteState";
import { ScanIdleState } from "./ScanIdleState";
import { ScanLiveState } from "./ScanLiveState";
import { PageHeader } from "./ScanPageHeader";
import type { ScanState, ScanStatus } from "./types";
import { useScanActions, useScanState } from "./use-scan";
import styles from "./ScanPage.module.css";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The drive could not be reached.";
}

function scanStatus(state: ScanState | null): ScanStatus {
  return state?.status ?? "idle";
}

function firstMutationError(errors: Array<Error | null>): Error | null {
  return errors.find((error): error is Error => error !== null) ?? null;
}

function ScanUnavailable({
  message,
  onRetry,
  onSwitchDrive,
}: {
  message: string;
  onRetry: () => void;
  onSwitchDrive: () => void;
}): React.JSX.Element {
  return (
    <EmptyState
      icon={<AlertTriangle size={26} aria-hidden="true" />}
      title="Drive unavailable"
      action={
        <div className={styles.errorActions}>
          <button className={styles.secondaryButton} type="button" onClick={onRetry}>
            <RefreshCw size={14} aria-hidden="true" />
            Retry status
          </button>
          <button className={styles.secondaryButton} type="button" onClick={onSwitchDrive}>
            Switch drive
          </button>
        </div>
      }
    >
      {message} Reconnect the drive, then retry. Catalog records and saved stage progress are
      retained.
    </EmptyState>
  );
}

function ScanStateView({
  state,
  drive,
  catalog,
  actions,
  onRetry,
  onSwitchDrive,
}: {
  state: ScanState | null;
  drive: DriveSelectionItem;
  catalog: CatalogSummary;
  actions: ReturnType<typeof useScanActions>;
  onRetry: () => void;
  onSwitchDrive: () => void;
}): React.JSX.Element {
  if (state === null || state.status === "idle") {
    return (
      <ScanIdleState
        drive={drive}
        catalog={catalog}
        intensity={state?.intensity ?? "balanced"}
        intensityPending={actions.intensity.isPending}
        startPending={actions.start.isPending}
        onStart={() => actions.start.mutate()}
        onIntensity={(value) => actions.intensity.mutate(value)}
      />
    );
  }

  if (state.status === "complete") {
    return (
      <CompleteState
        drive={drive}
        catalog={catalog}
        state={state}
        startPending={actions.start.isPending}
        onStart={() => actions.start.mutate()}
      />
    );
  }

  return (
    <ScanLiveState
      state={state}
      drive={drive}
      catalogPath={catalog.catalogPath}
      intensityPending={actions.intensity.isPending}
      pausePending={actions.pause.isPending}
      resumePending={actions.resume.isPending}
      onPause={() => actions.pause.mutate()}
      onResume={() => actions.resume.mutate()}
      onIntensity={(value) => actions.intensity.mutate(value)}
      onRetry={onRetry}
      onSwitchDrive={onSwitchDrive}
    />
  );
}

function ScanPageContent({
  drive,
  catalog,
}: {
  drive: DriveSelectionItem;
  catalog: CatalogSummary;
}): React.JSX.Element {
  const navigate = useNavigate();
  const { closeWorkspace } = useWorkspace();
  const scanQuery = useScanState(drive.volumeId);
  const actions = useScanActions(drive.volumeId);
  const state = scanQuery.data ?? null;
  const status = scanStatus(state);
  const mutationError = firstMutationError([
    actions.start.error,
    actions.pause.error,
    actions.resume.error,
    actions.intensity.error,
  ]);

  const switchDrive = (): void => {
    closeWorkspace();
    void navigate("/");
  };

  if (scanQuery.isLoading) {
    return (
      <div className={styles.page}>
        <PageHeader drive={drive} status="idle" />
        <div className={styles.loadingPanel} role="status">
          <Spinner />
          Checking scan status…
        </div>
      </div>
    );
  }

  if (scanQuery.isError) {
    return (
      <div className={styles.page}>
        <PageHeader drive={drive} status="error" />
        <ScanUnavailable
          message={errorMessage(scanQuery.error)}
          onRetry={() => void scanQuery.refetch()}
          onSwitchDrive={switchDrive}
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <PageHeader drive={drive} status={status} />
      {mutationError === null ? null : <Alert>{errorMessage(mutationError)}</Alert>}
      <ScanStateView
        state={state}
        drive={drive}
        catalog={catalog}
        actions={actions}
        onRetry={() => void scanQuery.refetch()}
        onSwitchDrive={switchDrive}
      />
    </div>
  );
}

export function ScanPage(): React.JSX.Element {
  const { drive, catalog } = useWorkspace();
  if (drive === null || catalog === null) {
    return <Navigate to="/" replace />;
  }
  return <ScanPageContent drive={drive} catalog={catalog} />;
}
