import { contextBridge, ipcRenderer } from "electron";
import type { MemoryLaneApi } from "@shared/contracts/api";
import { IPC_CHANNELS } from "@shared/contracts/channels";
import type { CatalogSummary, DriveInfo } from "@shared/contracts/drives";
import type {
  AppInfo,
  ConfirmDriveIdentityParams,
  InitializeCatalogParams,
  IpcResult,
  OpenCatalogParams,
} from "@shared/contracts/ipc";
import type {
  ScanIntensityParams,
  ScanStartParams,
  ScanState,
  ScanVolumeParams,
} from "@shared/contracts/scan";

const api: MemoryLaneApi = {
  getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.getAppInfo) as Promise<IpcResult<AppInfo>>,
  listDrives: () => ipcRenderer.invoke(IPC_CHANNELS.listDrives) as Promise<IpcResult<DriveInfo[]>>,
  initializeCatalog: (params: InitializeCatalogParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.initializeCatalog, params) as Promise<
      IpcResult<CatalogSummary>
    >,
  openCatalog: (params: OpenCatalogParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.openCatalog, params) as Promise<IpcResult<CatalogSummary>>,
  confirmDriveIdentity: (params: ConfirmDriveIdentityParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.confirmDriveIdentity, params) as Promise<IpcResult<void>>,
  getScanState: (params: ScanVolumeParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.getScanState, params) as Promise<IpcResult<ScanState>>,
  startScan: (params: ScanStartParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.startScan, params) as Promise<IpcResult<ScanState>>,
  pauseScan: (params: ScanVolumeParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.pauseScan, params) as Promise<IpcResult<ScanState>>,
  resumeScan: (params: ScanVolumeParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.resumeScan, params) as Promise<IpcResult<ScanState>>,
  setScanIntensity: (params: ScanIntensityParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.setScanIntensity, params) as Promise<IpcResult<ScanState>>,
};

contextBridge.exposeInMainWorld("memoryLane", api);
