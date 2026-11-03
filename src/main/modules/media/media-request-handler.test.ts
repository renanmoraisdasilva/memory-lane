import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DbClient } from "../../clients/db-client";
import type { DbMethod } from "../../db/worker-protocol";
import type { Logger } from "../../logging/types";
import type { ThumbnailWorkScheduler } from "../scanning/domain/scan-files";
import { handleMediaRequest } from "./media-request-handler";

const temporaryDirectories: string[] = [];

async function createTempDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "memory-lane-protocol-"));
  temporaryDirectories.push(directory);
  return directory;
}

function logger(): Logger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

function fakeRequest(url: string, headers: Record<string, string> = {}): Request {
  return {
    url,
    method: "GET",
    headers: new Headers(headers),
  } as Request;
}

interface HarnessOptions {
  thumbnailState?: "pending" | "ready" | "failed";
  thumbnailCache?: string | null;
  mediaState?: "present" | "missing";
  mediaName?: string;
  mediaMime?: string;
}

interface Harness {
  db: DbClient;
  thumbnails: ThumbnailWorkScheduler;
  previews: {
    convert: (inputPath: string, outputPath: string) => Promise<{ bytes: number } | null>;
    shutdown: () => Promise<void>;
  };
  videoProxies: {
    resolveProxyPath: (fileId: number) => Promise<string | null>;
  };
  saves: unknown[];
  previewSaves: unknown[];
  directory: string;
  proxyPath: string;
}

function previewEntry(
  params: unknown,
  sourcePath: string,
  previewSaves: unknown[],
): {
  fileId: number;
  sourcePath: string;
  state: "present" | "missing";
  cachePath: string | null;
  status: "pending" | "ready" | "failed";
} {
  previewSaves.push(params);
  const saved = params as {
    fileId: number;
    path: string;
    status: "ready" | "failed";
  };
  return {
    fileId: saved.fileId,
    sourcePath,
    state: "present",
    cachePath: saved.path,
    status: saved.status,
  };
}

