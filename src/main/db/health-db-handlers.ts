import type Database from "better-sqlite3";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { HealthDbMethod } from "./health-worker-protocol";
import {
  HealthConfirmMovedDbParamsSchema,
  HealthDismissMissingDbParamsSchema,
  HealthDismissMovedDbParamsSchema,
  HealthDuplicatesDbParamsSchema,
  HealthMissingDbParamsSchema,
  HealthMissingDuplicatesDbParamsSchema,
  HealthMovedByIdsDbParamsSchema,
  HealthMovedDbParamsSchema,
  HealthPurgeMissingDuplicatesDbParamsSchema,
  HealthRestoreMissingDbParamsSchema,
  HealthValidationFailDbParamsSchema,
  HealthValidationLevelDbParamsSchema,
  HealthValidationPendingDbParamsSchema,
  HealthValidationSaveDbParamsSchema,
  HealthValidationSessionDbParamsSchema,
  HealthValidationStartDbParamsSchema,
} from "./health-worker-protocol";
import {
  confirmMovedCandidates,
  dismissMovedCandidates,
  getDuplicateGroups,
  getHealthSummary,
} from "./repositories/health-repository";
import {
  dismissMissingFiles,
  getMissingFiles,
  restoreMissingFiles,
} from "./repositories/health-missing-repository";
import {
  getMovedCandidates,
  getMovedCandidatesByIds,
} from "./repositories/health-moved-repository";
import {
  getMissingDuplicates,
  purgeMissingDuplicates,
} from "./repositories/health-missing-duplicates-repository";
import {
  createValidation,
  failValidation,
  finishValidation,
  getValidationState,
  listPendingValidation,
  pauseValidation,
  resumeValidation,
  saveValidationResults,
  setValidationLevel,
} from "./repositories/validation-repository";

type Handler = (params: unknown) => unknown;
type HandlerMap = Partial<Record<HealthDbMethod, Handler>>;

export interface HealthDbHandlerOptions {
  getCatalog: () => Database.Database;
}

export interface HealthDbHandler {
  handle(method: HealthDbMethod, params: unknown): unknown;
}

function createMissingHandlers(catalog: () => Database.Database): HandlerMap {
  return {
    "health.getMissing": (params) => {
      const parsed = HealthMissingDbParamsSchema.parse(params);
      return getMissingFiles(
        catalog(),
        parsed.offset ?? 0,
        parsed.limit ?? 50,
        parsed.dismissedOnly ?? false,
      );
    },
    "health.getMissingDuplicates": (params) => {
      const parsed = HealthMissingDuplicatesDbParamsSchema.parse(params);
      return getMissingDuplicates(catalog(), parsed.offset ?? 0, parsed.limit ?? 50);
    },
    "health.purgeMissingDuplicates": (params) => {
      const parsed = HealthPurgeMissingDuplicatesDbParamsSchema.parse(params);
      return purgeMissingDuplicates(catalog(), parsed.fileIds, parsed.includePendingMoves);
    },
    "health.dismissMissing": (params) => {
      const parsed = HealthDismissMissingDbParamsSchema.parse(params);
      return dismissMissingFiles(catalog(), parsed.fileIds, parsed.now);
    },
    "health.restoreMissing": (params) => {
      const parsed = HealthRestoreMissingDbParamsSchema.parse(params);
      return restoreMissingFiles(catalog(), parsed.fileIds);
    },
  };
}

export function createHealthDbHandlers(options: HealthDbHandlerOptions): HealthDbHandler {
  const catalog = (): Database.Database => options.getCatalog();
  const handlers: HandlerMap = {
    "health.getSummary": () => getHealthSummary(catalog()),
    "health.getDuplicates": (params) => {
      const parsed = HealthDuplicatesDbParamsSchema.parse(params);
      return getDuplicateGroups(catalog(), parsed.offset ?? 0, parsed.limit ?? 25);
    },
    ...createMissingHandlers(catalog),
    "health.getMoved": (params) => {
      const parsed = HealthMovedDbParamsSchema.parse(params);
      return getMovedCandidates(catalog(), parsed.offset ?? 0, parsed.limit ?? 50);
    },
    "health.getMovedByIds": (params) => {
      const parsed = HealthMovedByIdsDbParamsSchema.parse(params);
      return getMovedCandidatesByIds(catalog(), parsed.candidateIds);
    },
    "health.confirmMoved": (params) => {
      const parsed = HealthConfirmMovedDbParamsSchema.parse(params);
      return confirmMovedCandidates(catalog(), parsed.candidateIds, parsed.now);
    },
    "health.dismissMoved": (params) =>
      dismissMovedCandidates(
        catalog(),
        HealthDismissMovedDbParamsSchema.parse(params).candidateIds,
      ),
    "health.getValidationState": () => getValidationState(catalog()),
    "health.createValidation": (params) => {
      const parsed = HealthValidationStartDbParamsSchema.parse(params);
      return createValidation(catalog(), parsed.levels, parsed.now);
    },
    "health.setValidationLevel": (params) => {
      const parsed = HealthValidationLevelDbParamsSchema.parse(params);
      setValidationLevel(catalog(), parsed.sessionId, parsed.level, parsed.now);
      return { saved: true };
    },
    "health.pauseValidation": (params) => {
      const parsed = HealthValidationSessionDbParamsSchema.parse(params);
      pauseValidation(catalog(), parsed.sessionId, parsed.now);
      return getValidationState(catalog());
    },
    "health.resumeValidation": (params) => {
      const parsed = HealthValidationSessionDbParamsSchema.parse(params);
      resumeValidation(catalog(), parsed.sessionId, parsed.now);
      return getValidationState(catalog());
    },
    "health.finishValidation": (params) => {
      const parsed = HealthValidationSessionDbParamsSchema.parse(params);
      finishValidation(catalog(), parsed.sessionId, parsed.now);
      return getValidationState(catalog());
    },
    "health.failValidation": (params) => {
      const parsed = HealthValidationFailDbParamsSchema.parse(params);
      failValidation(catalog(), parsed.sessionId, parsed.message, parsed.now);
      return getValidationState(catalog());
    },
    "health.listPendingValidation": (params) => {
      const parsed = HealthValidationPendingDbParamsSchema.parse(params);
      return listPendingValidation(catalog(), parsed.sessionId, parsed.level, parsed.limit);
    },
    "health.saveValidationResults": (params) => {
      const parsed = HealthValidationSaveDbParamsSchema.parse(params);
      saveValidationResults(catalog(), parsed.sessionId, parsed.items, parsed.now);
      return getValidationState(catalog());
    },
  };

  return {
    handle(method: HealthDbMethod, params: unknown): unknown {
      const handler = handlers[method];
      if (handler === undefined) {
        throw new AppError(
          APP_ERROR_CODES.INVALID_REQUEST,
          `Unknown health database method: ${method}`,
        );
      }
      return handler(params);
    },
  };
}
