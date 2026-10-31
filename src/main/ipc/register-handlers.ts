import { ipcMain, type IpcMainInvokeEvent } from "electron";
import type { CatalogSummary, DriveInfo } from "@shared/contracts/drives";
import {
  ConfirmDriveIdentityParamsSchema,
  InitializeCatalogParamsSchema,
  IPC_CHANNELS,
  OpenCatalogParamsSchema,
  type AppInfo,
  type IpcResult,
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
import {
  LibraryClearDateParamsSchema,
  LibraryItemParamsSchema,
  LibraryItemTargetParamsSchema,
  LibrarySetDateParamsSchema,
  LibraryTimelineIndexParamsSchema,
  LibraryTimelineParamsSchema,
  LibraryUndatedParamsSchema,
  type LibraryDateMutationResult,
  type LibraryItemDetails,
  type LibrarySummary,
  type LibraryTimelineIndex,
  type LibraryTimelinePage,
  type LibraryUndatedPage,
} from "@shared/contracts/library";
import {
  ScanIntensityParamsSchema,
  ScanStartParamsSchema,
  ScanVolumeParamsSchema,
  type ScanState,
} from "@shared/contracts/scan";
import { APP_ERROR_CODES, AppError, toAppErrorPayload } from "@shared/domain/errors";
import type { AppService } from "../modules/app/application/app-service";
import type { DriveService } from "../modules/drives/application/drive-service";
import type { HealthService } from "../modules/health/application/health-service";
import type { LibraryService } from "../modules/library/application/library-service";
import type { ScanService } from "../modules/scanning/application/scan-service";
import type { Logger } from "../logging/types";

export interface IpcServices {
  appService: AppService;
  driveService: DriveService;
  scanService: ScanService;
  libraryService: LibraryService;
  healthService: HealthService;
  logger: Logger;
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const url = event.senderFrame?.url ?? "";
  const developmentUrl = process.env.ELECTRON_RENDERER_URL;

  if (developmentUrl !== undefined && url.startsWith(developmentUrl)) {
    return;
  }
  if (url.startsWith("file://")) {
    return;
  }

  throw new AppError(APP_ERROR_CODES.FORBIDDEN, "IPC request came from an untrusted sender");
}

async function respond<T>(
  event: IpcMainInvokeEvent,
  method: string,
  logger: Logger,
  operation: () => Promise<T> | T,
): Promise<IpcResult<T>> {
  try {
    assertTrustedSender(event);
    const data = await operation();
    return { ok: true, data };
  } catch (error) {
    const payload = toAppErrorPayload(error);
    logger.error(`${method} failed`, { code: payload.code, message: payload.message });
    return { ok: false, error: payload };
  }
}

export function registerIpcHandlers(services: IpcServices): void {
  const { appService, driveService, scanService, libraryService, healthService, logger } = services;

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

  ipcMain.handle(IPC_CHANNELS.getScanState, (event, params: unknown) =>
    respond<ScanState>(event, IPC_CHANNELS.getScanState, logger, () =>
      scanService.getState(ScanVolumeParamsSchema.parse(params).volumeId),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.startScan, (event, params: unknown) =>
    respond<ScanState>(event, IPC_CHANNELS.startScan, logger, () => {
      const parsed = ScanStartParamsSchema.parse(params);
      return scanService.startScan(parsed.volumeId, parsed.intensity);
    }),
  );

  ipcMain.handle(IPC_CHANNELS.pauseScan, (event, params: unknown) =>
    respond<ScanState>(event, IPC_CHANNELS.pauseScan, logger, () =>
      scanService.pauseScan(ScanVolumeParamsSchema.parse(params).volumeId),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.resumeScan, (event, params: unknown) =>
    respond<ScanState>(event, IPC_CHANNELS.resumeScan, logger, () =>
      scanService.resumeScan(ScanVolumeParamsSchema.parse(params).volumeId),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.setScanIntensity, (event, params: unknown) =>
    respond<ScanState>(event, IPC_CHANNELS.setScanIntensity, logger, () => {
      const parsed = ScanIntensityParamsSchema.parse(params);
      return scanService.setIntensity(parsed.volumeId, parsed.intensity);
    }),
  );

  ipcMain.handle(IPC_CHANNELS.getLibrarySummary, (event) =>
    respond<LibrarySummary>(event, IPC_CHANNELS.getLibrarySummary, logger, () =>
      libraryService.getSummary(),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.getLibraryTimeline, (event, params: unknown) =>
    respond<LibraryTimelinePage>(event, IPC_CHANNELS.getLibraryTimeline, logger, () =>
      libraryService.getTimeline(LibraryTimelineParamsSchema.parse(params)),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.getLibraryTimelineIndex, (event, params: unknown) =>
    respond<LibraryTimelineIndex>(event, IPC_CHANNELS.getLibraryTimelineIndex, logger, () =>
      libraryService.getTimelineIndex(LibraryTimelineIndexParamsSchema.parse(params)),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.getLibraryItem, (event, params: unknown) =>
    respond<LibraryItemDetails>(event, IPC_CHANNELS.getLibraryItem, logger, () =>
      libraryService.getItem(LibraryItemParamsSchema.parse(params)),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.getLibraryUndated, (event, params: unknown) =>
    respond<LibraryUndatedPage>(event, IPC_CHANNELS.getLibraryUndated, logger, () =>
      libraryService.getUndated(LibraryUndatedParamsSchema.parse(params)),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.setLibraryDate, (event, params: unknown) =>
    respond<LibraryDateMutationResult>(event, IPC_CHANNELS.setLibraryDate, logger, () =>
      libraryService.setDate(LibrarySetDateParamsSchema.parse(params)),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.clearLibraryDate, (event, params: unknown) =>
    respond<LibraryDateMutationResult>(event, IPC_CHANNELS.clearLibraryDate, logger, () =>
      libraryService.clearDate(LibraryClearDateParamsSchema.parse(params)),
    ),
  );

  registerHealthHandlers(healthService, logger);

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
