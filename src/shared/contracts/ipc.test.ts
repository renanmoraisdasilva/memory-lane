import { describe, expect, it } from "vitest";
import {
  AppDatabaseStateSchema,
  AppInfoSchema,
  InitializeCatalogParamsSchema,
  IPC_CHANNELS,
  OpenCatalogParamsSchema,
} from "./ipc";

const appInfo = {
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

describe("IPC contracts", () => {
  it("exposes stable channel names", () => {
    expect(IPC_CHANNELS.getAppInfo).toBe("app:get-info");
    expect(IPC_CHANNELS.listDrives).toBe("drives:list");
    expect(IPC_CHANNELS.initializeCatalog).toBe("catalog:initialize");
    expect(IPC_CHANNELS.openCatalog).toBe("catalog:open");
    expect(IPC_CHANNELS.confirmDriveIdentity).toBe("drives:confirm-identity");
    expect(IPC_CHANNELS.getScanState).toBe("scan:get-state");
    expect(IPC_CHANNELS.startScan).toBe("scan:start");
    expect(IPC_CHANNELS.pauseScan).toBe("scan:pause");
    expect(IPC_CHANNELS.resumeScan).toBe("scan:resume");
    expect(IPC_CHANNELS.setScanIntensity).toBe("scan:set-intensity");
    expect(IPC_CHANNELS.getLibrarySummary).toBe("library:get-summary");
    expect(IPC_CHANNELS.getLibraryTimeline).toBe("library:get-timeline");
    expect(IPC_CHANNELS.getLibraryTimelineIndex).toBe("library:get-timeline-index");
    expect(IPC_CHANNELS.getLibraryItem).toBe("library:get-item");
    expect(IPC_CHANNELS.getOtherFiles).toBe("library:get-other-files");
    expect(IPC_CHANNELS.getSettingsInfo).toBe("settings:get-info");
    expect(IPC_CHANNELS.clearCache).toBe("settings:clear-cache");
    expect(IPC_CHANNELS.runBackup).toBe("settings:run-backup");
    expect(IPC_CHANNELS.revealLibraryItem).toBe("shell:reveal-item");
    expect(IPC_CHANNELS.openLibraryItem).toBe("shell:open-item");
  });

  it("parses app info and database state", () => {
    expect(AppInfoSchema.parse(appInfo).database.state).toBe("ready");
    expect(AppDatabaseStateSchema.parse(appInfo.database).schemaVersion).toBe(1);
    expect(() => AppInfoSchema.parse({ ...appInfo, database: { state: "nope" } })).toThrow();
  });

  it("validates catalog params", () => {
    expect(InitializeCatalogParamsSchema.parse({ volumeId: "volume-1" }).volumeId).toBe("volume-1");
    expect(OpenCatalogParamsSchema.parse({ volumeId: "volume-1" }).volumeId).toBe("volume-1");
    expect(() => InitializeCatalogParamsSchema.parse({ volumeId: "" })).toThrow();
  });
});
