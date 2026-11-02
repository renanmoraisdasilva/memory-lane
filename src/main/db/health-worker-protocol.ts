import { z } from "zod";
import {
  DuplicateGroupsParamsSchema,
  MissingDuplicatesParamsSchema,
  MissingFilesParamsSchema,
  MovedCandidateTargetsSchema,
  MovedCandidatesParamsSchema,
  MovedDismissTargetsSchema,
  PurgeMissingDuplicatesParamsSchema,
  ValidationLevelSchema,
  ValidationStartParamsSchema,
} from "@shared/contracts/health";

export const HEALTH_DB_METHODS = [
  "health.getSummary",
  "health.getDuplicates",
  "health.getMissing",
  "health.getMissingDuplicates",
  "health.purgeMissingDuplicates",
  "health.getMoved",
  "health.getMovedByIds",
  "health.confirmMoved",
  "health.dismissMoved",
  "health.getValidationState",
  "health.createValidation",
  "health.setValidationLevel",
  "health.pauseValidation",
  "health.resumeValidation",
  "health.finishValidation",
  "health.failValidation",
  "health.listPendingValidation",
  "health.saveValidationResults",
] as const;

export type HealthDbMethod = (typeof HEALTH_DB_METHODS)[number];

export const HealthDuplicatesDbParamsSchema = DuplicateGroupsParamsSchema;
export const HealthMissingDbParamsSchema = MissingFilesParamsSchema;
export const HealthMissingDuplicatesDbParamsSchema = MissingDuplicatesParamsSchema;
export const HealthPurgeMissingDuplicatesDbParamsSchema = PurgeMissingDuplicatesParamsSchema;
export const HealthMovedDbParamsSchema = MovedCandidatesParamsSchema;
export const HealthMovedByIdsDbParamsSchema = MovedCandidateTargetsSchema;
export const HealthValidationLevelDbParamsSchema = z.object({
  sessionId: z.number().int().positive(),
  level: ValidationLevelSchema,
  now: z.string().min(1),
});
export const HealthValidationSessionDbParamsSchema = z.object({
  sessionId: z.number().int().positive(),
  now: z.string().min(1),
});
export const HealthValidationFailDbParamsSchema = z.object({
  sessionId: z.number().int().positive(),
  message: z.string().min(1),
  now: z.string().min(1),
});
export const HealthValidationPendingDbParamsSchema = z.object({
  sessionId: z.number().int().positive(),
  level: ValidationLevelSchema,
  limit: z.number().int().positive().max(500),
});
export const HealthValidationResultItemSchema = z.object({
  fileId: z.number().int().positive(),
  level: ValidationLevelSchema,
  result: z.enum([
    "verified",
    "missing",
    "metadataChanged",
    "hashVerified",
    "hashMismatch",
    "metadataUpdated",
    "metadataFailed",
    "unreadable",
  ]),
  detail: z.string().nullable(),
  actualHash: z.string().nullable().optional(),
});
export const HealthValidationSaveDbParamsSchema = z.object({
  sessionId: z.number().int().positive(),
  items: z.array(HealthValidationResultItemSchema),
  now: z.string().min(1),
});
export const HealthConfirmMovedDbParamsSchema = MovedCandidateTargetsSchema.extend({
  now: z.string().min(1),
});
export const HealthDismissMovedDbParamsSchema = MovedDismissTargetsSchema;
export const HealthValidationStartDbParamsSchema = ValidationStartParamsSchema.extend({
  now: z.string().min(1),
});
