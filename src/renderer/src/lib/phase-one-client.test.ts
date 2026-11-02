// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemoryLaneApi } from "@shared/contracts/api";
import type { CatalogSummary, DriveInfo } from "@shared/contracts/drives";
import { toVolumeId } from "@shared/contracts/drives";
import type { AppInfo, IpcResult } from "@shared/contracts/ipc";
import type { ScanState as SharedScanState } from "@shared/contracts/scan";
import { AppError } from "@shared/domain/errors";
import { createDefaultPhaseOneClient } from "./phase-one-client";
import { createScanFixture } from "./mock-scan-fixtures";

const volumeId = toVolumeId("volume-1");
const otherVolumeId = toVolumeId("volume-2");

const appInfo: AppInfo = {
  appVersion: "0.1.0",
  electronVersion: "42.11.18",
  platform: "win32",
  isPackaged: false,
  userDataPath: "C:\\data",
  logPath: "C:\\data\\logs",
  database: { state: "ready", appDbPath: "C:\\data\\app.db", schemaVersion: 2 },
};

const summary: CatalogSummary = {
  catalogPath: "F:\\.memorylane\\catalog.db",
  driveLabel: "Archive",
  volumeId,
  schemaVersion: 7,
  fileCount: 3,
  openedAt: "2026-10-31T14:00:00.000Z",
};

const connected: DriveInfo = {
  volumeId,
  label: "Archive",
  letter: "F:",
  rootPath: "F:\\",
  fileSystem: "NTFS",
  serialNumber: "SERIAL-1",
  totalBytes: 1_000,
  freeBytes: 500,
  driveType: "removable",
  isExternal: true,
  catalogStatus: "ready",
  lastSeenAt: "2026-10-31T14:00:00.000Z",
  isConnected: true,
  lastLetter: "E:",
  lastScanAt: "2026-10-31T13:00:00.000Z",
  indexedFiles: 3,
  requiresLetterConfirmation: true,
};

const offline: DriveInfo = {
  volumeId: otherVolumeId,
  label: "Offline archive",
  letter: "G:",
  rootPath: "G:\\",
  fileSystem: "NTFS",
  serialNumber: "SERIAL-2",
  totalBytes: 0,
  freeBytes: 0,
  driveType: "unknown",
  isExternal: true,
  catalogStatus: "registered",
  lastSeenAt: "2026-10-30T14:00:00.000Z",
  isConnected: false,
  lastLetter: "G:",
  lastScanAt: null,
  indexedFiles: 9,
  requiresLetterConfirmation: false,
};

function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data };
}

function createApi(): MemoryLaneApi {
  const scanState: SharedScanState = {
    ...createScanFixture("active", "Archive", volumeId),
    errorMessage: null,
  };
  const libraryFailure = async (): Promise<IpcResult<never>> => ({
    ok: false,
    error: { code: "INVALID_REQUEST", message: "Not used by the Phase 1 client test" },
  });
  return {
    getAppInfo: vi.fn(async () => ok(appInfo)),
    listDrives: vi.fn(async () => ok([connected, offline])),
    initializeCatalog: vi.fn(async () => ok(summary)),
    openCatalog: vi.fn(async () => ok(summary)),
    confirmDriveIdentity: vi.fn(async () => ok(undefined)),
    getScanState: vi.fn(async () => ok(scanState)),
    startScan: vi.fn(async () => ok(scanState)),
    pauseScan: vi.fn(async () => ok(scanState)),
    resumeScan: vi.fn(async () => ok(scanState)),
    setScanIntensity: vi.fn(async () => ok(scanState)),
    getLibrarySummary: libraryFailure,
    getLibraryTimeline: libraryFailure,
    getLibraryTimelineIndex: libraryFailure,
    getLibraryItem: libraryFailure,
    getLibraryUndated: libraryFailure,
    getOtherFiles: libraryFailure,
    setLibraryDate: libraryFailure,
    clearLibraryDate: libraryFailure,
    getHealthSummary: libraryFailure,
    getHealthDuplicates: libraryFailure,
    getHealthMissing: libraryFailure,
    getHealthMissingDuplicates: libraryFailure,
    purgeHealthMissingDuplicates: libraryFailure,
    dismissHealthMissing: libraryFailure,
    restoreHealthMissing: libraryFailure,
    getHealthMoved: libraryFailure,
    confirmHealthMoved: libraryFailure,
    dismissHealthMoved: libraryFailure,
    getValidationState: libraryFailure,
    startValidation: libraryFailure,
    pauseValidation: libraryFailure,
    resumeValidation: libraryFailure,
    getSettingsInfo: libraryFailure,
    clearCache: libraryFailure,
    runBackup: libraryFailure,
    revealLibraryItem: libraryFailure,
    openLibraryItem: libraryFailure,
    getVideoProxyState: libraryFailure,
    prepareVideoProxy: libraryFailure,
    replication: {
      getOverview: libraryFailure,
      listDestinationCandidates: vi.fn(async () => ok([])),
      listDestinations: vi.fn(async () => ok([])),
      getDestination: libraryFailure,
      registerDestination: libraryFailure,
      updateDestination: libraryFailure,
      getAdoptionState: libraryFailure,
      getActiveAdoptions: vi.fn(async () => ok([])),
      startAdoption: libraryFailure,
      pauseAdoption: libraryFailure,
      resumeAdoption: libraryFailure,
      getPlan: libraryFailure,
      getCoverage: libraryFailure,
      getRunState: vi.fn(async () => ok(null)),
      startRun: libraryFailure,
      pauseRun: libraryFailure,
      resumeRun: libraryFailure,
      requestStop: libraryFailure,
      replan: vi.fn(async () => ok(null)),
      getRunEvents: libraryFailure,
      getPromotion: libraryFailure,
      verifyPromotion: libraryFailure,
      applyPromotion: libraryFailure,
      rollbackPromotion: libraryFailure,
    },
  };
}

