import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { vi } from "vitest";
import type { CatalogSummary } from "@shared/contracts/drives";
import type { ScanState } from "@shared/contracts/scan";
import type { DbClient } from "../../src/main/clients/db-client";
import { createDbWorkerHandler, type DbWorkerHandler } from "../../src/main/db/db-worker-handler";
import type { DbMethod } from "../../src/main/db/worker-protocol";
import type { Logger } from "../../src/main/logging/types";
import type { WorkloadCoordinator } from "../../src/main/modules/workloads/application/workload-coordinator";
import { DriveService } from "../../src/main/modules/drives/application/drive-service";
import type { DetectedDrive } from "../../src/main/modules/drives/domain/drive";
import { createDevelopmentDrive } from "../../src/main/modules/drives/infrastructure/development-drive";
import { ScanService } from "../../src/main/modules/scanning/application/scan-service";
import type {
  FileHasher,
  FileMetadataExtractor,
  ThumbnailWorkScheduler,
} from "../../src/main/modules/scanning/domain/scan-files";
import { createFileHasher } from "../../src/main/modules/scanning/infrastructure/file-hasher";
import { createFileMetadataExtractor } from "../../src/main/modules/scanning/infrastructure/file-metadata";

export function testLogger(): Logger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

export function thumbnailGenerator(): ThumbnailWorkScheduler {
  return {
    async generate(_filePath: string, outputPath: string): Promise<{ bytes: number }> {
      const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
      await writeFile(outputPath, bytes);
      return { bytes: bytes.length };
    },
  };
}

export interface ScanHarness {
  root: string;
  drive: DetectedDrive;
  handler: DbWorkerHandler;
  db: DbClient;
  driveService: DriveService;
  scanService: ScanService;
  catalogPath: string;
  summary: CatalogSummary;
  dispose: () => Promise<void>;
}

export interface ScanHarnessOptions {
  hasher?: FileHasher;
  metadata?: FileMetadataExtractor;
  checkDriveAvailable?: (rootPath: string) => Promise<void>;
  workloads?: WorkloadCoordinator;
}

export async function createScanHarness(options: ScanHarnessOptions = {}): Promise<ScanHarness> {
  const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-scan-"));
  const driveRoot = path.join(root, "drive");
  await mkdir(driveRoot, { recursive: true });
  const handler = createDbWorkerHandler({ appDbPath: path.join(root, "app.db") });
  const db: DbClient = {
    request: async <T>(method: DbMethod, params: unknown): Promise<T> =>
      handler.handle(method, params) as T,
  };
  const logger = testLogger();
  const drive = createDevelopmentDrive(driveRoot);
  const driveService = new DriveService({
    db,
    listDetected: async () => [drive],
    logger,
  });
  const summary = await driveService.initializeCatalog(drive.volumeId);
  const scanService = new ScanService({
    db,
    listDetected: async () => [drive],
    logger,
    metadata: options.metadata ?? createFileMetadataExtractor({ exif: null, logger }),
    thumbnails: thumbnailGenerator(),
    hasher: options.hasher ?? createFileHasher(),
    ...(options.workloads === undefined ? {} : { workloads: options.workloads }),
    ...(options.checkDriveAvailable === undefined
      ? {}
      : { checkDriveAvailable: options.checkDriveAvailable }),
  });
  const catalogPath = path.join(driveRoot, ".memorylane", "catalog.db");

  return {
    root,
    drive,
    handler,
    db,
    driveService,
    scanService,
    catalogPath,
    summary,
    async dispose(): Promise<void> {
      await scanService.shutdown();
      try {
        handler.dispose();
      } catch {
        // A test may have closed the handler already.
      }
      await rm(root, { recursive: true, force: true });
    },
  };
}

export async function waitForComplete(
  scanService: ScanService,
  drive: DetectedDrive,
  timeoutMs = 10_000,
): Promise<ScanState> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const state = await scanService.getState(drive.volumeId);
    if (state.status === "complete") {
      return state;
    }
    if (state.status === "error") {
      throw new Error(state.errorMessage ?? "Scan failed");
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Timed out waiting for the scan to complete");
}
