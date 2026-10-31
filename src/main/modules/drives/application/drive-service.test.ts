import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CatalogSummary, DriveIdentity } from "@shared/contracts/drives";
import { toVolumeId } from "@shared/contracts/drives";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { DbClient } from "../../../clients/db-client";
import type { DbMethod } from "../../../db/worker-protocol";
import type { Logger } from "../../../logging/types";
import type { DetectedDrive, RegisteredDrive } from "../domain/drive";
import { createDevelopmentDrive } from "../infrastructure/development-drive";
import { DriveService, getCatalogPaths } from "./drive-service";

const temporaryDirectories: string[] = [];

async function createTempDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "memory-lane-drive-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

class FakeDb implements DbClient {
  registered: RegisteredDrive[] = [];
  calls: Array<{ method: DbMethod; params: unknown }> = [];
  summary: CatalogSummary;

  constructor(summary: CatalogSummary) {
    this.summary = summary;
  }

  async request<T>(method: DbMethod, params: unknown): Promise<T> {
    this.calls.push({ method, params });

    if (method === "app.listDrives") {
      return this.registered as T;
    }

    if (method === "app.registerDrive") {
      const input = params as {
        identity: DriveIdentity;
        lastSeenAt: string;
        catalogSchema: number;
      };
      const record: RegisteredDrive = {
        id: this.registered.length + 1,
        volumeId: input.identity.volumeId,
        volumeSerial: input.identity.serialNumber,
        label: input.identity.label,
        fileSystem: input.identity.fileSystem,
        rootPath: input.identity.rootPath,
        lastLetter: input.identity.letter,
        lastSeenAt: input.lastSeenAt,
        catalogSchema: input.catalogSchema,
        lastBackupAt: null,
        lastScanAt: null,
        indexedFiles: 0,
      };
      this.registered = [record];
      return record as T;
    }

    if (method === "catalog.create" || method === "catalog.open") {
      return this.summary as T;
    }

    if (method === "health") {
      return { appDbPath: "C:\\data\\app.db", schemaVersion: 1 } as T;
    }

    if (method === "close") {
      return { closed: true } as T;
    }

    throw new AppError(APP_ERROR_CODES.INVALID_REQUEST, "Unexpected fake DB method");
  }
}

function createLogger(): Logger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

function summaryFor(drive: DetectedDrive, catalogPath: string): CatalogSummary {
  return {
    catalogPath,
    driveLabel: drive.label,
    volumeId: drive.volumeId,
    schemaVersion: 1,
    fileCount: 0,
    openedAt: "2026-01-01T00:00:00.000Z",
  };
}

function serviceFor(drive: DetectedDrive, db: FakeDb): DriveService {
  return new DriveService({
    db,
    listDetected: async () => [drive],
    logger: createLogger(),
    now: () => new Date("2026-01-01T00:00:00.000Z"),
  });
}

async function createCatalogFile(drive: DetectedDrive): Promise<string> {
  const paths = getCatalogPaths(drive.rootPath);
  await mkdir(paths.appDirectory, { recursive: true });
  await writeFile(paths.catalogPath, "");
  return paths.catalogPath;
}

