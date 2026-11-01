import { ipcMain } from "electron";
import { IPC_CHANNELS } from "@shared/contracts/channels";
import {
  LibraryItemTargetParamsSchema,
  VideoProxyPrepareParamsSchema,
  type VideoProxyState,
} from "@shared/contracts/library";
import type { Logger } from "../logging/types";
import type { VideoProxyService } from "../modules/media/video-proxy";
import { respond } from "./respond";

export function registerVideoProxyHandlers(videoProxies: VideoProxyService, logger: Logger): void {
  ipcMain.handle(IPC_CHANNELS.getVideoProxyState, (event, params: unknown) =>
    respond<VideoProxyState>(event, IPC_CHANNELS.getVideoProxyState, logger, () => {
      const parsed = LibraryItemTargetParamsSchema.parse(params);
      return videoProxies.getState(parsed.fileId);
    }),
  );

  ipcMain.handle(IPC_CHANNELS.prepareVideoProxy, (event, params: unknown) =>
    respond<VideoProxyState>(event, IPC_CHANNELS.prepareVideoProxy, logger, () => {
      const parsed = VideoProxyPrepareParamsSchema.parse(params);
      return videoProxies.prepare(parsed.fileId, parsed.retry ?? false);
    }),
  );
}
