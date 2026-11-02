import { z } from "zod";
import {
  DuplicateCleanupFinishParamsSchema,
  DuplicateCleanupMovesParamsSchema,
  DuplicateCleanupRunParamsSchema,
} from "@shared/contracts/health";

export const CLEANUP_DB_METHODS = [
  "cleanup.getSummary",
  "cleanup.getPlan",
  "cleanup.getState",
  "cleanup.start",
  "cleanup.applyMoves",
  "cleanup.finish",
  "cleanup.getQuarantinePath",
] as const;

export type CleanupDbMethod = (typeof CLEANUP_DB_METHODS)[number];

export const CleanupStateDbParamsSchema = z.object({
  now: z.string().min(1),
});

export const CleanupStartDbParamsSchema = DuplicateCleanupRunParamsSchema;
export const CleanupMovesDbParamsSchema = DuplicateCleanupMovesParamsSchema;
export const CleanupFinishDbParamsSchema = DuplicateCleanupFinishParamsSchema;
