import { beforeEach, describe, expect, it, vi } from "vitest";

const workerMocks = vi.hoisted(() => {
  class MockWorker {
    static instances: MockWorker[] = [];
    readonly listeners = new Map<string, (value: unknown) => void>();
    readonly terminate = vi.fn(async () => undefined);

    constructor(
      readonly path: string,
      readonly options: { workerData: { backupDir: string } },
    ) {
      MockWorker.instances.push(this);
      queueMicrotask(() => {
        const mode = this.options.workerData.backupDir;
        if (mode === "hang") {
          return;
        }
        if (mode === "fail") {
          this.emit("message", {
            ok: false,
            error: { code: "DB_ERROR", message: "backup failed" },
          });
          return;
        }
        if (mode === "invalid") {
          this.emit("message", { nope: true });
          return;
        }
        if (mode === "exit") {
          this.emit("exit", 2);
          return;
        }
        this.emit("message", {
          ok: true,
          result: {
            path: "C:\\backups\\catalog.db",
            bytes: 4096,
            createdAt: "2026-10-31T12:00:00.000Z",
            status: "success",
          },
        });
      });
    }

    once(event: string, listener: (value: unknown) => void): this {
      this.listeners.set(event, listener);
      return this;
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

import { createWorkerBackupRunner } from "./backup-client";

const request = {
  appDbPath: "C:\\data\\app.db",
  catalogPath: "C:\\data\\catalog.db",
  backupDir: "ok",
  now: "2026-10-31T12:00:00.000Z",
};

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

describe("worker backup runner", () => {
  it("runs the backup worker and resolves the validated result", async () => {
    const runner = createWorkerBackupRunner({ workerPath: "backup-worker.js" });

    await expect(runner.run(request)).resolves.toEqual({
      path: "C:\\backups\\catalog.db",
      bytes: 4096,
      createdAt: "2026-10-31T12:00:00.000Z",
      status: "success",
    });
    expect(getWorker().options.workerData).toBe(request);
    expect(getWorker().terminate).toHaveBeenCalledOnce();
  });

  it("maps worker failures to AppError", async () => {
    const runner = createWorkerBackupRunner({ workerPath: "backup-worker.js" });

    await expect(runner.run({ ...request, backupDir: "fail" })).rejects.toMatchObject({
      code: "DB_ERROR",
      message: "backup failed",
    });
    expect(getWorker().terminate).toHaveBeenCalledOnce();
  });

  it("rejects an invalid worker response", async () => {
    const runner = createWorkerBackupRunner({ workerPath: "backup-worker.js" });

    await expect(runner.run({ ...request, backupDir: "invalid" })).rejects.toMatchObject({
      code: "WORKER_ERROR",
    });
  });

  it("rejects when the worker exits without a result", async () => {
    const runner = createWorkerBackupRunner({ workerPath: "backup-worker.js" });

    await expect(runner.run({ ...request, backupDir: "exit" })).rejects.toMatchObject({
      code: "WORKER_ERROR",
    });
  });

  it("rejects when the backup exceeds its timeout", async () => {
    vi.useFakeTimers();
    const runner = createWorkerBackupRunner({
      workerPath: "backup-worker.js",
      timeoutMs: 50,
    });
    const pending = runner.run({ ...request, backupDir: "hang" });
    const assertion = expect(pending).rejects.toMatchObject({
      code: "WORKER_ERROR",
      message: "Database backup timed out",
    });

    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    expect(getWorker().terminate).toHaveBeenCalledOnce();
  });
});
