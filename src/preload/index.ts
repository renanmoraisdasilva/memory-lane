import { contextBridge, ipcRenderer } from "electron";
import type { MemoryLaneApi } from "@shared/contracts/api";
import { IPC_CHANNELS } from "@shared/contracts/channels";
import type { CatalogSummary, DriveInfo } from "@shared/contracts/drives";
import type {
  AppInfo,
  InitializeCatalogParams,
  IpcResult,
  OpenCatalogParams,
} from "@shared/contracts/ipc";

const api: MemoryLaneApi = {
  getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.getAppInfo) as Promise<IpcResult<AppInfo>>,
  listDrives: () => ipcRenderer.invoke(IPC_CHANNELS.listDrives) as Promise<IpcResult<DriveInfo[]>>,
  initializeCatalog: (params: InitializeCatalogParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.initializeCatalog, params) as Promise<
      IpcResult<CatalogSummary>
    >,
  openCatalog: (params: OpenCatalogParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.openCatalog, params) as Promise<IpcResult<CatalogSummary>>,
};

contextBridge.exposeInMainWorld("memoryLane", api);
