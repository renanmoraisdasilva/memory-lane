import type { IpcMainInvokeEvent } from "electron";
import type { IpcResult } from "@shared/contracts/ipc";
import { APP_ERROR_CODES, AppError, toAppErrorPayload } from "@shared/domain/errors";
import type { Logger } from "../logging/types";
import { isTrustedRendererUrl, rendererFileUrl } from "./trusted-sender";

export function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const url = event.senderFrame?.url ?? "";
  if (!isTrustedRendererUrl(url, rendererFileUrl(), process.env.ELECTRON_RENDERER_URL)) {
    throw new AppError(APP_ERROR_CODES.FORBIDDEN, "IPC request came from an untrusted sender");
  }
}

export async function respond<T>(
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
