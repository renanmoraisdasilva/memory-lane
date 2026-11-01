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
  MissingFilesParamsSchema,
  MovedCandidateTargetsSchema,
  ValidationStartParamsSchema,
  type DuplicateGroupsPage,
  type HealthSummary,
  type MissingFilesPage,
  type MovedActionResult,
  type MovedCandidatesPage,
  type ValidationState,
} from "@shared/contracts/health";
import { LibraryItemTargetParamsSchema } from "@shared/contracts/library";
import { OtherFilesParamsSchema, type OtherFilesPage } from "@shared/contracts/other-files";
import { REPLICATION_CHANNELS } from "@shared/contracts/replication/channels";
import {
  AdoptionDestinationParamsSchema,
  GetDestinationParamsSchema,
  RegisterDestinationParamsSchema,
  UpdateDestinationParamsSchema,
  type AdoptionState,
  type CoverageSummary,
  type DestinationCandidate,
  type DestinationDetail,
  type DestinationSummary,
  type ReplicationOverview,
  type ReplicationPlan,
} from "@shared/contracts/replication/types";
import {
  type BackupResult,
  type CacheClearResult,
  type SettingsInfo,
} from "@shared/contracts/settings";
import type { AppService } from "../modules/app/application/app-service";
import type { DriveService } from "../modules/drives/application/drive-service";
import type { HealthService } from "../modules/health/application/health-service";
import type { LibraryService } from "../modules/library/application/library-service";
import type { DestinationService } from "../modules/replication/application/destination-service";
import type { AdoptionService } from "../modules/replication/application/adoption-service";
import type { PlanService } from "../modules/replication/application/plan-service";
import type { ScanService } from "../modules/scanning/application/scan-service";
import type { SettingsService } from "../modules/settings/application/settings-service";
import type { Logger } from "../logging/types";
import { registerLibraryHandlers } from "./register-library-handlers";
import { registerScanHandlers } from "./register-scan-handlers";
import { respond } from "./respond";

export interface IpcServices {
  appService: AppService;
  driveService: DriveService;
  scanService: ScanService;
  libraryService: LibraryService;
  healthService: HealthService;
  settingsService: SettingsService;
  destinationService: DestinationService;
  adoptionService: AdoptionService;
  planService: PlanService;
  logger: Logger;
}