function installApi(api: MemoryLaneApi): void {
  Object.defineProperty(window, "memoryLane", { value: api, configurable: true });
}

afterEach(() => {
  delete window.memoryLane;
});

describe("default Phase 1 client", () => {
  it("maps real drive connectivity, stats, and letter changes", async () => {
    const api = createApi();
    installApi(api);
    const client = createDefaultPhaseOneClient();

    const drives = await client.listDrives();
    expect(drives[0]).toMatchObject({
      connection: "connected",
      indexedItemCount: 3,
      lastScanAt: "2026-10-31T13:00:00.000Z",
      pendingLetterChange: {
        previousLetter: "E:",
        newLetter: "F:",
        previousRootPath: "E:\\.memorylane\\catalog.db",
        newRootPath: "F:\\.memorylane\\catalog.db",
      },
    });
    expect(drives[1]).toMatchObject({
      connection: "offline",
      indexedItemCount: 9,
      pendingLetterChange: null,
    });
  });

  it("wraps catalog, identity, and scan IPC calls", async () => {
    const api = createApi();
    installApi(api);
    const client = createDefaultPhaseOneClient();

    await expect(client.getAppInfo()).resolves.toEqual(appInfo);
    await expect(client.initializeCatalog(volumeId)).resolves.toEqual(summary);
    await expect(client.openCatalog(volumeId)).resolves.toEqual(summary);
    await expect(client.confirmDriveLetter(volumeId)).resolves.toBeUndefined();
    await expect(client.getScanState(volumeId)).resolves.toMatchObject({ status: "active" });
    await expect(client.startScan(volumeId, "eco")).resolves.toMatchObject({ status: "active" });
    await expect(client.pauseScan(volumeId)).resolves.toMatchObject({ status: "active" });
    await expect(client.resumeScan(volumeId)).resolves.toMatchObject({ status: "active" });
    await expect(client.setScanIntensity(volumeId, "max")).resolves.toMatchObject({
      status: "active",
    });

    expect(api.confirmDriveIdentity).toHaveBeenCalledWith({ volumeId });
    expect(api.startScan).toHaveBeenCalledWith({ volumeId, intensity: "eco" });
    expect(api.pauseScan).toHaveBeenCalledWith({ volumeId });
    expect(api.resumeScan).toHaveBeenCalledWith({ volumeId });
    expect(api.setScanIntensity).toHaveBeenCalledWith({ volumeId, intensity: "max" });
  });

  it("surfaces bridge errors as AppError", async () => {
    const api = createApi();
    api.listDrives = vi.fn(async () => ({
      ok: false as const,
      error: { code: "DRIVE_NOT_FOUND" as const, message: "No drives" },
    }));
    installApi(api);

    await expect(createDefaultPhaseOneClient().listDrives()).rejects.toBeInstanceOf(AppError);
  });
});
