import { ipcMain, type IpcMainInvokeEvent } from "electron";
import type { CatalogSummary, DriveInfo } from "@shared/contracts/drives";
import {
  InitializeCatalogParamsSchema,
  IPC_CHANNELS,
  OpenCatalogParamsSchema,
  type AppInfo,
  type IpcResult,
} from "@shared/contracts/ipc";
import { APP_ERROR_CODES, AppError, toAppErrorPayload } from "@shared/domain/errors";
import type { AppService } from "../modules/app/application/app-service";
import type { DriveService } from "../modules/drives/application/drive-service";
import type { Logger } from "../logging/types";

export interface IpcServices {
  appService: AppService;
  driveService: DriveService;
  logger: Logger;
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const url = event.senderFrame?.url ?? "";
  const developmentUrl = process.env.ELECTRON_RENDERER_URL;

  if (developmentUrl !== undefined && url.startsWith(developmentUrl)) {
    return;
  }
  if (url.startsWith("file://")) {
    return;
  }

  throw new AppError(APP_ERROR_CODES.FORBIDDEN, "IPC request came from an untrusted sender");
}

async function respond<T>(
  event: IpcMainInvokeEvent,
  method: string,
  logger: Logger,
  operation: () => Promise<T> | T,
): Promise<IpcResult<T>> {
  try {
    assertTrustedSender(event);
    const data = await operation();
    return { ok: true, data };
  } catch (error) {
    const payload = toAppErrorPayload(error);
    logger.error(`${method} failed`, { code: payload.code, message: payload.message });
    return { ok: false, error: payload };
  }
}

export function registerIpcHandlers(services: IpcServices): void {
  const { appService, driveService, logger } = services;

  ipcMain.handle(IPC_CHANNELS.getAppInfo, (event) =>
    respond<AppInfo>(event, IPC_CHANNELS.getAppInfo, logger, () => appService.getInfo()),
  );

  ipcMain.handle(IPC_CHANNELS.listDrives, (event) =>
    respond<DriveInfo[]>(event, IPC_CHANNELS.listDrives, logger, () => driveService.listDrives()),
  );

  ipcMain.handle(IPC_CHANNELS.initializeCatalog, (event, params: unknown) =>
    respond<CatalogSummary>(event, IPC_CHANNELS.initializeCatalog, logger, () =>
      driveService.initializeCatalog(InitializeCatalogParamsSchema.parse(params).volumeId),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.openCatalog, (event, params: unknown) =>
    respond<CatalogSummary>(event, IPC_CHANNELS.openCatalog, logger, () =>
      driveService.openCatalog(OpenCatalogParamsSchema.parse(params).volumeId),
    ),
  );
}
