import type Database from "better-sqlite3";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { ScanDbMethod } from "./scan-worker-protocol";
import {
  ScanApplyCatalogDbParamsSchema,
  ScanBeginStageDbParamsSchema,
  ScanCompleteStageDbParamsSchema,
  ScanFailDbParamsSchema,
  ScanFinalizeDbParamsSchema,
  ScanFinishCatalogDbParamsSchema,
  ScanIntensityDbParamsSchema,
  ScanLimitDbParamsSchema,
  ScanNowDbParamsSchema,
  ScanPrepareStageDbParamsSchema,
  ScanProgressDbParamsSchema,
  ScanSaveHashDbParamsSchema,
  ScanSaveMetadataDbParamsSchema,
  ScanSaveThumbnailDbParamsSchema,
  ScanStartDbParamsSchema,
  ScanVolumeDbParamsSchema,
} from "./scan-worker-protocol";
import {
  applyCatalogBatch,
  finalizeScan,
  finishCatalog,
} from "./repositories/scan-catalog-repository";
import {
  beginScanStage,
  completeScanStage,
  createScanSession,
  failScanSession,
  getScanState,
  interruptScanSession,
  pauseScanSession,
  resumeScanSession,
  saveScanProgress,
  setScanIntensity,
} from "./repositories/scan-session-repository";
import {
  countPendingHashes,
  countPendingMetadata,
  countPendingThumbnails,
  listPendingHashes,
  listPendingMetadata,
  listPendingThumbnails,
  resetFailedStage,
  saveHashBatch,
  saveMetadataBatch,
  saveThumbnailBatch,
} from "./repositories/scan-stage-repository";

type Handler = (params: unknown) => unknown;
type HandlerMap = Partial<Record<ScanDbMethod, Handler>>;

export interface ScanDbHandlerOptions {
  getCatalog: () => Database.Database;
  getAppDb: () => Database.Database;
}

export interface ScanDbHandler {
  handle(method: ScanDbMethod, params: unknown): unknown;
}

function sessionHandlers(catalog: () => Database.Database): HandlerMap {
  return {
    "scan.getState": (params) =>
      getScanState(catalog(), ScanVolumeDbParamsSchema.parse(params).volumeId),
    "scan.start": (params) => createScanSession(catalog(), ScanStartDbParamsSchema.parse(params)),
    "scan.pause": (params) => {
      const parsed = ScanNowDbParamsSchema.parse(params);
      return pauseScanSession(catalog(), parsed.volumeId, parsed.now);
    },
    "scan.resume": (params) => {
      const parsed = ScanNowDbParamsSchema.parse(params);
      return resumeScanSession(catalog(), parsed.volumeId, parsed.now);
    },
    "scan.interrupt": (params) => {
      const parsed = ScanNowDbParamsSchema.parse(params);
      return interruptScanSession(catalog(), parsed.volumeId, parsed.now);
    },
    "scan.fail": (params) => {
      const parsed = ScanFailDbParamsSchema.parse(params);
      return failScanSession(catalog(), parsed.volumeId, parsed.message, parsed.now);
    },
  };
}

function stageHandlers(catalog: () => Database.Database): HandlerMap {
  return {
    "scan.beginStage": (params) =>
      beginScanStage(catalog(), ScanBeginStageDbParamsSchema.parse(params)),
    "scan.saveProgress": (params) => {
      saveScanProgress(catalog(), ScanProgressDbParamsSchema.parse(params));
      return { saved: true };
    },
    "scan.completeStage": (params) =>
      completeScanStage(catalog(), ScanCompleteStageDbParamsSchema.parse(params)),
    "scan.prepareStage": (params) => {
      const parsed = ScanPrepareStageDbParamsSchema.parse(params);
      getScanState(catalog(), parsed.volumeId);
      resetFailedStage(catalog(), parsed.stage);
      return { prepared: true };
    },
    "scan.setIntensity": (params) => {
      const parsed = ScanIntensityDbParamsSchema.parse(params);
      return setScanIntensity(catalog(), parsed.volumeId, parsed.intensity, parsed.now);
    },
  };
}

function fileHandlers(
  catalog: () => Database.Database,
  appDb: () => Database.Database,
): HandlerMap {
  return {
    "scan.applyCatalogBatch": (params) =>
      applyCatalogBatch(catalog(), ScanApplyCatalogDbParamsSchema.parse(params)),
    "scan.finishCatalog": (params) =>
      finishCatalog(catalog(), ScanFinishCatalogDbParamsSchema.parse(params)),
    "scan.countPendingMetadata": (params) =>
      countPendingMetadata(catalog(), ScanVolumeDbParamsSchema.parse(params).volumeId),
    "scan.listPendingMetadata": (params) => {
      const parsed = ScanLimitDbParamsSchema.parse(params);
      return listPendingMetadata(catalog(), parsed.volumeId, parsed.limit);
    },
    "scan.saveMetadata": (params) => {
      const parsed = ScanSaveMetadataDbParamsSchema.parse(params);
      saveMetadataBatch(catalog(), parsed.volumeId, parsed.items, parsed.now);
      return { saved: true };
    },
    "scan.countPendingThumbnails": (params) =>
      countPendingThumbnails(catalog(), ScanVolumeDbParamsSchema.parse(params).volumeId),
    "scan.listPendingThumbnails": (params) => {
      const parsed = ScanLimitDbParamsSchema.parse(params);
      return listPendingThumbnails(catalog(), parsed.volumeId, parsed.limit);
    },
    "scan.saveThumbnail": (params) => {
      const parsed = ScanSaveThumbnailDbParamsSchema.parse(params);
      saveThumbnailBatch(catalog(), parsed.volumeId, parsed.items, parsed.now);
      return { saved: true };
    },
    "scan.countPendingHashes": (params) =>
      countPendingHashes(catalog(), ScanVolumeDbParamsSchema.parse(params).volumeId),
    "scan.listPendingHashes": (params) => {
      const parsed = ScanLimitDbParamsSchema.parse(params);
      return listPendingHashes(catalog(), parsed.volumeId, parsed.limit);
    },
    "scan.saveHash": (params) => {
      const parsed = ScanSaveHashDbParamsSchema.parse(params);
      saveHashBatch(catalog(), parsed.volumeId, parsed.items, parsed.now);
      return { saved: true };
    },
    "scan.finalize": (params) => {
      const parsed = ScanFinalizeDbParamsSchema.parse(params);
      return finalizeScan(catalog(), {
        catalogDb: catalog(),
        appDb: appDb(),
        volumeId: parsed.volumeId,
        now: parsed.now,
      });
    },
  };
}

export function createScanDbHandlers(options: ScanDbHandlerOptions): ScanDbHandler {
  const catalog = (): Database.Database => options.getCatalog();
  const handlers: HandlerMap = {
    ...sessionHandlers(catalog),
    ...stageHandlers(catalog),
    ...fileHandlers(catalog, options.getAppDb),
  };

  return {
    handle(method: ScanDbMethod, params: unknown): unknown {
      const handler = handlers[method];
      if (handler === undefined) {
        throw new AppError(
          APP_ERROR_CODES.INVALID_REQUEST,
          `Unknown scan database method: ${method}`,
        );
      }
      return handler(params);
    },
  };
}
