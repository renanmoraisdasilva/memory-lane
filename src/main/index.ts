import path from "node:path";
import { app, BrowserWindow } from "electron";
import { DbWorkerClient } from "./clients/db-client";
import { configureLogging } from "./logging/logger";
import { installSecurityHandlers } from "./bootstrap/security";
import { configureUserData } from "./bootstrap/user-data";
import { registerIpcHandlers } from "./ipc/register-handlers";
import { AppService } from "./modules/app/application/app-service";
import { DriveService } from "./modules/drives/application/drive-service";
import { listDetectedDrives } from "./modules/drives/application/list-detected-drives";
import { ScanService } from "./modules/scanning/application/scan-service";
import { createElectronThumbnailGenerator } from "./modules/scanning/infrastructure/electron-thumbnail-generator";
import { createFileHasher } from "./modules/scanning/infrastructure/file-hasher";
import { createFileMetadataExtractor } from "./modules/scanning/infrastructure/file-metadata";
import { createThumbnailScheduler } from "./modules/media/thumbnail-scheduler";
import { registerMediaProtocol, registerMediaScheme } from "./modules/media/media-protocol";
import { LibraryService } from "./modules/library/application/library-service";
import { createShellActions } from "./modules/library/infrastructure/shell-actions";
import { HealthService } from "./modules/health/application/health-service";
import { SettingsService } from "./modules/settings/application/settings-service";

registerMediaScheme();

app.setName("Memory Lane");
app.setAppUserModelId("com.memorylane.app");

const paths = configureUserData();
const logger = configureLogging(paths.logPath);

let mainWindow: BrowserWindow | null = null;
let dbClient: DbWorkerClient | null = null;
let scanService: ScanService | null = null;
let healthService: HealthService | null = null;
let settingsService: SettingsService | null = null;
let shuttingDown = false;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: "#0f0f11",
    title: "Memory Lane",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      devTools: !app.isPackaged,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.on("minimize", () => {
    logger.info("Main window minimized");
  });

  mainWindow.on("restore", () => {
    logger.info("Main window restored");
  });

  mainWindow.on("unresponsive", () => {
    logger.warn("Main window became unresponsive");
  });

  mainWindow.on("responsive", () => {
    logger.info("Main window became responsive");
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    logger.error("Renderer process terminated", details);
  });

  const developmentUrl = process.env.ELECTRON_RENDERER_URL;
  if (developmentUrl !== undefined) {
    void mainWindow.loadURL(developmentUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

function restoreMainWindow(): void {
  if (mainWindow === null) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
  mainWindow.moveTop();
}

async function startServices(): Promise<void> {
  const workerPath = path.join(__dirname, "db-worker.js");
  const db = new DbWorkerClient(workerPath, paths.appDbPath);
  dbClient = db;

  try {
    await db.start();
    logger.info("Database worker ready", { appDbPath: paths.appDbPath });
  } catch (error) {
    logger.error("Database worker failed to start", error);
  }

  const appService = new AppService({
    db,
    appDbPath: paths.appDbPath,
    userDataPath: paths.userDataPath,
    logPath: paths.logPath,
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    platform: process.platform,
    isPackaged: app.isPackaged,
  });
  const settings = new SettingsService({ db, appService, paths, logger });
  settingsService = settings;

  const thumbnails = createThumbnailScheduler(createElectronThumbnailGenerator());
  const libraryService = new LibraryService({
    db,
    shellActions: createShellActions(),
    logger,
  });

  const metadata = createFileMetadataExtractor({ logger });
  const scan = new ScanService({
    db,
    listDetected: listDetectedDrives,
    logger,
    metadata,
    thumbnails,
    hasher: createFileHasher(),
  });
  scanService = scan;
  const health = new HealthService({
    db,
    hasher: createFileHasher(),
    metadata,
    logger,
  });
  healthService = health;

  const driveService = new DriveService({
    db,
    listDetected: listDetectedDrives,
    logger,
    onBeforeCatalogChange: () => scan.interruptActive(),
  });

  registerIpcHandlers({
    appService,
    driveService,
    scanService: scan,
    libraryService,
    healthService: health,
    settingsService: settings,
    logger,
  });
  registerMediaProtocol({ db, thumbnails, logger });
  settings.startBackupTimer();
  createWindow();
}

async function shutdown(): Promise<void> {
  if (healthService !== null) {
    await healthService.shutdown();
  }
  if (scanService !== null) {
    await scanService.shutdown();
  }
  if (settingsService !== null) {
    await settingsService.shutdown();
  }
  if (dbClient !== null) {
    try {
      await dbClient.close();
      logger.info("Database worker closed");
    } catch (error) {
      logger.error("Failed to close database worker", error);
    }
  }
}

async function bootstrap(): Promise<void> {
  installSecurityHandlers();
  await startServices();
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    logger.info("Second instance requested; restoring main window");
    restoreMainWindow();
  });

  app
    .whenReady()
    .then(bootstrap)
    .catch((error: unknown) => {
      logger.error("Application bootstrap failed", error);
      app.exit(1);
    });

  app.on("activate", () => {
    restoreMainWindow();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("before-quit", (event) => {
    if (shuttingDown) {
      return;
    }
    event.preventDefault();
    shuttingDown = true;
    void shutdown().finally(() => {
      app.exit(0);
    });
  });
}

function logUnhandled(error: unknown): void {
  logger.error("Unhandled process error", error);
}

process.on("uncaughtException", logUnhandled);
process.on("unhandledRejection", logUnhandled);
