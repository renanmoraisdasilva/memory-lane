import { z } from "zod";

export const VolumeIdSchema = z.string().min(1).brand<"VolumeId">();
export type VolumeId = z.infer<typeof VolumeIdSchema>;

export function toVolumeId(value: string): VolumeId {
  return VolumeIdSchema.parse(value);
}

export const DriveIdentitySchema = z.object({
  volumeId: VolumeIdSchema,
  serialNumber: z.string().min(1).nullable(),
  label: z.string().min(1),
  fileSystem: z.string().min(1),
  rootPath: z.string().min(1),
  letter: z
    .string()
    .regex(/^[A-Z]:$/)
    .nullable(),
});
export type DriveIdentity = z.infer<typeof DriveIdentitySchema>;

export const DriveTypeSchema = z.enum(["removable", "fixed", "development", "unknown"]);
export type DriveType = z.infer<typeof DriveTypeSchema>;

export const CatalogStatusSchema = z.enum(["none", "registered", "ready"]);

export const DriveInfoSchema = z.object({
  volumeId: VolumeIdSchema,
  label: z.string(),
  letter: z.string().nullable(),
  rootPath: z.string(),
  fileSystem: z.string(),
  serialNumber: z.string().nullable(),
  totalBytes: z.number().nonnegative(),
  freeBytes: z.number().nonnegative(),
  driveType: DriveTypeSchema,
  isExternal: z.boolean(),
  catalogStatus: CatalogStatusSchema,
  lastSeenAt: z.string().nullable(),
  isConnected: z.boolean().optional(),
  lastLetter: z
    .string()
    .regex(/^[A-Z]:$/)
    .nullable()
    .optional(),
  lastScanAt: z.string().nullable().optional(),
  indexedFiles: z.number().int().nonnegative().optional(),
  requiresLetterConfirmation: z.boolean().optional(),
});
export type DriveInfo = z.infer<typeof DriveInfoSchema>;

export const CatalogSummarySchema = z.object({
  catalogPath: z.string(),
  driveLabel: z.string(),
  volumeId: VolumeIdSchema,
  schemaVersion: z.number().int().nonnegative(),
  fileCount: z.number().int().nonnegative(),
  openedAt: z.string(),
});
export type CatalogSummary = z.infer<typeof CatalogSummarySchema>;
