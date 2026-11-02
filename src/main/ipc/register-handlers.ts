import { ipcMain } from "electron";
import type { CatalogSummary, DriveInfo } from "@shared/contracts/drives";
import {
  ConfirmDriveIdentityParamsSchema,
  InitializeCatalogParamsSchema,
  IPC_CHANNELS,
  OpenCatalogParamsSchema,
  type AppInfo,
} from "@shared/contracts/ipc";
import {
  DuplicateGroupsParamsSchema,
  MissingDuplicatesParamsSchema,
  type DuplicateCleanupState,
  type DuplicateCleanupSummary,
  MissingFileTargetsSchema,
  MissingFilesParamsSchema,
  MovedCandidateTargetsSchema,
  MovedCandidatesParamsSchema,
  MovedDismissTargetsSchema,
  PurgeMissingDuplicatesParamsSchema,
  ValidationStartParamsSchema,
  type DuplicateGroupsPage,
  type HealthSummary,
  type MissingActionResult,
  type MissingDuplicatesPage,
  type MissingFilesPage,
  type MovedActionResult,
  type MovedCandidatesPage,
  type PurgeMissingDuplicatesResult,
  type ValidationState,
} from "@shared/contracts/health";
import { LibraryItemTargetParamsSchema } from "@shared/contracts/library";
import { OtherFilesParamsSchema, type OtherFilesPage } from "@shared/contracts/other-files";
import {
  type BackupResult,
  type CacheClearResult,
  type SettingsInfo,
} from "@shared/contracts/settings";
import type { AppService } from "../modules/app/application/app-service";
import type { DriveService } from "../modules/drives/application/drive-service";
import type { CleanupService } from "../modules/health/application/cleanup-service";
import type { HealthService } from "../modules/health/application/health-service";
import type { LibraryService } from "../modules/library/application/library-service";
import type { DestinationService } from "../modules/replication/application/destination-service";
import type { AdoptionService } from "../modules/replication/application/adoption-service";
import type { PlanService } from "../modules/replication/application/plan-service";
import type { PromotionService } from "../modules/replication/application/promotion-service";
import type { RunService } from "../modules/replication/application/run-service";
import type { ScanService } from "../modules/scanning/application/scan-service";
import type { SettingsService } from "../modules/settings/application/settings-service";
import type { VideoProxyService } from "../modules/media/video-proxy";
import type { Logger } from "../logging/types";
import { registerLibraryHandlers } from "./register-library-handlers";
import { registerReplicationHandlers } from "./register-replication-handlers";
import { registerScanHandlers } from "./register-scan-handlers";
import { registerVideoProxyHandlers } from "./register-video-proxy-handlers";
import { respond } from "./respond";

export interface IpcServices {
  appService: AppService;
  driveService: DriveService;
  scanService: ScanService;
  libraryService: LibraryService;
  healthService: HealthService;
  cleanupService: CleanupService;
  settingsService: SettingsService;
  destinationService: DestinationService;
  adoptionService: AdoptionService;
  planService: PlanService;
  runService: RunService;
  promotionService: PromotionService;
  videoProxyService: VideoProxyService;
  logger: Logger;
}

