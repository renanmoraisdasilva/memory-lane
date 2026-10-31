import { beforeEach, describe, expect, it, vi } from "vitest";

const workerMocks = vi.hoisted(() => {
  class MockWorker {
    static instances: MockWorker[] = [];
    readonly posted: unknown[] = [];
    readonly listeners = new Map<string, (value: unknown) => void>();
    readonly terminate = vi.fn(async () => undefined);

    constructor(
      readonly path: string,
      readonly options: unknown,
    ) {
      MockWorker.instances.push(this);
    }

    on(event: string, listener: (value: unknown) => void): this {
      this.listeners.set(event, listener);
      return this;
    }

    postMessage(message: unknown): void {
      this.posted.push(message);
      const request = message as { id: number; method: string };
      if (request.method === "slow") {
        return;
      }

      queueMicrotask(() => {
        if (request.method === "failing") {
          this.emit("message", {
            id: request.id,
            ok: false,
            error: { code: "DB_ERROR", message: "query failed" },
          });
          return;
        }
        this.emit("message", { id: request.id, ok: true, data: { method: request.method } });
      });
    }

    emit(event: string, value: unknown): void {
      this.listeners.get(event)?.(value);
    }
  }

  return { MockWorker };
});

vi.mock("node:worker_threads", () => ({
  Worker: workerMocks.MockWorker,
}));

import { DbWorkerClient } from "./db-client";
import type { DbMethod } from "../db/worker-protocol";

const failingMethod = "failing" as DbMethod;
const slowMethod = "slow" as DbMethod;

function getWorker(): InstanceType<typeof workerMocks.MockWorker> {
  const worker = workerMocks.MockWorker.instances[0];
  if (worker === undefined) {
    throw new Error("Mock worker was not created");
  }
  return worker;
}

beforeEach(() => {
  workerMocks.MockWorker.instances.length = 0;
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("DbWorkerClient", () => {
  it("starts, requests, and closes the worker", async () => {
    const client = new DbWorkerClient("db-worker.js", "C:\\data\\app.db");

    await client.start();
    await expect(client.request("health", {})).resolves.toEqual({ method: "health" });
    await client.close();

    expect(getWorker().posted).toHaveLength(3);
    expect(getWorker().terminate).toHaveBeenCalledOnce();
  });

  it("maps worker errors to AppError", async () => {
    const client = new DbWorkerClient("db-worker.js", "C:\\data\\app.db");

    await expect(client.request(failingMethod, {})).rejects.toMatchObject({
      code: "DB_ERROR",
      message: "query failed",
    });
    await client.close();
  });

  it("rejects a request after the timeout", async () => {
    vi.useFakeTimers();
    const client = new DbWorkerClient("db-worker.js", "C:\\data\\app.db");
    const request = client.request(slowMethod, {});
    const assertion = expect(request).rejects.toMatchObject({ code: "WORKER_ERROR" });

    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    await client.close();
  });

  it("rejects pending requests when the worker errors", async () => {
    const client = new DbWorkerClient("db-worker.js", "C:\\data\\app.db");
    const request = client.request(slowMethod, {});
    const assertion = expect(request).rejects.toMatchObject({ code: "WORKER_ERROR" });

    getWorker().emit("error", new Error("worker crashed"));
    await assertion;
    await client.close();
  });

  it("rejects pending requests when the worker exits", async () => {
    const client = new DbWorkerClient("db-worker.js", "C:\\data\\app.db");
    const request = client.request(slowMethod, {});
    const assertion = expect(request).rejects.toMatchObject({ code: "WORKER_ERROR" });

    getWorker().emit("exit", 1);
    await assertion;
    await client.close();
  });

  it("rejects invalid worker responses", async () => {
    const client = new DbWorkerClient("db-worker.js", "C:\\data\\app.db");
    const request = client.request(slowMethod, {});
    const assertion = expect(request).rejects.toMatchObject({ code: "WORKER_ERROR" });

    getWorker().emit("message", { nope: true });
    await assertion;
    await client.close();
  });

  it("ignores a second close", async () => {
    const client = new DbWorkerClient("db-worker.js", "C:\\data\\app.db");
    await client.close();
    await client.close();

    expect(getWorker().terminate).toHaveBeenCalledOnce();
  });
});
