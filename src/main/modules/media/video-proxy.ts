import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import type { LibraryItemDetails, VideoProxyState } from "@shared/contracts/library";
import type { DbClient } from "../../clients/db-client";
import type { Logger } from "../../logging/types";
import type { ResolvedLibraryMedia } from "../library/application/library-service";
import type {
  LibraryContext,
  ResolvedVideoProxy,
  SaveVideoProxyInput,
} from "../../db/repositories/library-item-repository";
import { buildVideoProxyArgs, parseFfmpegProgressSeconds } from "./video-proxy-command";

export interface VideoProxyServiceDependencies {
  db: DbClient;
  ffmpegPath: string;
  logger: Logger;
  now?: () => Date;
}

interface ProxyJob {
  child: ChildProcess;
  progress: number | null;
  stderr: string[];
  settled: boolean;
}

interface ProxySource {
  media: ResolvedLibraryMedia;
  size: number;
  modifiedAtFs: string;
}

interface ProxyFinishInput {
  fileId: number;
  job: ProxyJob;
  temporaryPath: string;
  source: ProxySource;
}

interface ProxySuccessInput extends ProxyFinishInput {
  outputPath: string;
}

interface ProxyFailureInput extends ProxyFinishInput {
  message: string;
}

const TEMP_SUFFIX = ".tmp.mp4";

function proxyUrl(fileId: number): string {
  return `ml-media://proxy/${String(fileId)}`;
}

