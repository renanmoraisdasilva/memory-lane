import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { WorkspaceProvider, useWorkspace } from "./app/workspace";
import { DriveSelectionPage } from "./features/drives/DriveSelectionPage";
import { LibraryPage } from "./features/library/LibraryPage";
import { createLibraryClient, type LibraryClient } from "./features/library/library-client";
import { LibraryClientProvider } from "./features/library/library-client-context";
import { LibraryViewMemoryProvider } from "./features/library/library-view-memory";
import { UndatedPage } from "./features/library/UndatedPage";
import { ViewerShell } from "./features/library/ViewerShell";
import { HealthPage } from "./features/health/HealthPage";
import { OtherFilesPage } from "./features/other-files/OtherFilesPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { ScanPage } from "./features/scan/ScanPage";
import { AppShell } from "./features/shell/AppShell";
import { PhaseOneClientProvider } from "./lib/client-context";
import { createDefaultPhaseOneClient, type PhaseOneClient } from "./lib/phase-one-client";

function DriveGateRoute(): React.JSX.Element {
  const { catalog } = useWorkspace();
  return catalog === null ? <DriveSelectionPage /> : <Navigate to="/library" replace />;
}

function ScanRoute(): React.JSX.Element {
  const { catalog, drive } = useWorkspace();
  if (catalog === null || drive === null) {
    return <Navigate to="/" replace />;
  }
  return (
    <AppShell crumbs={["Library", "Scan & processing"]}>
      <ScanPage />
    </AppShell>
  );
}

function LibraryRoute(): React.JSX.Element {
  const { catalog, drive } = useWorkspace();
  if (catalog === null || drive === null) {
    return <Navigate to="/" replace />;
  }
  return (
    <AppShell mode="fill" crumbs={["Library", "Memory Lane"]}>
      <LibraryPage />
    </AppShell>
  );
}

function UndatedRoute(): React.JSX.Element {
  const { catalog, drive } = useWorkspace();
  if (catalog === null || drive === null) {
    return <Navigate to="/" replace />;
  }
  return (
    <AppShell crumbs={["Library", "Date unavailable"]}>
      <UndatedPage />
    </AppShell>
  );
}

function HealthRoute(): React.JSX.Element {
  const { catalog, drive } = useWorkspace();
  if (catalog === null || drive === null) {
    return <Navigate to="/" replace />;
  }
  return (
    <AppShell crumbs={["Library", "Library health"]}>
      <HealthPage />
    </AppShell>
  );
}

function OtherFilesRoute(): React.JSX.Element {
  const { catalog, drive } = useWorkspace();
  if (catalog === null || drive === null) {
    return <Navigate to="/" replace />;
  }
  return (
    <AppShell crumbs={["Library", "Other files"]}>
      <OtherFilesPage />
    </AppShell>
  );
}

function SettingsRoute(): React.JSX.Element {
  const { catalog, drive } = useWorkspace();
  if (catalog === null || drive === null) {
    return <Navigate to="/" replace />;
  }
  return (
    <AppShell crumbs={["System", "Settings"]}>
      <SettingsPage />
    </AppShell>
  );
}

function ViewerRoute(): React.JSX.Element {
  const { catalog, drive } = useWorkspace();
  if (catalog === null || drive === null) {
    return <Navigate to="/" replace />;
  }
  return <ViewerShell />;
}

export function App({
  client,
  libraryClient,
}: {
  client?: PhaseOneClient;
  libraryClient?: LibraryClient;
} = {}): React.JSX.Element {
  const [fallbackClient] = useState(createDefaultPhaseOneClient);
  const [fallbackLibraryClient] = useState(createLibraryClient);

  return (
    <PhaseOneClientProvider client={client ?? fallbackClient}>
      <LibraryClientProvider client={libraryClient ?? fallbackLibraryClient}>
        <WorkspaceProvider>
          <LibraryViewMemoryProvider>
            <Routes>
              <Route path="/" element={<DriveGateRoute />} />
              <Route path="/scan" element={<ScanRoute />} />
              <Route path="/library" element={<LibraryRoute />} />
              <Route path="/undated" element={<UndatedRoute />} />
              <Route path="/health" element={<HealthRoute />} />
              <Route path="/files" element={<OtherFilesRoute />} />
              <Route path="/settings" element={<SettingsRoute />} />
              <Route path="/library/item/:fileId" element={<ViewerRoute />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </LibraryViewMemoryProvider>
        </WorkspaceProvider>
      </LibraryClientProvider>
    </PhaseOneClientProvider>
  );
}
