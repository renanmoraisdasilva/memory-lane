import { ipcMain } from "electron";
import { IPC_CHANNELS } from "@shared/contracts/ipc";
import {
  ScanIntensityParamsSchema,
  ScanStartParamsSchema,
  ScanVolumeParamsSchema,
  type ScanState,
} from "@shared/contracts/scan";
import type { Logger } from "../logging/types";
import type { ScanService } from "../modules/scanning/application/scan-service";
import { respond } from "./respond";

export function registerScanHandlers(scanService: ScanService, logger: Logger): void {
  ipcMain.handle(IPC_CHANNELS.getScanState, (event, params: unknown) =>
    respond<ScanState>(event, IPC_CHANNELS.getScanState, logger, () =>
      scanService.getState(ScanVolumeParamsSchema.parse(params).volumeId),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.startScan, (event, params: unknown) =>
    respond<ScanState>(event, IPC_CHANNELS.startScan, logger, () => {
      const parsed = ScanStartParamsSchema.parse(params);
      return scanService.startScan(parsed.volumeId, parsed.intensity);
    }),
  );

  ipcMain.handle(IPC_CHANNELS.pauseScan, (event, params: unknown) =>
    respond<ScanState>(event, IPC_CHANNELS.pauseScan, logger, () =>
      scanService.pauseScan(ScanVolumeParamsSchema.parse(params).volumeId),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.resumeScan, (event, params: unknown) =>
    respond<ScanState>(event, IPC_CHANNELS.resumeScan, logger, () =>
      scanService.resumeScan(ScanVolumeParamsSchema.parse(params).volumeId),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.setScanIntensity, (event, params: unknown) =>
    respond<ScanState>(event, IPC_CHANNELS.setScanIntensity, logger, () => {
      const parsed = ScanIntensityParamsSchema.parse(params);
      return scanService.setIntensity(parsed.volumeId, parsed.intensity);
    }),
  );
}
