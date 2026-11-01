import { access, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  createMediaResponse,
  createPreviewResponse,
  createThumbnailResponse,
  parseMediaUrl,
} from "./media-response";
import {
  resolverFor,
  type CacheSaveInput,
  type MediaRequestDependencies,
  type MediaResolver,
  type ResolvedMedia,
  type ResolvedPreview,
  type ResolvedThumbnail,
} from "./media-resolvers";

interface CacheStatusInput extends CacheSaveInput {
  resolver: MediaResolver;
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

function isHeicPath(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  return extension === ".heic" || extension === ".heif";
}

async function saveThumbnailStatus(input: CacheStatusInput): Promise<void> {
  await input.resolver.saveThumbnail({
    fileId: input.fileId,
    path: input.status === "ready" ? input.path : "",
    bytes: input.bytes,
    status: input.status,
    now: input.now,
  });
}

async function savePreviewStatus(input: CacheStatusInput): Promise<void> {
  await input.resolver.savePreview({
    fileId: input.fileId,
    path: input.status === "ready" ? input.path : "",
    bytes: input.bytes,
    status: input.status,
    now: input.now,
  });
}

async function generatePreview(input: {
  dependencies: MediaRequestDependencies;
  resolver: MediaResolver;
  resolved: ResolvedMedia;
  cached: ResolvedPreview | null;
  method: string;
}): Promise<Response> {
  const { dependencies, resolver, resolved, cached, method } = input;
  let outputPath = cached?.cachePath ?? null;
  if (outputPath === null || outputPath.length === 0) {
    const context = await resolver.getContext();
    outputPath = path.join(context.cachePath, "previews", `${resolved.fileId}.jpg`);
  }
  await mkdir(path.dirname(outputPath), { recursive: true });
  const now = (dependencies.now ?? (() => new Date()))().toISOString();
  try {
    const result = await dependencies.previews.convert(resolved.path, outputPath);
    if (result === null) {
      await savePreviewStatus({
        resolver,
        fileId: resolved.fileId,
        path: outputPath,
        bytes: 0,
        status: "failed",
        now,
      });
      return notFound();
    }
    await savePreviewStatus({
      resolver,
      fileId: resolved.fileId,
      path: outputPath,
      bytes: result.bytes,
      status: "ready",
      now,
    });
    return createPreviewResponse(outputPath, method);
  } catch (error) {
    dependencies.logger.warn("HEIC preview generation failed", {
      fileId: resolved.fileId,
      message: error instanceof Error ? error.message : String(error),
    });
    await savePreviewStatus({
      resolver,
      fileId: resolved.fileId,
      path: outputPath,
      bytes: 0,
      status: "failed",
      now,
    });
    return notFound();
  }
}

async function servePreview(
  dependencies: MediaRequestDependencies,
  resolver: MediaResolver,
  resolved: ResolvedMedia,
  method: string,
): Promise<Response> {
  const cached = await resolver.resolvePreview(resolved.fileId);
  if (cached !== null && cached.status === "failed") {
    return notFound();
  }
  if (
    cached !== null &&
    cached.status === "ready" &&
    cached.cachePath !== null &&
    (await exists(cached.cachePath))
  ) {
    return createPreviewResponse(cached.cachePath, method);
  }
  return generatePreview({ dependencies, resolver, resolved, cached, method });
}

async function generateThumbnail(
  dependencies: MediaRequestDependencies,
  resolver: MediaResolver,
  resolved: ResolvedThumbnail,
): Promise<Response> {
  const context = await resolver.getContext();
  const outputPath =
    resolved.cachePath === null || resolved.cachePath.length === 0
      ? path.join(context.cachePath, "thumbs", `${resolved.fileId}.jpg`)
      : resolved.cachePath;
  await mkdir(path.dirname(outputPath), { recursive: true });
  const now = (dependencies.now ?? (() => new Date()))().toISOString();
  try {
    const result = await dependencies.thumbnails.generate(
      resolved.sourcePath,
      outputPath,
      "interactive",
    );
    if (result === null) {
      await saveThumbnailStatus({
        resolver,
        fileId: resolved.fileId,
        path: outputPath,
        bytes: 0,
        status: "failed",
        now,
      });
      return notFound();
    }
    await saveThumbnailStatus({
      resolver,
      fileId: resolved.fileId,
      path: outputPath,
      bytes: result.bytes,
      status: "ready",
      now,
    });
    return createThumbnailResponse(outputPath);
  } catch (error) {
    dependencies.logger.warn("Interactive thumbnail generation failed", {
      fileId: resolved.fileId,
      message: error instanceof Error ? error.message : String(error),
    });
    await saveThumbnailStatus({
      resolver,
      fileId: resolved.fileId,
      path: outputPath,
      bytes: 0,
      status: "failed",
      now,
    });
    return notFound();
  }
}

async function serveThumbnail(
  dependencies: MediaRequestDependencies,
  resolver: MediaResolver,
  fileId: number,
): Promise<Response> {
  const resolved = await resolver.resolveThumbnail(fileId);
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
  return generateThumbnail(dependencies, resolver, resolved);
}

async function serveMedia(
  dependencies: MediaRequestDependencies,
  resolver: MediaResolver,
  fileId: number,
  request: Request,
): Promise<Response> {
  const resolved = await resolver.resolveMedia(fileId);
  if (resolved === null || resolved.state !== "present") {
    return notFound();
  }
  if (resolved.mediaClass === "image" && isHeicPath(resolved.path)) {
    return servePreview(dependencies, resolver, resolved, request.method);
  }
  return createMediaResponse({
    filePath: resolved.path,
    mime: resolved.mime,
    size: resolved.sizeBytes,
    rangeHeader: request.headers.get("range"),
    method: request.method,
  });
}

async function serveProxy(
  dependencies: MediaRequestDependencies,
  fileId: number,
  request: Request,
): Promise<Response> {
  const proxyPath = await dependencies.videoProxies?.resolveProxyPath(fileId);
  if (proxyPath === undefined || proxyPath === null) {
    return notFound();
  }
  const info = await stat(proxyPath).catch(() => null);
  if (info === null) {
    return notFound();
  }
  return createMediaResponse({
    filePath: proxyPath,
    mime: "video/mp4",
    size: info.size,
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
  if (target.kind === "proxy") {
    return target.scope === "source"
      ? serveProxy(dependencies, target.fileId, request)
      : notFound();
  }
  const resolver = await resolverFor(dependencies, target);
  if (resolver === null) {
    return notFound();
  }
  return target.kind === "thumbnail"
    ? serveThumbnail(dependencies, resolver, target.fileId)
    : serveMedia(dependencies, resolver, target.fileId, request);
}

export type { MediaRequestDependencies } from "./media-resolvers";
