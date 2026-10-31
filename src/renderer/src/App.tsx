import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { WorkspaceProvider, useWorkspace } from "./app/workspace";
import { DriveSelectionPage } from "./features/drives/DriveSelectionPage";
import { ScanPage } from "./features/scan/ScanPage";
import { AppShell } from "./features/shell/AppShell";
import { PhaseOneClientProvider } from "./lib/client-context";
import { createDefaultPhaseOneClient, type PhaseOneClient } from "./lib/phase-one-client";

function DriveGateRoute(): React.JSX.Element {
  const { catalog } = useWorkspace();
  return catalog === null ? <DriveSelectionPage /> : <Navigate to="/scan" replace />;
}

function ScanRoute(): React.JSX.Element {
  const { catalog, drive } = useWorkspace();
  if (catalog === null || drive === null) {
    return <Navigate to="/" replace />;
  }
  return (
    <AppShell>
      <ScanPage />
    </AppShell>
  );
}

export function App({ client }: { client?: PhaseOneClient } = {}): React.JSX.Element {
  const [fallbackClient] = useState(createDefaultPhaseOneClient);
  return (
    <PhaseOneClientProvider client={client ?? fallbackClient}>
      <WorkspaceProvider>
        <Routes>
          <Route path="/" element={<DriveGateRoute />} />
          <Route path="/scan" element={<ScanRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </WorkspaceProvider>
    </PhaseOneClientProvider>
  );
}