async function createHarness(options: HarnessOptions = {}): Promise<Harness> {
  const directory = await createTempDirectory();
  const sourcePath = path.join(directory, options.mediaName ?? "photo.png");
  await writeFile(sourcePath, Buffer.from("source-image"));
  const saves: unknown[] = [];
  const previewSaves: unknown[] = [];
  let preview: {
    fileId: number;
    sourcePath: string;
    state: "present" | "missing";
    cachePath: string | null;
    status: "pending" | "ready" | "failed";
  } | null = null;
  const thumbnailCache = options.thumbnailCache ?? null;
  const thumbnailState = options.thumbnailState ?? "pending";
  const mediaMime = options.mediaMime ?? "image/png";
  const mediaState = options.mediaState ?? "present";

  const db: DbClient = {
    request: async <T>(method: DbMethod, params: unknown): Promise<T> => {
      if (method === "library.resolveThumbnail") {
        return {
          fileId: 1,
          sourcePath,
          state: "present",
          cachePath: thumbnailCache,
          status: thumbnailState,
        } as T;
      }
      if (method === "library.getContext") {
        return {
          volumeId: "v",
          driveLabel: "Archive",
          catalogPath: "c",
          cachePath: directory,
        } as T;
      }
      if (method === "library.saveThumbnail") {
        saves.push(params);
        return { saved: true } as T;
      }
      if (method === "library.resolvePreview") {
        return preview as T;
      }
      if (method === "library.savePreview") {
        preview = previewEntry(params, sourcePath, previewSaves);
        return { saved: true } as T;
      }
      if (method === "library.resolveMedia") {
        return {
          fileId: 1,
          path: sourcePath,
          mime: mediaMime,
          sizeBytes: 12,
          state: mediaState,
          mediaClass: "image",
        } as T;
      }
      throw new Error(`Unexpected method ${method}`);
    },
  };

  const thumbnails: ThumbnailWorkScheduler = {
    generate: vi.fn(async (_filePath: string, outputPath: string) => {
      const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
      await writeFile(outputPath, bytes);
      return { bytes: bytes.length };
    }),
  };

  const previews = {
    convert: vi.fn(async (_inputPath: string, outputPath: string) => {
      const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
      await writeFile(outputPath, bytes);
      return { bytes: bytes.length };
    }),
    shutdown: vi.fn(async () => undefined),
  };

  const proxyPath = path.join(directory, "proxy.mp4");
  await writeFile(proxyPath, Buffer.from("compatible-video"));
  const videoProxies = {
    resolveProxyPath: vi.fn(async (_fileId: number) => proxyPath),
  };

  return {
    db,
    thumbnails,
    previews,
    videoProxies,
    saves,
    previewSaves,
    directory,
    proxyPath,
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("media request handler", () => {
  it("generates and saves a missing thumbnail with interactive priority", async () => {
    const harness = await createHarness();
    const response = await handleMediaRequest(
      {
        db: harness.db,
        thumbnails: harness.thumbnails,
        previews: harness.previews,
        logger: logger(),
      },
      fakeRequest("ml-media://thumbnail/1"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(harness.thumbnails.generate).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining("thumbs"),
      "interactive",
    );
    expect(harness.saves).toEqual([
      expect.objectContaining({ fileId: 1, status: "ready", bytes: 4 }),
    ]);
  });

  it("[ML-LIB-007] serves a ready cached thumbnail without regenerating", async () => {
    const harness = await createHarness();
    const cachePath = path.join(harness.directory, "cached.jpg");
    await writeFile(cachePath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    harness.thumbnails.generate = vi.fn();

    const response = await handleMediaRequest(
      {
        db: await Promise.resolve({
          request: async <T>(method: DbMethod): Promise<T> =>
            (method === "library.resolveThumbnail"
              ? {
                  fileId: 1,
                  sourcePath: "ignored",
                  state: "present",
                  cachePath,
                  status: "ready",
                }
              : {}) as T,
        }),
        thumbnails: harness.thumbnails,
        previews: harness.previews,
        logger: logger(),
      },
      fakeRequest("ml-media://thumbnail/1"),
    );

    expect(response.status).toBe(200);
    expect(harness.thumbnails.generate).not.toHaveBeenCalled();
  });

  it("returns 404 for failed thumbnails and missing media", async () => {
    const failed = await createHarness({ thumbnailState: "failed" });
    const failedResponse = await handleMediaRequest(
      { db: failed.db, thumbnails: failed.thumbnails, previews: failed.previews, logger: logger() },
      fakeRequest("ml-media://thumbnail/1"),
    );
    expect(failedResponse.status).toBe(404);

    const missing = await createHarness({ mediaState: "missing" });
    const missingResponse = await handleMediaRequest(
      {
        db: missing.db,
        thumbnails: missing.thumbnails,
        previews: missing.previews,
        logger: logger(),
      },
      fakeRequest("ml-media://media/1"),
    );
    expect(missingResponse.status).toBe(404);
  });

  it("[ML-LIB-006] serves media ranges and rejects unknown URLs", async () => {
    const harness = await createHarness();
    const response = await handleMediaRequest(
      {
        db: harness.db,
        thumbnails: harness.thumbnails,
        previews: harness.previews,
        logger: logger(),
      },
      fakeRequest("ml-media://media/1", { range: "bytes=0-3" }),
    );
    expect(response.status).toBe(206);
    expect(await response.text()).toBe("sour");
    expect(response.headers.get("content-range")).toBe("bytes 0-3/12");
    expect(harness.previews.convert).not.toHaveBeenCalled();

    const unknown = await handleMediaRequest(
      {
        db: harness.db,
        thumbnails: harness.thumbnails,
        previews: harness.previews,
        logger: logger(),
      },
      fakeRequest("ml-media://other/1"),
    );
    expect(unknown.status).toBe(404);
  });

  it("[ML-LIB-008] [ML-VIDEO-012] converts HEIC media to a cached JPEG preview", async () => {
    const harness = await createHarness({ mediaName: "photo.heic", mediaMime: "image/heic" });
    const dependencies = {
      db: harness.db,
      thumbnails: harness.thumbnails,
      previews: harness.previews,
      logger: logger(),
    };

    const response = await handleMediaRequest(dependencies, fakeRequest("ml-media://media/1"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect((await response.arrayBuffer()).byteLength).toBe(4);
    expect(harness.previews.convert).toHaveBeenCalledWith(
      expect.stringContaining("photo.heic"),
      path.join(harness.directory, "previews", "1.jpg"),
    );
    expect(harness.previewSaves).toEqual([
      expect.objectContaining({ fileId: 1, status: "ready", bytes: 4 }),
    ]);

    harness.previews.convert = vi.fn();
    const cached = await handleMediaRequest(dependencies, fakeRequest("ml-media://media/1"));
    expect(cached.status).toBe(200);
    expect(harness.previews.convert).not.toHaveBeenCalled();
  });

  it("[ML-VIDEO-012] records failed HEIC preview generation and returns 404", async () => {
    const harness = await createHarness({ mediaName: "photo.heic", mediaMime: "image/heic" });
    harness.previews.convert = vi.fn(async () => null);

    const response = await handleMediaRequest(
      {
        db: harness.db,
        thumbnails: harness.thumbnails,
        previews: harness.previews,
        logger: logger(),
      },
      fakeRequest("ml-media://media/1"),
    );
    expect(response.status).toBe(404);
    expect(harness.previewSaves).toEqual([
      expect.objectContaining({ fileId: 1, status: "failed" }),
    ]);
  });

  it("records failed generation without throwing", async () => {
    const harness = await createHarness();
    harness.thumbnails.generate = vi.fn(async () => {
      throw new Error("native image failed");
    });

    const response = await handleMediaRequest(
      {
        db: harness.db,
        thumbnails: harness.thumbnails,
        previews: harness.previews,
        logger: logger(),
      },
      fakeRequest("ml-media://thumbnail/1"),
    );
    expect(response.status).toBe(404);
    expect(harness.saves).toEqual([expect.objectContaining({ status: "failed" })]);
  });

  it("reads a generated thumbnail from disk", async () => {
    const harness = await createHarness();
    const response = await handleMediaRequest(
      {
        db: harness.db,
        thumbnails: harness.thumbnails,
        previews: harness.previews,
        logger: logger(),
      },
      fakeRequest("ml-media://thumbnail/1"),
    );
    expect((await response.arrayBuffer()).byteLength).toBe(4);
    expect((await readFile(path.join(harness.directory, "thumbs", "1.jpg"))).length).toBe(4);
  });

  it("[ML-VIDEO-006] serves a prepared video proxy with range support", async () => {
    const harness = await createHarness();
    const response = await handleMediaRequest(
      {
        db: harness.db,
        thumbnails: harness.thumbnails,
        previews: harness.previews,
        videoProxies: harness.videoProxies,
        logger: logger(),
      },
      fakeRequest("ml-media://proxy/1", { range: "bytes=0-3" }),
    );
    expect(response.status).toBe(206);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect((await response.arrayBuffer()).byteLength).toBe(4);
    expect(harness.videoProxies.resolveProxyPath).toHaveBeenCalledWith(1);
  });
});