export function registerIpcHandlers(services: IpcServices): void {
  const {
    appService,
    driveService,
    scanService,
    libraryService,
    healthService,
    settingsService,
    destinationService,
    adoptionService,
    planService,
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

  registerScanHandlers(scanService, logger);
  registerLibraryHandlers(libraryService, logger);
  registerReplicationHandlers(destinationService, adoptionService, planService, logger);
  registerHealthHandlers(healthService, logger);
  registerSettingsHandlers(settingsService, logger);
  registerOtherFilesHandler(libraryService, logger);
  registerFileActionHandlers(libraryService, logger);
}

function registerReplicationHandlers(
  destinationService: DestinationService,
  adoptionService: AdoptionService,
  planService: PlanService,
  logger: Logger,
): void {
  ipcMain.handle(REPLICATION_CHANNELS.getOverview, (event) =>
    respond<ReplicationOverview>(event, REPLICATION_CHANNELS.getOverview, logger, () =>
      planService.getOverview(),
    ),
  );

  ipcMain.handle(REPLICATION_CHANNELS.getAdoptionState, (event, params: unknown) =>
    respond<AdoptionState>(event, REPLICATION_CHANNELS.getAdoptionState, logger, () => {
      const parsed = AdoptionDestinationParamsSchema.parse(params);
      return adoptionService.getState(parsed.destinationId);
    }),
  );

  ipcMain.handle(REPLICATION_CHANNELS.startAdoption, (event, params: unknown) =>
    respond<AdoptionState>(event, REPLICATION_CHANNELS.startAdoption, logger, () => {
      const parsed = AdoptionDestinationParamsSchema.parse(params);
      return adoptionService.start(parsed.destinationId);
    }),
  );

  ipcMain.handle(REPLICATION_CHANNELS.pauseAdoption, (event, params: unknown) =>
    respond<AdoptionState>(event, REPLICATION_CHANNELS.pauseAdoption, logger, () => {
      const parsed = AdoptionDestinationParamsSchema.parse(params);
      return adoptionService.pause(parsed.destinationId);
    }),
  );

  ipcMain.handle(REPLICATION_CHANNELS.resumeAdoption, (event, params: unknown) =>
    respond<AdoptionState>(event, REPLICATION_CHANNELS.resumeAdoption, logger, () => {
      const parsed = AdoptionDestinationParamsSchema.parse(params);
      return adoptionService.resume(parsed.destinationId);
    }),
  );

  ipcMain.handle(REPLICATION_CHANNELS.getPlan, (event) =>
    respond<ReplicationPlan>(event, REPLICATION_CHANNELS.getPlan, logger, () =>
      planService.getPlan(),
    ),
  );

  ipcMain.handle(REPLICATION_CHANNELS.getCoverage, (event) =>
    respond<CoverageSummary>(event, REPLICATION_CHANNELS.getCoverage, logger, () =>
      planService.getCoverage(),
    ),
  );

  ipcMain.handle(REPLICATION_CHANNELS.listDestinationCandidates, (event) =>
    respond<DestinationCandidate[]>(
      event,
      REPLICATION_CHANNELS.listDestinationCandidates,
      logger,
      () => destinationService.listCandidates(),
    ),
  );

  ipcMain.handle(REPLICATION_CHANNELS.listDestinations, (event) =>
    respond<DestinationSummary[]>(event, REPLICATION_CHANNELS.listDestinations, logger, () =>
      destinationService.list(),
    ),
  );

  ipcMain.handle(REPLICATION_CHANNELS.getDestination, (event, params: unknown) =>
    respond<DestinationDetail>(event, REPLICATION_CHANNELS.getDestination, logger, () => {
      const parsed = GetDestinationParamsSchema.parse(params);
      return destinationService.get(Number(parsed.destinationId));
    }),
  );

  ipcMain.handle(REPLICATION_CHANNELS.registerDestination, (event, params: unknown) =>
    respond<DestinationDetail>(event, REPLICATION_CHANNELS.registerDestination, logger, () =>
      destinationService.register(RegisterDestinationParamsSchema.parse(params)),
    ),
  );

  ipcMain.handle(REPLICATION_CHANNELS.updateDestination, (event, params: unknown) =>
    respond<DestinationDetail>(event, REPLICATION_CHANNELS.updateDestination, logger, () =>
      destinationService.update(UpdateDestinationParamsSchema.parse(params)),
    ),
  );
}

function registerHealthHandlers(healthService: HealthService, logger: Logger): void {
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
      return healthService.getMissing(parsed.offset, parsed.limit);
    }),
  );

  ipcMain.handle(IPC_CHANNELS.getHealthMoved, (event) =>
    respond<MovedCandidatesPage>(event, IPC_CHANNELS.getHealthMoved, logger, () =>
      healthService.getMoved(),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.confirmHealthMoved, (event, params: unknown) =>
    respond<MovedActionResult>(event, IPC_CHANNELS.confirmHealthMoved, logger, () =>
      healthService.confirmMoved(MovedCandidateTargetsSchema.parse(params).candidateIds),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.dismissHealthMoved, (event, params: unknown) =>
    respond<MovedActionResult>(event, IPC_CHANNELS.dismissHealthMoved, logger, () =>
      healthService.dismissMoved(MovedCandidateTargetsSchema.parse(params).candidateIds),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.getValidationState, (event) =>
    respond<ValidationState>(event, IPC_CHANNELS.getValidationState, logger, () =>
      healthService.getValidationState(),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.startValidation, (event, params: unknown) =>
    respond<ValidationState>(event, IPC_CHANNELS.startValidation, logger, () =>
      healthService.startValidation(ValidationStartParamsSchema.parse(params).levels),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.pauseValidation, (event) =>
    respond<ValidationState>(event, IPC_CHANNELS.pauseValidation, logger, () =>
      healthService.pauseValidation(),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.resumeValidation, (event) =>
    respond<ValidationState>(event, IPC_CHANNELS.resumeValidation, logger, () =>
      healthService.resumeValidation(),
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
