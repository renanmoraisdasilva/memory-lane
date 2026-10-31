// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemoryLaneApi } from "@shared/contracts/api";
import type { CatalogSummary, DriveInfo } from "@shared/contracts/drives";
import { toVolumeId } from "@shared/contracts/drives";
import type { AppInfo, IpcResult } from "@shared/contracts/ipc";
import type { ScanState } from "@shared/contracts/scan";
import { FoundationPage } from "./FoundationPage";

const volumeId = toVolumeId("development-drive");

const appInfo: AppInfo = {
  appVersion: "0.1.0",
  electronVersion: "39.0.0",
  platform: "win32",
  isPackaged: false,
  userDataPath: "C:\\data",
  logPath: "C:\\data\\logs",
  database: {
    state: "ready",
    appDbPath: "C:\\data\\app.db",
    schemaVersion: 1,
  },
};

const drive: DriveInfo = {
  volumeId,
  label: "Development drive",
  letter: null,
  rootPath: "C:\\fixtures\\drive",
  fileSystem: "local",
  serialNumber: "development",
  totalBytes: 1024,
  freeBytes: 512,
  driveType: "development",
  isExternal: true,
  catalogStatus: "none",
  lastSeenAt: null,
};

const summary: CatalogSummary = {
  catalogPath: "C:\\fixtures\\drive\\.memorylane\\catalog.db",
  driveLabel: "Development drive",
  volumeId,
  schemaVersion: 1,
  fileCount: 0,
  openedAt: "2026-01-01T00:00:00.000Z",
};

function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data };
}

function createApi(overrides: Partial<MemoryLaneApi> = {}): MemoryLaneApi {
  const scanFailure = async (): Promise<IpcResult<ScanState>> => ({
    ok: false,
    error: { code: "SCAN_STATE_INVALID", message: "Not used by the foundation screen" },
  });
  const api: MemoryLaneApi = {
    getAppInfo: vi.fn(async () => ok(appInfo)),
    listDrives: vi.fn(async () => ok([drive])),
    initializeCatalog: vi.fn(async () => ok(summary)),
    openCatalog: vi.fn(async () => ok(summary)),
    getScanState: scanFailure,
    startScan: scanFailure,
    pauseScan: scanFailure,
    resumeScan: scanFailure,
    setScanIntensity: scanFailure,
  };
  return { ...api, ...overrides };
}

function installApi(api: MemoryLaneApi): void {
  Object.defineProperty(window, "memoryLane", {
    value: api,
    configurable: true,
  });
}

function renderPage(): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <FoundationPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  delete window.memoryLane;
});

describe("FoundationPage", () => {
  it("shows the app and creates a catalog", async () => {
    const api = createApi();
    installApi(api);
    renderPage();

    expect(await screen.findByText("Development drive")).toBeInTheDocument();
    expect(screen.getByText("Schema v1")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Create catalog/i }));

    expect(await screen.findByText(summary.catalogPath)).toBeInTheDocument();
    expect(api.initializeCatalog).toHaveBeenCalledWith({ volumeId });
  });

  it("shows a drive list error", async () => {
    const listDrives = vi.fn(async (): Promise<IpcResult<DriveInfo[]>> => ({
      ok: false,
      error: { code: "DRIVE_NOT_FOUND", message: "No drives available" },
    }));
    const api = createApi({ listDrives });
    installApi(api);
    renderPage();

    expect(await screen.findAllByText("No drives available")).not.toHaveLength(0);
  });

  it("opens an existing catalog", async () => {
    const readyDrive: DriveInfo = { ...drive, catalogStatus: "ready" };
    const listDrives = vi.fn(async (): Promise<IpcResult<DriveInfo[]>> => ok([readyDrive]));
    const api = createApi({ listDrives });
    installApi(api);
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /Open catalog/i }));

    expect(await screen.findByText(summary.catalogPath)).toBeInTheDocument();
    expect(api.openCatalog).toHaveBeenCalledWith({ volumeId });
  });
});