export function registerIpcHandlers(services: IpcServices): void {
  const {
    appService,
    driveService,
    scanService,
    libraryService,
    healthService,
    cleanupService,
    settingsService,
    destinationService,
    adoptionService,
    planService,
    runService,
    promotionService,
    videoProxyService,
    logger,
  } = services;

  ipcMain.handle(IPC_CHANNELS.getAppInfo, (event) =>
    respond<AppInfo>(event, IPC_CHANNELS.getAppInfo, logger, () => appService.getInfo()),
  );

  ipcMain.handle(IPC_CHANNELS.listDrives, (event) =>
    respond<DriveInfo[]>(event, IPC_CHANNELS.listDrives, logger, () => driveService.listDrives()),
  );

  ipcMain.handle(IPC_CHANNELS.initializeCatalog, (event, params: unknown) =>
    respond<CatalogSummary>(event, IPC_CHANNELS.initializeCatalog, logger, () =>
      driveService.initializeCatalog(InitializeCatalogParamsSchema.parse(params).volumeId),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.openCatalog, (event, params: unknown) =>
    respond<CatalogSummary>(event, IPC_CHANNELS.openCatalog, logger, () =>
      driveService.openCatalog(OpenCatalogParamsSchema.parse(params).volumeId),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.confirmDriveIdentity, (event, params: unknown) =>
    respond<void>(event, IPC_CHANNELS.confirmDriveIdentity, logger, () =>
      driveService.confirmDriveIdentity(ConfirmDriveIdentityParamsSchema.parse(params).volumeId),
    ),
  );

  registerScanHandlers(scanService, logger, () => promotionService.closeRollbackWindow());
  registerLibraryHandlers(libraryService, logger, () => promotionService.closeRollbackWindow());
  registerVideoProxyHandlers(videoProxyService, logger);
  registerReplicationHandlers({
    destinationService,
    adoptionService,
    planService,
    runService,
    promotionService,
    logger,
  });
  registerHealthHandlers(healthService, logger, () => promotionService.closeRollbackWindow());
  registerCleanupHandlers(cleanupService, logger, () => promotionService.closeRollbackWindow());
  registerSettingsHandlers(settingsService, logger);
  registerOtherFilesHandler(libraryService, logger);
  registerFileActionHandlers(libraryService, logger);
}

function registerHealthHandlers(
  healthService: HealthService,
  logger: Logger,
  onSourceMutation?: () => Promise<void>,
): void {
  ipcMain.handle(IPC_CHANNELS.getHealthSummary, (event) =>
    respond<HealthSummary>(event, IPC_CHANNELS.getHealthSummary, logger, () =>
      healthService.getSummary(),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.getHealthDuplicates, (event, params: unknown) =>
    respond<DuplicateGroupsPage>(event, IPC_CHANNELS.getHealthDuplicates, logger, () => {
      const parsed = DuplicateGroupsParamsSchema.parse(params);
      return healthService.getDuplicates(parsed.offset, parsed.limit);
    }),
  );

  ipcMain.handle(IPC_CHANNELS.getHealthMissing, (event, params: unknown) =>
    respond<MissingFilesPage>(event, IPC_CHANNELS.getHealthMissing, logger, () => {
      const parsed = MissingFilesParamsSchema.parse(params);
      return healthService.getMissing(parsed.offset, parsed.limit, parsed.dismissedOnly);
    }),
  );

  ipcMain.handle(IPC_CHANNELS.getHealthMissingDuplicates, (event, params: unknown) =>
    respond<MissingDuplicatesPage>(event, IPC_CHANNELS.getHealthMissingDuplicates, logger, () => {
      const parsed = MissingDuplicatesParamsSchema.parse(params);
      return healthService.getMissingDuplicates(parsed.offset, parsed.limit);
    }),
  );

  ipcMain.handle(IPC_CHANNELS.purgeHealthMissingDuplicates, (event, params: unknown) =>
    respond<PurgeMissingDuplicatesResult>(
      event,
      IPC_CHANNELS.purgeHealthMissingDuplicates,
      logger,
      () => {
        const parsed = PurgeMissingDuplicatesParamsSchema.parse(params);
        return healthService.purgeMissingDuplicates(parsed.fileIds, parsed.includePendingMoves);
      },
    ),
  );

  ipcMain.handle(IPC_CHANNELS.dismissHealthMissing, (event, params: unknown) =>
    respond<MissingActionResult>(event, IPC_CHANNELS.dismissHealthMissing, logger, () =>
      healthService.dismissMissing(MissingFileTargetsSchema.parse(params).fileIds),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.restoreHealthMissing, (event, params: unknown) =>
    respond<MissingActionResult>(event, IPC_CHANNELS.restoreHealthMissing, logger, () =>
      healthService.restoreMissing(MissingFileTargetsSchema.parse(params).fileIds),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.getHealthMoved, (event, params: unknown) =>
    respond<MovedCandidatesPage>(event, IPC_CHANNELS.getHealthMoved, logger, () => {
      const parsed = MovedCandidatesParamsSchema.parse(params);
      return healthService.getMoved(parsed.offset, parsed.limit);
    }),
  );

  ipcMain.handle(IPC_CHANNELS.confirmHealthMoved, (event, params: unknown) =>
    respond<MovedActionResult>(event, IPC_CHANNELS.confirmHealthMoved, logger, () =>
      healthService.confirmMoved(MovedCandidateTargetsSchema.parse(params).candidateIds),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.dismissHealthMoved, (event, params: unknown) =>
    respond<MovedActionResult>(event, IPC_CHANNELS.dismissHealthMoved, logger, () =>
      healthService.dismissMoved(MovedDismissTargetsSchema.parse(params).candidateIds),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.getValidationState, (event) =>
    respond<ValidationState>(event, IPC_CHANNELS.getValidationState, logger, () =>
      healthService.getValidationState(),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.startValidation, (event, params: unknown) =>
    respond<ValidationState>(event, IPC_CHANNELS.startValidation, logger, async () => {
      const state = await healthService.startValidation(
        ValidationStartParamsSchema.parse(params).levels,
      );
      await onSourceMutation?.();
      return state;
    }),
  );

  ipcMain.handle(IPC_CHANNELS.pauseValidation, (event) =>
    respond<ValidationState>(event, IPC_CHANNELS.pauseValidation, logger, () =>
      healthService.pauseValidation(),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.resumeValidation, (event) =>
    respond<ValidationState>(event, IPC_CHANNELS.resumeValidation, logger, async () => {
      const state = await healthService.resumeValidation();
      await onSourceMutation?.();
      return state;
    }),
  );
}

function registerCleanupHandlers(
  cleanupService: CleanupService,
  logger: Logger,
  onSourceMutation?: () => Promise<void>,
): void {
  ipcMain.handle(IPC_CHANNELS.getCleanupSummary, (event) =>
    respond<DuplicateCleanupSummary>(event, IPC_CHANNELS.getCleanupSummary, logger, () =>
      cleanupService.getSummary(),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.getCleanupState, (event) =>
    respond<DuplicateCleanupState>(event, IPC_CHANNELS.getCleanupState, logger, () =>
      cleanupService.getState(),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.startCleanup, (event) =>
    respond<DuplicateCleanupState>(event, IPC_CHANNELS.startCleanup, logger, async () => {
      const state = await cleanupService.start();
      await onSourceMutation?.();
      return state;
    }),
  );

  ipcMain.handle(IPC_CHANNELS.cancelCleanup, (event) =>
    respond<DuplicateCleanupState>(event, IPC_CHANNELS.cancelCleanup, logger, () =>
      cleanupService.cancel(),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.revealCleanupQuarantine, (event) =>
    respond<void>(event, IPC_CHANNELS.revealCleanupQuarantine, logger, () =>
      cleanupService.revealQuarantine(),
    ),
  );
}

function registerOtherFilesHandler(libraryService: LibraryService, logger: Logger): void {
  ipcMain.handle(IPC_CHANNELS.getOtherFiles, (event, params: unknown) =>
    respond<OtherFilesPage>(event, IPC_CHANNELS.getOtherFiles, logger, () =>
      libraryService.getOtherFiles(OtherFilesParamsSchema.parse(params)),
    ),
  );
}

function registerSettingsHandlers(settingsService: SettingsService, logger: Logger): void {
  ipcMain.handle(IPC_CHANNELS.getSettingsInfo, (event) =>
    respond<SettingsInfo>(event, IPC_CHANNELS.getSettingsInfo, logger, () =>
      settingsService.getInfo(),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.clearCache, (event) =>
    respond<CacheClearResult>(event, IPC_CHANNELS.clearCache, logger, () =>
      settingsService.clearCache(),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.runBackup, (event) =>
    respond<BackupResult>(event, IPC_CHANNELS.runBackup, logger, () => settingsService.runBackup()),
  );
}

function registerFileActionHandlers(libraryService: LibraryService, logger: Logger): void {
  ipcMain.handle(IPC_CHANNELS.revealLibraryItem, (event, params: unknown) =>
    respond<void>(event, IPC_CHANNELS.revealLibraryItem, logger, () =>
      libraryService.reveal(LibraryItemTargetParamsSchema.parse(params).fileId),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.openLibraryItem, (event, params: unknown) =>
    respond<void>(event, IPC_CHANNELS.openLibraryItem, logger, () =>
      libraryService.open(LibraryItemTargetParamsSchema.parse(params).fileId),
    ),
  );
}