function proxyState(
  fileId: number,
  status: VideoProxyState["status"],
  progress: number | null,
  errorMessage: string | null,
): VideoProxyState {
  return {
    fileId,
    status,
    progress,
    mediaUrl: status === "ready" ? proxyUrl(fileId) : null,
    errorMessage,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export class VideoProxyService {
  private readonly jobs = new Map<number, ProxyJob>();
  private cleanupStarted = false;
  private shuttingDown = false;
  private readonly nowDate: () => Date;

  constructor(private readonly dependencies: VideoProxyServiceDependencies) {
    this.nowDate = dependencies.now ?? (() => new Date());
  }

  async getState(fileId: number): Promise<VideoProxyState> {
    const job = this.jobs.get(fileId);
    if (job !== undefined) {
      return proxyState(fileId, "processing", job.progress, null);
    }

    const source = await this.sourceFor(fileId);
    if (source === null) {
      return proxyState(fileId, "failed", null, "The original video is unavailable or missing.");
    }

    const cached = await this.resolveCache(fileId);
    return this.stateForCache(fileId, cached, source);
  }

  async prepare(fileId: number, retry = false): Promise<VideoProxyState> {
    const current = await this.getState(fileId);
    if (current.status === "ready" || current.status === "processing") {
      return current;
    }
    if (current.status === "failed" && !retry) {
      return current;
    }

    const source = await this.sourceFor(fileId);
    if (source === null) {
      return proxyState(fileId, "failed", null, "The original video is unavailable or missing.");
    }
    return this.startJob(fileId, source);
  }

  private async startJob(fileId: number, source: ProxySource): Promise<VideoProxyState> {
    const cache = await this.dependencies.db.request<LibraryContext>("library.getContext", {});
    const directory = path.join(cache.cachePath, "proxies");
    await mkdir(directory, { recursive: true });
    await this.cleanupTempFiles(directory);

    const outputPath = path.join(directory, `${String(fileId)}.mp4`);
    const temporaryPath = path.join(directory, `${String(fileId)}.${randomUUID()}${TEMP_SUFFIX}`);
    const duration = await this.durationSeconds(fileId);
    const args = buildVideoProxyArgs({ inputPath: source.media.path, outputPath: temporaryPath });
    const child = spawn(this.dependencies.ffmpegPath, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const job: ProxyJob = {
      child,
      progress: duration === null ? null : 0,
      stderr: [],
      settled: false,
    };
    this.jobs.set(fileId, job);

    this.attachProgress(job, duration);
    child.once("error", (error) => {
      void this.finishFailure({
        fileId,
        job,
        temporaryPath,
        source,
        message: errorMessage(error),
      });
    });
    child.once("close", (code) => {
      if (job.settled) {
        return;
      }
      if (code === 0) {
        void this.finishSuccess({ fileId, job, temporaryPath, outputPath, source });
      } else {
        const detail = job.stderr.at(-1) ?? `FFmpeg exited with code ${String(code)}`;
        void this.finishFailure({ fileId, job, temporaryPath, source, message: detail });
      }
    });

    return proxyState(fileId, "processing", job.progress, null);
  }

  private attachProgress(job: ProxyJob, duration: number | null): void {
    const stdout = job.child.stdout;
    if (stdout !== null) {
      const lines = readline.createInterface({ input: stdout });
      lines.on("line", (line) => {
        const seconds = parseFfmpegProgressSeconds(line);
        if (seconds !== null && duration !== null && duration > 0) {
          job.progress = Math.min(0.99, seconds / duration);
        }
      });
    }
    const stderr = job.child.stderr;
    if (stderr !== null) {
      const lines = readline.createInterface({ input: stderr });
      lines.on("line", (line) => {
        if (line.trim().length > 0) {
          job.stderr.push(line.trim());
          if (job.stderr.length > 20) {
            job.stderr.shift();
          }
        }
      });
    }
  }

  private async stateForCache(
    fileId: number,
    cached: ResolvedVideoProxy | null,
    source: ProxySource,
  ): Promise<VideoProxyState> {
    if (cached === null || !this.fingerprintMatches(cached, source.size, source.modifiedAtFs)) {
      return proxyState(fileId, "idle", null, null);
    }
    if (cached.status === "ready" && cached.cachePath !== null) {
      return (await exists(cached.cachePath))
        ? proxyState(fileId, "ready", 1, null)
        : proxyState(fileId, "idle", null, null);
    }
    if (cached.status === "failed") {
      return proxyState(fileId, "failed", null, cached.errorMessage ?? "Video conversion failed.");
    }
    return proxyState(fileId, "idle", null, null);
  }

  async resolveProxyPath(fileId: number): Promise<string | null> {
    const cached = await this.resolveCache(fileId);
    if (
      cached === null ||
      cached.status !== "ready" ||
      cached.cachePath === null ||
      !(await exists(cached.cachePath))
    ) {
      return null;
    }
    return cached.cachePath;
  }

  shutdown(): Promise<void> {
    this.shuttingDown = true;
    for (const job of this.jobs.values()) {
      job.settled = true;
      job.child.kill();
    }
    this.jobs.clear();
    return Promise.resolve();
  }

  private async sourceFor(fileId: number): Promise<ProxySource | null> {
    const media = await this.dependencies.db.request<ResolvedLibraryMedia | null>(
      "library.resolveFile",
      { fileId },
    );
    if (media === null || media.mediaClass !== "video" || media.state !== "present") {
      return null;
    }
    const info = await stat(media.path).catch(() => null);
    if (info === null) {
      return null;
    }
    return { media, size: info.size, modifiedAtFs: info.mtime.toISOString() };
  }

  private resolveCache(fileId: number): Promise<ResolvedVideoProxy | null> {
    return this.dependencies.db.request<ResolvedVideoProxy | null>("library.resolveVideoProxy", {
      fileId,
    });
  }

  private fingerprintMatches(
    cached: ResolvedVideoProxy,
    sourceSize: number,
    sourceModifiedAtFs: string,
  ): boolean {
    return cached.sourceSize === sourceSize && cached.sourceModifiedAtFs === sourceModifiedAtFs;
  }

  private async durationSeconds(fileId: number): Promise<number | null> {
    try {
      const details = await this.dependencies.db.request<LibraryItemDetails>("library.getItem", {
        fileId,
        filter: "videos",
      });
      return details.item.durationSeconds;
    } catch {
      return null;
    }
  }

  private async finishSuccess(input: ProxySuccessInput): Promise<void> {
    const { fileId, job, temporaryPath, outputPath, source } = input;
    if (job.settled) {
      return;
    }
    job.settled = true;
    try {
      await rename(temporaryPath, outputPath);
      const output = await stat(outputPath);
      if (!this.shuttingDown) {
        await this.saveState({
          fileId,
          path: outputPath,
          bytes: output.size,
          sourceSize: source.size,
          sourceModifiedAtFs: source.modifiedAtFs,
          status: "ready",
          errorMessage: null,
          now: this.now(),
        });
      }
      job.progress = 1;
      this.jobs.delete(fileId);
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      this.jobs.delete(fileId);
      if (!this.shuttingDown) {
        await this.saveState({
          fileId,
          path: outputPath,
          bytes: 0,
          sourceSize: source.size,
          sourceModifiedAtFs: source.modifiedAtFs,
          status: "failed",
          errorMessage: `Could not finalize the compatible copy: ${errorMessage(error)}`,
          now: this.now(),
        }).catch((saveError: unknown) => {
          this.dependencies.logger.warn("Could not save video proxy failure", {
            fileId,
            message: errorMessage(saveError),
          });
        });
      }
      this.dependencies.logger.warn("Could not finalize video proxy", {
        fileId,
        message: errorMessage(error),
      });
    }
  }

  private async finishFailure(input: ProxyFailureInput): Promise<void> {
    const { fileId, job, temporaryPath, source, message } = input;
    if (job.settled) {
      return;
    }
    job.settled = true;
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    this.jobs.delete(fileId);
    if (this.shuttingDown) {
      return;
    }
    const cache = await this.dependencies.db
      .request<LibraryContext>("library.getContext", {})
      .catch(() => null);
    const outputPath =
      cache === null ? "" : path.join(cache.cachePath, "proxies", `${String(fileId)}.mp4`);
    await this.saveState({
      fileId,
      path: outputPath,
      bytes: 0,
      sourceSize: source.size,
      sourceModifiedAtFs: source.modifiedAtFs,
      status: "failed",
      errorMessage: message,
      now: this.now(),
    }).catch((error: unknown) => {
      this.dependencies.logger.warn("Could not save video proxy failure", {
        fileId,
        message: errorMessage(error),
      });
    });
    this.dependencies.logger.warn("Video proxy conversion failed", { fileId, message });
  }

  private async saveState(input: SaveVideoProxyInput): Promise<void> {
    await this.dependencies.db.request("library.saveVideoProxy", input);
  }

  private async cleanupTempFiles(directory: string): Promise<void> {
    if (this.cleanupStarted) {
      return;
    }
    this.cleanupStarted = true;
    const entries = await readdir(directory).catch(() => []);
    await Promise.all(
      entries
        .filter((name) => name.includes(".tmp.mp4"))
        .map((name) => rm(path.join(directory, name), { force: true })),
    );
  }

  private now(): string {
    return this.nowDate().toISOString();
  }
}
