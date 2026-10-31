import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import type { DbClient } from "../../clients/db-client";
import type { Logger } from "../../logging/types";
import type { ThumbnailWorkScheduler } from "../scanning/domain/scan-files";
import { createMediaResponse, createThumbnailResponse, parseMediaUrl } from "./media-response";

interface MediaContext {
  volumeId: string;
  driveLabel: string;
  catalogPath: string;
  cachePath: string;
}

interface ResolvedMedia {
  fileId: number;
  path: string;
  mime: string | null;
  sizeBytes: number;
  state: "present" | "missing";
  mediaClass: "image" | "video";
}

interface ResolvedThumbnail {
  fileId: number;
  sourcePath: string;
  state: "present" | "missing";
  cachePath: string | null;
  status: "pending" | "ready" | "failed";
}

export interface MediaRequestDependencies {
  db: DbClient;
  thumbnails: ThumbnailWorkScheduler;
  logger: Logger;
  now?: () => Date;
}

interface ThumbnailStatusInput {
  dependencies: MediaRequestDependencies;
  fileId: number;
  outputPath: string;
  bytes: number;
  status: "ready" | "failed";
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function notFound(): Response {
  return new Response(null, { status: 404 });
}

async function saveThumbnailStatus(input: ThumbnailStatusInput): Promise<void> {
  await input.dependencies.db.request("library.saveThumbnail", {
    fileId: input.fileId,
    path: input.status === "ready" ? input.outputPath : "",
    bytes: input.bytes,
    status: input.status,
    now: (input.dependencies.now ?? (() => new Date()))().toISOString(),
  });
}

async function generateThumbnail(
  dependencies: MediaRequestDependencies,
  resolved: ResolvedThumbnail,
): Promise<Response> {
  const context = await dependencies.db.request<MediaContext>("library.getContext", {});
  const outputPath =
    resolved.cachePath === null || resolved.cachePath.length === 0
      ? path.join(context.cachePath, "thumbs", `${resolved.fileId}.jpg`)
      : resolved.cachePath;
  await mkdir(path.dirname(outputPath), { recursive: true });

  try {
    const result = await dependencies.thumbnails.generate(
      resolved.sourcePath,
      outputPath,
      "interactive",
    );
    if (result === null) {
      await saveThumbnailStatus({
        dependencies,
        fileId: resolved.fileId,
        outputPath,
        bytes: 0,
        status: "failed",
      });
      return notFound();
    }
    await saveThumbnailStatus({
      dependencies,
      fileId: resolved.fileId,
      outputPath,
      bytes: result.bytes,
      status: "ready",
    });
    return createThumbnailResponse(outputPath);
  } catch (error) {
    dependencies.logger.warn("Interactive thumbnail generation failed", {
      fileId: resolved.fileId,
      message: error instanceof Error ? error.message : String(error),
    });
    await saveThumbnailStatus({
      dependencies,
      fileId: resolved.fileId,
      outputPath,
      bytes: 0,
      status: "failed",
    });
    return notFound();
  }
}

async function serveThumbnail(
  dependencies: MediaRequestDependencies,
  fileId: number,
): Promise<Response> {
  const resolved = await dependencies.db.request<ResolvedThumbnail | null>(
    "library.resolveThumbnail",
    { fileId },
  );
  if (resolved === null || resolved.state !== "present" || resolved.status === "failed") {
    return notFound();
  }

  if (
    resolved.status === "ready" &&
    resolved.cachePath !== null &&
    (await exists(resolved.cachePath))
  ) {
    return createThumbnailResponse(resolved.cachePath);
  }
  return generateThumbnail(dependencies, resolved);
}

async function serveMedia(
  dependencies: MediaRequestDependencies,
  fileId: number,
  request: Request,
): Promise<Response> {
  const resolved = await dependencies.db.request<ResolvedMedia | null>("library.resolveMedia", {
    fileId,
  });
  if (resolved === null || resolved.state !== "present") {
    return notFound();
  }

  return createMediaResponse({
    filePath: resolved.path,
    mime: resolved.mime,
    size: resolved.sizeBytes,
    rangeHeader: request.headers.get("range"),
    method: request.method,
  });
}

export async function handleMediaRequest(
  dependencies: MediaRequestDependencies,
  request: Request,
): Promise<Response> {
  const target = parseMediaUrl(request.url);
  if (target === null) {
    return notFound();
  }
  return target.kind === "thumbnail"
    ? serveThumbnail(dependencies, target.fileId)
    : serveMedia(dependencies, target.fileId, request);
}
