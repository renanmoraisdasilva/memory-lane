import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DbClient } from "../../src/main/clients/db-client";
import { createDbWorkerHandler } from "../../src/main/db/db-worker-handler";
import type { DbMethod } from "../../src/main/db/worker-protocol";
import { DriveService } from "../../src/main/modules/drives/application/drive-service";
import { createDevelopmentDrive } from "../../src/main/modules/drives/infrastructure/development-drive";
import type { Logger } from "../../src/main/logging/types";

const temporaryDirectories: string[] = [];

async function createTempDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "memory-lane-service-"));
  temporaryDirectories.push(directory);
  return directory;
}

function logger(): Logger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("DriveService integration", () => {
  it("creates and reopens a catalog through the worker handler", async () => {
    const root = await createTempDirectory();
    const appDbPath = path.join(root, "app.db");
    const drive = createDevelopmentDrive(root);
    const handler = createDbWorkerHandler({ appDbPath });
    const db: DbClient = {
      request: async <T>(method: DbMethod, params: unknown): Promise<T> =>
        handler.handle(method, params) as T,
    };
    const service = new DriveService({
      db,
      listDetected: async () => [drive],
      logger: logger(),
    });

    try {
      const initial = await service.listDrives();
      expect(initial[0]?.catalogStatus).toBe("none");

      const created = await service.initializeCatalog(drive.volumeId);
      expect(created.fileCount).toBe(0);

      const ready = await service.listDrives();
      expect(ready[0]?.catalogStatus).toBe("ready");

      const opened = await service.openCatalog(drive.volumeId);
      expect(opened.catalogPath).toBe(created.catalogPath);
    } finally {
      handler.dispose();
    }
  });
});
