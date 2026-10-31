import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { flushSync } from "react-dom";
import { useNavigate, type NavigateFunction } from "react-router-dom";
import type { CatalogSummary } from "@shared/contracts/drives";
import { useWorkspace } from "../../app/workspace";
import { usePhaseOneClient } from "../../lib/client-context";
import { queryKeys } from "../../lib/query-keys";
import { DriveDialogs } from "./DriveDialogs";
import { GateFooter, GateHeader, GateIntro, GateNotice, GatePromise } from "./DriveGateSections";
import { DriveList } from "./DriveList";
import type { DriveSelectionItem } from "./types";
import styles from "./DriveSelectionPage.module.css";

function errorText(error: unknown): string | null {
  if (error === null || error === undefined) {
    return null;
  }
  return error instanceof Error ? error.message : "Unexpected error";
}

function busyDriveId(
  openPending: boolean,
  openDrive: DriveSelectionItem | undefined,
  setupPending: boolean,
  setupDrive: DriveSelectionItem | undefined,
): string | null {
  if (!openPending && !setupPending) {
    return null;
  }
  return openDrive?.volumeId ?? setupDrive?.volumeId ?? null;
}

function driveWithCatalog(drive: DriveSelectionItem): DriveSelectionItem {
  return {
    ...drive,
    catalogStatus: "ready",
    indexedItemCount: 0,
    lastSeenAt: new Date().toISOString(),
  };
}

interface CompletionContext {
  queryClient: QueryClient;
  navigate: NavigateFunction;
  openWorkspace: (drive: DriveSelectionItem, catalog: CatalogSummary) => void;
}

function finishOpen(
  context: CompletionContext,
  drive: DriveSelectionItem,
  catalog: CatalogSummary,
): void {
  context.queryClient.removeQueries({ queryKey: ["library"] });
  // Flush the workspace before navigating so the route guard sees the catalog.
  flushSync(() => {
    context.openWorkspace(drive, catalog);
  });
  void context.navigate("/library");
}

function finishSetup(
  context: CompletionContext,
  drive: DriveSelectionItem,
  catalog: CatalogSummary,
  clearDialog: () => void,
): void {
  clearDialog();
  context.queryClient.removeQueries({ queryKey: ["library"] });
  flushSync(() => {
    context.openWorkspace(driveWithCatalog(drive), catalog);
  });
  void context.queryClient.invalidateQueries({ queryKey: queryKeys.drives });
  void context.navigate("/scan");
}

export function DriveSelectionPage(): React.JSX.Element {
  const client = usePhaseOneClient();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { openWorkspace } = useWorkspace();
  const [setupDrive, setSetupDrive] = useState<DriveSelectionItem | null>(null);
  const [letterDrive, setLetterDrive] = useState<DriveSelectionItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const drivesQuery = useQuery({ queryKey: queryKeys.drives, queryFn: () => client.listDrives() });
  const completion: CompletionContext = { queryClient, navigate, openWorkspace };

  const openMutation = useMutation({
    mutationFn: (drive: DriveSelectionItem) => client.openCatalog(drive.volumeId),
    onSuccess: (catalog, drive) => finishOpen(completion, drive, catalog),
  });

  const setupMutation = useMutation({
    mutationFn: async (drive: DriveSelectionItem) => {
      const catalog = await client.initializeCatalog(drive.volumeId);
      await client.startScan(drive.volumeId);
      return catalog;
    },
    onSuccess: (catalog, drive) =>
      finishSetup(completion, drive, catalog, () => setSetupDrive(null)),
  });

  const letterMutation = useMutation({
    mutationFn: (drive: DriveSelectionItem) => client.confirmDriveLetter(drive.volumeId),
    onSuccess: (_result, drive) => {
      setLetterDrive(null);
      setNotice(
        `Catalog root updated to ${drive.letter ?? "the current path"}. No original files were moved.`,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.drives });
    },
  });

  const busyVolumeId = busyDriveId(
    openMutation.isPending,
    openMutation.variables,
    setupMutation.isPending,
    setupMutation.variables,
  );

  function openSetup(drive: DriveSelectionItem): void {
    setupMutation.reset();
    setSetupDrive(drive);
  }

  function openLetter(drive: DriveSelectionItem): void {
    letterMutation.reset();
    setLetterDrive(drive);
  }

  function confirmSetup(): void {
    if (setupDrive !== null) {
      setupMutation.mutate(setupDrive);
    }
  }

  function confirmLetter(): void {
    if (letterDrive !== null) {
      letterMutation.mutate(letterDrive);
    }
  }

  return (
    <div className={styles.gate}>
      <GateHeader />
      <main className={styles.gateBody}>
        <GateIntro />
        <GateNotice notice={notice} error={errorText(openMutation.error)} />
        <DriveList
          drives={drivesQuery.data ?? []}
          loading={drivesQuery.isLoading}
          refreshing={drivesQuery.isFetching && !drivesQuery.isLoading}
          error={errorText(drivesQuery.error)}
          busyVolumeId={busyVolumeId}
          onRescan={() => void drivesQuery.refetch()}
          onOpen={(drive) => openMutation.mutate(drive)}
          onSetup={openSetup}
          onReviewLetter={openLetter}
        />
        <GatePromise />
        <GateFooter />
      </main>

      <DriveDialogs
        setupDrive={setupDrive}
        letterDrive={letterDrive}
        setupPending={setupMutation.isPending}
        letterPending={letterMutation.isPending}
        setupError={errorText(setupMutation.error)}
        letterError={errorText(letterMutation.error)}
        onCloseSetup={() => setSetupDrive(null)}
        onCloseLetter={() => setLetterDrive(null)}
        onConfirmSetup={confirmSetup}
        onConfirmLetter={confirmLetter}
      />
    </div>
  );
}
