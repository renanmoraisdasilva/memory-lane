import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { WorkspaceProvider, type WorkspaceSnapshot } from "../app/workspace";
import { PhaseOneClientProvider } from "../lib/client-context";
import type { PhaseOneClient } from "../lib/phase-one-client";

export interface RenderOptions {
  client: PhaseOneClient;
  workspace?: WorkspaceSnapshot | null;
  initialEntries?: string[];
}

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(ui: ReactElement, options: RenderOptions): RenderResult {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <PhaseOneClientProvider client={options.client}>
        <WorkspaceProvider initialWorkspace={options.workspace ?? null}>
          <MemoryRouter initialEntries={options.initialEntries ?? ["/"]}>{ui}</MemoryRouter>
        </WorkspaceProvider>
      </PhaseOneClientProvider>
    </QueryClientProvider>,
  );
}