describe("DriveService", () => {
  it("lists a drive with no catalog", async () => {
    const root = await createTempDirectory();
    const drive = createDevelopmentDrive(root);
    const db = new FakeDb(summaryFor(drive, ""));
    const drives = await serviceFor(drive, db).listDrives();

    expect(drives[0]?.catalogStatus).toBe("none");
  });

  it("marks a registered drive without a catalog file", async () => {
    const root = await createTempDirectory();
    const drive = createDevelopmentDrive(root);
    const db = new FakeDb(summaryFor(drive, ""));
    db.registered = [
      {
        id: 1,
        volumeId: drive.volumeId,
        volumeSerial: drive.serialNumber,
        label: drive.label,
        fileSystem: drive.fileSystem,
        rootPath: drive.rootPath,
        lastLetter: null,
        lastSeenAt: "2026-01-01T00:00:00.000Z",
        catalogSchema: 1,
        lastBackupAt: null,
        lastScanAt: null,
        indexedFiles: 0,
      },
    ];

    const drives = await serviceFor(drive, db).listDrives();
    expect(drives[0]?.catalogStatus).toBe("registered");
  });

  it("flags a changed letter and includes offline registered drives", async () => {
    const root = await createTempDirectory();
    const detected = createDevelopmentDrive(root);
    const connected: DetectedDrive = { ...detected, letter: "F:" };
    const db = new FakeDb(summaryFor(connected, ""));
    db.registered = [
      {
        id: 1,
        volumeId: connected.volumeId,
        volumeSerial: connected.serialNumber,
        label: connected.label,
        fileSystem: connected.fileSystem,
        rootPath: connected.rootPath,
        lastLetter: "E:",
        lastSeenAt: "2026-01-01T00:00:00.000Z",
        catalogSchema: 2,
        lastBackupAt: null,
        lastScanAt: "2026-01-02T00:00:00.000Z",
        indexedFiles: 12,
      },
      {
        id: 2,
        volumeId: toVolumeId("offline-volume"),
        volumeSerial: "OFFLINE",
        label: "Offline archive",
        fileSystem: "NTFS",
        rootPath: "G:\\",
        lastLetter: "G:",
        lastSeenAt: "2025-12-01T00:00:00.000Z",
        catalogSchema: 2,
        lastBackupAt: null,
        lastScanAt: null,
        indexedFiles: 4,
      },
    ];

    const drives = await serviceFor(connected, db).listDrives();
    expect(drives[0]).toMatchObject({
      isConnected: true,
      lastLetter: "E:",
      requiresLetterConfirmation: true,
      lastScanAt: "2026-01-02T00:00:00.000Z",
      indexedFiles: 12,
    });
    expect(drives[1]).toMatchObject({
      volumeId: "offline-volume",
      label: "Offline archive",
      isConnected: false,
      catalogStatus: "registered",
      indexedFiles: 4,
    });
  });

  it("confirms a changed drive identity without opening the catalog", async () => {
    const root = await createTempDirectory();
    const detected = createDevelopmentDrive(root);
    const drive: DetectedDrive = { ...detected, letter: "F:" };
    await createCatalogFile(drive);
    const db = new FakeDb(summaryFor(drive, ""));
    db.registered = [
      {
        id: 1,
        volumeId: drive.volumeId,
        volumeSerial: drive.serialNumber,
        label: drive.label,
        fileSystem: drive.fileSystem,
        rootPath: "E:\\",
        lastLetter: "E:",
        lastSeenAt: "2026-01-01T00:00:00.000Z",
        catalogSchema: 2,
        lastBackupAt: null,
        lastScanAt: null,
        indexedFiles: 0,
      },
    ];

    await serviceFor(drive, db).confirmDriveIdentity(drive.volumeId);

    expect(db.registered[0]).toMatchObject({ lastLetter: "F:", rootPath: drive.rootPath });
    expect(db.calls.some((call) => call.method === "catalog.open")).toBe(false);
  });

  it("marks a drive with a catalog file as ready", async () => {
    const root = await createTempDirectory();
    const drive = createDevelopmentDrive(root);
    await createCatalogFile(drive);
    const db = new FakeDb(summaryFor(drive, ""));

    const drives = await serviceFor(drive, db).listDrives();
    expect(drives[0]?.catalogStatus).toBe("ready");
  });

  it("initializes a catalog and creates app-managed directories", async () => {
    const root = await createTempDirectory();
    const drive = createDevelopmentDrive(root);
    const paths = getCatalogPaths(root);
    const db = new FakeDb(summaryFor(drive, paths.catalogPath));
    const service = serviceFor(drive, db);

    const summary = await service.initializeCatalog(drive.volumeId);

    expect(summary.driveLabel).toBe(drive.label);
    expect(db.calls.map((call) => call.method)).toContain("catalog.create");
    expect(db.calls.map((call) => call.method)).toContain("app.registerDrive");
    await expect(
      import("node:fs/promises").then((fs) => fs.stat(paths.cachePath)),
    ).resolves.toBeTruthy();
  });

  it("refuses to initialize an existing catalog", async () => {
    const root = await createTempDirectory();
    const drive = createDevelopmentDrive(root);
    await createCatalogFile(drive);
    const db = new FakeDb(summaryFor(drive, ""));
    const service = serviceFor(drive, db);

    await expect(service.initializeCatalog(drive.volumeId)).rejects.toMatchObject({
      code: APP_ERROR_CODES.CATALOG_ALREADY_EXISTS,
    });
  });

  it("opens an existing catalog", async () => {
    const root = await createTempDirectory();
    const drive = createDevelopmentDrive(root);
    const catalogPath = await createCatalogFile(drive);
    const db = new FakeDb(summaryFor(drive, catalogPath));

    const summary = await serviceFor(drive, db).openCatalog(drive.volumeId);
    expect(summary.catalogPath).toBe(catalogPath);
  });

  it("reports a missing catalog", async () => {
    const root = await createTempDirectory();
    const drive = createDevelopmentDrive(root);
    const db = new FakeDb(summaryFor(drive, ""));

    await expect(serviceFor(drive, db).openCatalog(drive.volumeId)).rejects.toMatchObject({
      code: APP_ERROR_CODES.CATALOG_NOT_FOUND,
    });
  });

  it("rejects a disconnected drive", async () => {
    const root = await createTempDirectory();
    const drive = createDevelopmentDrive(root);
    const db = new FakeDb(summaryFor(drive, ""));

    await expect(serviceFor(drive, db).openCatalog(toVolumeId("missing"))).rejects.toMatchObject({
      code: APP_ERROR_CODES.DRIVE_NOT_FOUND,
    });
  });

  it("rejects the Windows system drive", async () => {
    const root = await createTempDirectory();
    const developmentDrive = createDevelopmentDrive(root);
    const systemDrive: DetectedDrive = {
      ...developmentDrive,
      driveType: "fixed",
      isExternal: false,
    };
    const db = new FakeDb(summaryFor(systemDrive, ""));

    await expect(
      serviceFor(systemDrive, db).initializeCatalog(systemDrive.volumeId),
    ).rejects.toMatchObject({ code: APP_ERROR_CODES.DRIVE_UNSUPPORTED });
  });
});
