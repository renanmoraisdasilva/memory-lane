import { z } from "zod";
import { AdoptionStatusSchema, DestinationGoalSchema } from "@shared/contracts/replication/types";
import { VolumeIdSchema } from "@shared/contracts/drives";

export const REPLICATION_DB_METHODS = [
  "replication.listDestinations",
  "replication.getDestination",
  "replication.findDestinationByDestinationId",
  "replication.findDestinationByVolume",
  "replication.getSourceIdentity",
  "replication.registerDestination",
  "replication.updateDestination",
  "replication.listSourceFiles",
  "replication.saveSourceHash",
  "replication.getAdoption",
  "replication.beginAdoption",
  "replication.updateAdoptionStatus",
  "replication.finishAdoption",
  "replication.listAdoptionReplicas",
  "replication.saveAdoptionBatch",
  "replication.markUnseenReplicasMissing",
  "replication.markInterruptedAdoptions",
  "replication.listVerifiedCoverage",
  "replication.getDestinationCoverageMap",
  "replication.getDestinationReplicaHealth",
  "replication.getOverlapBytes",
  "replication.getDestinationOverlapBytes",
  "replication.writeSourceIndex",
  "replication.upsertDestinationLibrary",
  "replication.getDestinationLibraryStats",
] as const;

export type ReplicationDbMethod = (typeof REPLICATION_DB_METHODS)[number];

export const ReplicationDestinationIdParamsSchema = z.object({
  destinationId: z.number().int().positive(),
});

export const ReplicationDestinationKeyParamsSchema = z.object({
  destinationId: z.string().min(1),
});

export const ReplicationVolumeParamsSchema = z.object({
  volumeId: VolumeIdSchema,
});

export const ReplicationRegisterDestinationDbParamsSchema = z.object({
  destinationId: z.string().min(1),
  volumeId: VolumeIdSchema,
  volumeSerial: z.string().nullable(),
  label: z.string().min(1),
  fileSystem: z.string().min(1),
  letter: z
    .string()
    .regex(/^[A-Z]:$/)
    .nullable(),
  mountRootPath: z.string().min(1),
  rootRelative: z.string(),
  destinationCatalogPath: z.string().min(1),
  archiveFolderName: z.string().min(1),
  goal: DestinationGoalSchema,
  layout: z.enum(["dedicated", "mirror_source"]),
  allocationMode: z.enum(["all_safe", "percent", "fixed"]),
  allocationPercent: z.number().min(0).max(100).nullable(),
  allocationBytes: z.number().int().nonnegative().nullable(),
  reserveBytes: z.number().int().nonnegative(),
  now: z.string().min(1),
});

export const ReplicationUpdateDestinationDbParamsSchema = z.object({
  destinationId: z.number().int().positive(),
  goal: DestinationGoalSchema.optional(),
  allocationMode: z.enum(["all_safe", "percent", "fixed"]).optional(),
  allocationPercent: z.number().min(0).max(100).nullable().optional(),
  allocationBytes: z.number().int().nonnegative().nullable().optional(),
  reserveBytes: z.number().int().nonnegative().optional(),
  priority: z.number().int().nonnegative().optional(),
  layout: z.enum(["dedicated", "mirror_source"]).optional(),
  status: z.enum(["active", "retired", "lost"]).optional(),
});

export const ReplicationSourceHashDbParamsSchema = z.object({
  fileId: z.number().int().positive(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  size: z.number().int().nonnegative(),
  modifiedAtFs: z.string().nullable(),
  now: z.string().min(1),
});

export const ReplicationAdoptionKeyParamsSchema = z.object({
  destinationId: z.string().min(1),
});

export const ReplicationAdoptionRowParamsSchema = z.object({
  destinationId: z.number().int().positive(),
});

export const ReplicationAdoptionStatusDbParamsSchema = z.object({
  destinationId: z.number().int().positive(),
  status: AdoptionStatusSchema,
  now: z.string().min(1),
  errorMessage: z.string().nullable(),
});

export const ReplicationBeginAdoptionDbParamsSchema = z.object({
  destinationId: z.number().int().positive(),
  now: z.string().min(1),
});

export const ReplicationNowDbParamsSchema = z.object({
  now: z.string().min(1),
});

export const AdoptionReplicaStatusSchema = z.enum([
  "discovered",
  "copied",
  "verified",
  "stale",
  "missing",
  "conflict",
  "failed",
]);

export const ReplicationAdoptionReplicaWriteSchema = z.object({
  fileId: z.number().int().positive(),
  relativePath: z.string().min(1),
  relativePathKey: z.string().min(1),
  sourceRelativePath: z.string().min(1),
  sourceRelativePathKey: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable(),
  status: AdoptionReplicaStatusSchema,
  sourceSizeAtVerify: z.number().int().nonnegative().nullable(),
  sourceModifiedAtFsAtVerify: z.string().nullable(),
  destinationSizeAtVerify: z.number().int().nonnegative().nullable(),
  destinationModifiedAtFsAtVerify: z.string().nullable(),
  lastCheckedAt: z.string().min(1),
  lastError: z.string().nullable(),
});

export const ReplicationAdoptionOrphanWriteSchema = z.object({
  relativePath: z.string().min(1),
  relativePathKey: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable(),
  modifiedAtFs: z.string().nullable(),
  classification: z.enum(["extra", "previously_in_source", "ambiguous", "unreadable"]),
  matchedSourceCount: z.number().int().nonnegative(),
  lastCheckedAt: z.string().min(1),
  lastError: z.string().nullable(),
});

export const ReplicationAdoptionBatchDbParamsSchema = z.object({
  destinationId: z.number().int().positive(),
  replicas: z.array(ReplicationAdoptionReplicaWriteSchema),
  orphans: z.array(ReplicationAdoptionOrphanWriteSchema),
  touchedReplicaFileIds: z.array(z.number().int().positive()),
  now: z.string().min(1),
});

export const ReplicationMarkUnseenDbParamsSchema = z.object({
  destinationId: z.number().int().positive(),
  seenFileIds: z.array(z.number().int().positive()),
  seenOrphanPathKeys: z.array(z.string()),
  now: z.string().min(1),
});

export const ReplicationWriteSourceIndexDbParamsSchema = z.object({
  destinationId: z.number().int().positive(),
  destinationRoot: z.string().min(1),
  now: z.string().min(1),
});

export const ReplicationDestinationLibraryFileSchema = z.object({
  relativePath: z.string().min(1),
  name: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  modifiedAtFs: z.string().nullable(),
  mediaClass: z.string().min(1),
  sha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable(),
  resolvedDate: z.string().nullable(),
});

export const ReplicationUpsertDestinationLibraryDbParamsSchema = z.object({
  destinationId: z.number().int().positive(),
  destinationRoot: z.string().min(1),
  runStartedAt: z.string().min(1),
  now: z.string().min(1),
  files: z.array(ReplicationDestinationLibraryFileSchema),
});

export const ReplicationDestinationLibraryParamsSchema = z.object({
  destinationId: z.number().int().positive(),
  destinationRoot: z.string().min(1),
});
