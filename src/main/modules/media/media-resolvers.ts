import path from "node:path";
import type { DbClient } from "../../clients/db-client";
import type { Logger } from "../../logging/types";
import type { ReplicationDestinationRecord } from "../../db/repositories/replication-destination-repository";
import type { DetectedDrive } from "../drives/domain/drive";
import type { ThumbnailWorkScheduler } from "../scanning/domain/scan-files";
import { resolveRelativePath } from "../../platform/destination-path-policy";
import type { PreviewConverter } from "./heic-preview";

export interface MediaContext {
  volumeId: string;
  driveLabel: string;
  catalogPath: string;
  cachePath: string;
}

export interface ResolvedMedia {
  fileId: number;
  path: string;
  mime: string | null;
  sizeBytes: number;
  state: "present" | "missing";
  mediaClass: "image" | "video";
}

export interface ResolvedThumbnail {
  fileId: number;
  sourcePath: string;
  state: "present" | "missing";
  cachePath: string | null;
  status: "pending" | "ready" | "failed";
}

export interface ResolvedPreview {
  fileId: number;
  sourcePath: string;
  state: "present" | "missing";
  cachePath: string | null;
  status: "pending" | "ready" | "failed";
}

export interface CacheSaveInput {
  fileId: number;
  path: string;
  bytes: number;
  status: "ready" | "failed";
  now: string;
}

export interface MediaResolver {
  getContext(): Promise<MediaContext>;
  resolveMedia(fileId: number): Promise<ResolvedMedia | null>;
  resolveThumbnail(fileId: number): Promise<ResolvedThumbnail | null>;
  resolvePreview(fileId: number): Promise<ResolvedPreview | null>;
  saveThumbnail(input: CacheSaveInput): Promise<void>;
  savePreview(input: CacheSaveInput): Promise<void>;
}

export interface MediaRequestDependencies {
  db: DbClient;
  listDetected?: () => Promise<DetectedDrive[]>;
  thumbnails: ThumbnailWorkScheduler;
  previews: PreviewConverter;
  logger: Logger;
  now?: () => Date;
}

export function sourceResolver(db: DbClient): MediaResolver {
  return {
    getContext: () => db.request<MediaContext>("library.getContext", {}),
    resolveMedia: (fileId) => db.request<ResolvedMedia | null>("library.resolveMedia", { fileId }),
    resolveThumbnail: (fileId) =>
      db.request<ResolvedThumbnail | null>("library.resolveThumbnail", { fileId }),
    resolvePreview: (fileId) =>
      db.request<ResolvedPreview | null>("library.resolvePreview", { fileId }),
    async saveThumbnail(input) {
      await db.request("library.saveThumbnail", input);
    },
    async savePreview(input) {
      await db.request("library.savePreview", input);
    },
  };
}

async function destinationContext(
  dependencies: MediaRequestDependencies,
  destinationId: string,
): Promise<{
  record: ReplicationDestinationRecord;
  root: string;
} | null> {
  const record = await dependencies.db.request<ReplicationDestinationRecord | null>(
    "replication.findDestinationByDestinationId",
    { destinationId },
  );
  if (record === null || record.status !== "active") {
    return null;
  }
  const drive = (
    dependencies.listDetected === undefined ? [] : await dependencies.listDetected()
  ).find((candidate) => candidate.volumeId === record.volumeId);
  if (drive === undefined) {
    return null;
  }
  const root = record.rootRelative.trim().length
    ? resolveRelativePath(drive.rootPath, record.rootRelative)
    : path.resolve(drive.rootPath);
  return { record, root };
}

function destinationResolver(
  dependencies: MediaRequestDependencies,
  record: ReplicationDestinationRecord,
  root: string,
): MediaResolver {
  const target = { destinationId: record.id, destinationRoot: root };
  return {
    getContext: () =>
      dependencies.db.request<MediaContext>("destinationLibrary.getContext", target),
    resolveMedia: (fileId) =>
      dependencies.db.request<ResolvedMedia | null>("destinationLibrary.resolveMedia", {
        ...target,
        fileId,
      }),
    resolveThumbnail: (fileId) =>
      dependencies.db.request<ResolvedThumbnail | null>("destinationLibrary.resolveThumbnail", {
        ...target,
        fileId,
      }),
    resolvePreview: (fileId) =>
      dependencies.db.request<ResolvedPreview | null>("destinationLibrary.resolvePreview", {
        ...target,
        fileId,
      }),
    async saveThumbnail(input) {
      await dependencies.db.request("destinationLibrary.saveThumbnail", { ...target, ...input });
    },
    async savePreview(input) {
      await dependencies.db.request("destinationLibrary.savePreview", { ...target, ...input });
    },
  };
}

export async function resolverFor(
  dependencies: MediaRequestDependencies,
  target: { scope: "source" } | { scope: "destination"; destinationId: string },
): Promise<MediaResolver | null> {
  if (target.scope === "source") {
    return sourceResolver(dependencies.db);
  }
  const context = await destinationContext(dependencies, target.destinationId);
  return context === null ? null : destinationResolver(dependencies, context.record, context.root);
}
