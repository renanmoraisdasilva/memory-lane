import path from "node:path";
import { Worker } from "node:worker_threads";
import type { Logger } from "../../logging/types";
import type { HeicPreviewResponse } from "./heic-preview-protocol";

export interface PreviewConverter {
  convert(inputPath: string, outputPath: string): Promise<{ bytes: number } | null>;
  shutdown(): Promise<void>;
}

export interface HeicPreviewConverterOptions {
  logger: Logger;
  workerPath?: string;
  timeoutMs?: number;
}

interface PendingRequest {
  resolve: (value: { bytes: number }) => void;
  reject: (error: unknown) => void;
  timeout: NodeJS.Timeout;
}

const DEFAULT_TIMEOUT_MS = 60_000;

export function createHeicPreviewConverter(options: HeicPreviewConverterOptions): PreviewConverter {
  const workerPath = options.workerPath ?? path.join(__dirname, "heic-worker.js");
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pending = new Map<number, PendingRequest>();
  const inFlight = new Map<string, Promise<{ bytes: number } | null>>();
  let worker: Worker | null = null;
  let nextId = 1;
  let closing = false;

  function failAll(error: unknown): void {
    for (const request of pending.values()) {
      clearTimeout(request.timeout);
      request.reject(error);
    }
    pending.clear();
  }

  function handleMessage(response: HeicPreviewResponse): void {
    const request = pending.get(response.id);
    if (request === undefined) {
      return;
    }
    pending.delete(response.id);
    clearTimeout(request.timeout);
    if (response.ok) {
      request.resolve({ bytes: response.bytes });
    } else {
      request.reject(new Error(response.error));
    }
  }

  function ensureWorker(): Worker {
    if (worker !== null) {
      return worker;
    }
    const instance = new Worker(workerPath);
    instance.on("message", (message: HeicPreviewResponse) => handleMessage(message));
    instance.on("error", (error) => {
      worker = null;
      options.logger.warn("HEIC preview worker failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      failAll(error);
    });
    instance.on("exit", (code) => {
      worker = null;
      if (!closing) {
        const error = new Error(`HEIC preview worker exited with code ${code}`);
        options.logger.warn("HEIC preview worker exited", { code });
        failAll(error);
      }
    });
    worker = instance;
    return instance;
  }

  function convertOnce(inputPath: string, outputPath: string): Promise<{ bytes: number }> {
    return new Promise<{ bytes: number }>((resolve, reject) => {
      const id = nextId;
      nextId += 1;
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error("HEIC preview conversion timed out"));
      }, timeoutMs);
      timeout.unref();
      pending.set(id, { resolve, reject, timeout });
      ensureWorker().postMessage({ id, inputPath, outputPath });
    });
  }

  function convert(inputPath: string, outputPath: string): Promise<{ bytes: number } | null> {
    const existing = inFlight.get(outputPath);
    if (existing !== undefined) {
      return existing;
    }
    const promise = convertOnce(inputPath, outputPath)
      .catch((error: unknown) => {
        options.logger.warn("HEIC preview conversion failed", {
          path: inputPath,
          message: error instanceof Error ? error.message : String(error),
        });
        return null;
      })
      .finally(() => {
        inFlight.delete(outputPath);
      });
    inFlight.set(outputPath, promise);
    return promise;
  }

  async function shutdown(): Promise<void> {
    closing = true;
    failAll(new Error("HEIC preview worker stopped"));
    const instance = worker;
    worker = null;
    if (instance !== null) {
      await instance.terminate();
    }
  }

  return { convert, shutdown };
}
