import type Database from "better-sqlite3";
import { APP_ERROR_CODES, AppError } from "@shared/domain/errors";
import type { HealthDbMethod } from "./health-worker-protocol";
import {
  HealthConfirmMovedDbParamsSchema,
  HealthDismissMovedDbParamsSchema,
  HealthDuplicatesDbParamsSchema,
  HealthMissingDbParamsSchema,
  HealthMissingDuplicatesDbParamsSchema,
  HealthPurgeMissingDuplicatesDbParamsSchema,
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
  getMissingFiles,
  getMovedCandidates,
} from "./repositories/health-repository";
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

export function createHealthDbHandlers(options: HealthDbHandlerOptions): HealthDbHandler {
  const catalog = (): Database.Database => options.getCatalog();
  const handlers: HandlerMap = {
    "health.getSummary": () => getHealthSummary(catalog()),
    "health.getDuplicates": (params) => {
      const parsed = HealthDuplicatesDbParamsSchema.parse(params);
      return getDuplicateGroups(catalog(), parsed.offset ?? 0, parsed.limit ?? 25);
    },
    "health.getMissing": (params) => {
      const parsed = HealthMissingDbParamsSchema.parse(params);
      return getMissingFiles(catalog(), parsed.offset ?? 0, parsed.limit ?? 50);
    },
    "health.getMissingDuplicates": (params) => {
      const parsed = HealthMissingDuplicatesDbParamsSchema.parse(params);
      return getMissingDuplicates(catalog(), parsed.offset ?? 0, parsed.limit ?? 50);
    },
    "health.purgeMissingDuplicates": (params) => {
      const parsed = HealthPurgeMissingDuplicatesDbParamsSchema.parse(params);
      return purgeMissingDuplicates(catalog(), parsed.fileIds);
    },
    "health.getMoved": () => getMovedCandidates(catalog()),
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
