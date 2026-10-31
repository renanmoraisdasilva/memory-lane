import { Worker } from "node:worker_threads";
import { APP_ERROR_CODES, AppError, toAppError } from "@shared/domain/errors";
import { isDbResponse, type DbMethod, type DbResponse } from "../db/worker-protocol";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  timeout: NodeJS.Timeout;
}

export interface DbClient {
  request<T>(method: DbMethod, params: unknown): Promise<T>;
}

const REQUEST_TIMEOUT_MS = 10_000;

export class DbWorkerClient implements DbClient {
  private readonly worker: Worker;
  private readonly pending = new Map<number, PendingRequest>();
  private nextId = 1;
  private closing = false;

  constructor(workerPath: string, appDbPath: string) {
    this.worker = new Worker(workerPath, {
      workerData: { appDbPath },
    });

    this.worker.on("message", (message: unknown) => this.handleMessage(message));
    this.worker.on("error", (error) => {
      this.rejectAll(new AppError(APP_ERROR_CODES.WORKER_ERROR, error.message));
    });
    this.worker.on("exit", (code) => {
      if (!this.closing) {
        this.rejectAll(
          new AppError(APP_ERROR_CODES.WORKER_ERROR, `Database worker exited with code ${code}`),
        );
      }
    });
  }

  async start(): Promise<void> {
    await this.request("health", {});
  }

  async request<T>(method: DbMethod, params: unknown): Promise<T> {
    if (this.closing) {
      throw new AppError(APP_ERROR_CODES.WORKER_ERROR, "Database worker is closing");
    }

    const id = this.nextId;
    this.nextId += 1;

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new AppError(APP_ERROR_CODES.WORKER_ERROR, `Database request timed out: ${method}`));
      }, REQUEST_TIMEOUT_MS);
      timeout.unref();

      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timeout,
      });

      this.worker.postMessage({ id, method, params });
    });
  }

  async close(): Promise<void> {
    if (this.closing) {
      return;
    }

    try {
      await this.request("close", {});
    } catch {
      // The worker may already be gone. Termination below is the hard stop.
    } finally {
      this.closing = true;
      this.rejectAll(new AppError(APP_ERROR_CODES.WORKER_ERROR, "Database worker closed"));
      await this.worker.terminate();
    }
  }

  private handleMessage(message: unknown): void {
    if (!isDbResponse(message)) {
      this.rejectAll(
        new AppError(APP_ERROR_CODES.WORKER_ERROR, "Invalid database worker response"),
      );
      return;
    }

    const response: DbResponse = message;
    const request = this.pending.get(response.id);
    if (request === undefined) {
      return;
    }

    clearTimeout(request.timeout);
    this.pending.delete(response.id);

    if (response.ok) {
      request.resolve(response.data);
      return;
    }

    const error = new AppError(response.error.code, response.error.message, response.error.details);
    request.reject(error);
  }

  private rejectAll(error: unknown): void {
    const appError = toAppError(error);
    for (const request of this.pending.values()) {
      clearTimeout(request.timeout);
      request.reject(appError);
    }
    this.pending.clear();
  }
}
