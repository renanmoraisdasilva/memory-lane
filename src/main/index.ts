import path from "node:path";
import { app, BrowserWindow, Menu, nativeImage, screen, Tray } from "electron";
import { DbWorkerClient } from "./clients/db-client";
import { createSettingsService } from "./bootstrap/settings-services";
import { configureLogging } from "./logging/logger";
import { installSecurityHandlers } from "./bootstrap/security";
import { configureUserData } from "./bootstrap/user-data";
import { shutdownServices } from "./bootstrap/shutdown";
import { appIconPath } from "./bootstrap/app-icon";
import {
  createReplicationServices,
  type ReplicationServices,
} from "./bootstrap/replication-services";
import { registerIpcHandlers } from "./ipc/register-handlers";
import { AppService } from "./modules/app/application/app-service";
import { DriveService } from "./modules/drives/application/drive-service";
import { listDetectedDrives } from "./modules/drives/application/list-detected-drives";
import { ScanService } from "./modules/scanning/application/scan-service";
import { createElectronThumbnailGenerator } from "./modules/scanning/infrastructure/electron-thumbnail-generator";
import { createFileHasher } from "./modules/scanning/infrastructure/file-hasher";
import { createQuickFileHasher } from "./modules/scanning/infrastructure/quick-file-hasher";
import { createFileMetadataExtractor } from "./modules/scanning/infrastructure/file-metadata";
import { createThumbnailScheduler } from "./modules/media/thumbnail-scheduler";
import { createHeicPreviewConverter, type PreviewConverter } from "./modules/media/heic-preview";
import { resolveFfmpegPath } from "./modules/media/ffmpeg-path";
import { VideoProxyService } from "./modules/media/video-proxy";
import { registerMediaProtocol, registerMediaScheme } from "./modules/media/media-protocol";
import { LibraryService } from "./modules/library/application/library-service";
import { createShellActions } from "./modules/library/infrastructure/shell-actions";
import { HealthService } from "./modules/health/application/health-service";
import type { SettingsService } from "./modules/settings/application/settings-service";
import { WorkloadCoordinator } from "./modules/workloads/application/workload-coordinator";

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
let adoptionService: ReplicationServices["adoptionService"] | null = null;
let runService: ReplicationServices["runService"] | null = null;
let previewService: PreviewConverter | null = null;
let videoProxyService: VideoProxyService | null = null;
let tray: Tray | null = null;
let trayPending = false;
let shuttingDown = false;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    icon: appIconPath(),
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
    ensureWindowVisible();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    destroyTray();
  });

  mainWindow.on("minimize", () => {
    logger.info("Main window minimized");
    void showTrayFallback();
  });

  mainWindow.on("restore", () => {
    destroyTray();
    ensureWindowVisible();
    logger.info("Main window restored", { bounds: mainWindow?.getBounds() });
  });

  mainWindow.on("focus", () => {
    if (mainWindow?.isMinimized()) {
      mainWindow.restore();
    }
    ensureWindowVisible();
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

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

function intersects(left: Bounds, right: Bounds): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function ensureWindowVisible(): void {
  if (mainWindow === null) {
    return;
  }
  const bounds = mainWindow.isMinimized() ? mainWindow.getNormalBounds() : mainWindow.getBounds();
  if (screen.getAllDisplays().some((display) => intersects(bounds, display.workArea))) {
    return;
  }

  const workArea = screen.getPrimaryDisplay().workArea;
  const width = Math.min(bounds.width, workArea.width);
  const height = Math.min(bounds.height, workArea.height);
  const next = {
    x: workArea.x + Math.round((workArea.width - width) / 2),
    y: workArea.y + Math.round((workArea.height - height) / 2),
    width,
    height,
  };
  logger.warn("Main window was off-screen; moving it to the primary display", { bounds, next });
  mainWindow.setBounds(next);
}

function destroyTray(): void {
  tray?.destroy();
  tray = null;
}

function canShowTray(): boolean {
  return (
    !shuttingDown &&
    tray === null &&
    !trayPending &&
    mainWindow !== null &&
    mainWindow.isMinimized()
  );
}

function canAttachTray(): boolean {
  return !shuttingDown && tray === null && mainWindow !== null && mainWindow.isMinimized();
}

async function showTrayFallback(): Promise<void> {
  if (!canShowTray()) {
    return;
  }
  trayPending = true;
  try {
    const icon = nativeImage.createFromPath(appIconPath());
    const trayIcon = icon.isEmpty()
      ? await app.getFileIcon(app.getPath("exe"), { size: "small" })
      : icon.resize({ width: 32, height: 32 });
    if (!canAttachTray()) {
      return;
    }
    const next = new Tray(trayIcon);
    next.setToolTip("Memory Lane is minimized");
    next.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Show Memory Lane", click: restoreMainWindow },
        { type: "separator" },
        { label: "Quit Memory Lane", click: () => app.quit() },
      ]),
    );
    next.on("click", restoreMainWindow);
    tray = next;
  } catch (error) {
    logger.warn("Could not create the minimized-window tray fallback", {
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    trayPending = false;
  }
}

function restoreMainWindow(): void {
  if (mainWindow === null) {
    createWindow();
    return;
  }
  destroyTray();
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  ensureWindowVisible();
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
  const settings = createSettingsService({ db, appService, paths, logger });
  settingsService = settings;

  const thumbnails = createThumbnailScheduler(createElectronThumbnailGenerator());
  const previews = createHeicPreviewConverter({ logger });
  previewService = previews;
  const videoProxies = new VideoProxyService({
    db,
    ffmpegPath: resolveFfmpegPath(app.isPackaged),
    logger,
  });
  videoProxyService = videoProxies;
  const libraryService = new LibraryService({
    db,
    shellActions: createShellActions(),
    logger,
  });
  const metadata = createFileMetadataExtractor({ logger });
  const workloads = new WorkloadCoordinator();
  const replication = createReplicationServices({
    db,
    listDetected: listDetectedDrives,
    workloads,
    logger,
  });
  adoptionService = replication.adoptionService;
  runService = replication.runService;
  const scan = new ScanService({
    db,
    listDetected: listDetectedDrives,
    logger,
    metadata,
    thumbnails,
    hasher: createFileHasher(),
    quickHasher: createQuickFileHasher(),
    workloads,
  });
  scanService = scan;
  const health = new HealthService({
    db,
    hasher: createFileHasher(),
    metadata,
    logger,
    workloads,
  });
  healthService = health;

  const driveService = new DriveService({
    db,
    listDetected: listDetectedDrives,
    logger,
    onBeforeCatalogChange: async () => {
      await replication.runService.assertCanChangeSource();
      await scan.interruptActive();
    },
  });

  registerIpcHandlers({
    appService,
    driveService,
    scanService: scan,
    libraryService,
    healthService: health,
    settingsService: settings,
    videoProxyService: videoProxies,
    ...replication,
    logger,
  });
  registerMediaProtocol({
    db,
    listDetected: listDetectedDrives,
    thumbnails,
    previews,
    videoProxies,
    logger,
  });
  settings.startBackupTimer();
  createWindow();
}

async function shutdown(): Promise<void> {
  await shutdownServices({
    destroyTray,
    adoptionService,
    runService,
    healthService,
    scanService,
    settingsService,
    previewService,
    videoProxyService,
    dbClient,
    logger,
  });
}

async function bootstrap(): Promise<void> {
  installSecurityHandlers();
  screen.on("display-removed", ensureWindowVisible);
  screen.on("display-metrics-changed", ensureWindowVisible);
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
