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
    expect(IPC_CHANNELS.getScanState).toBe("scan:get-state");
    expect(IPC_CHANNELS.startScan).toBe("scan:start");
    expect(IPC_CHANNELS.pauseScan).toBe("scan:pause");
    expect(IPC_CHANNELS.resumeScan).toBe("scan:resume");
    expect(IPC_CHANNELS.setScanIntensity).toBe("scan:set-intensity");
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
