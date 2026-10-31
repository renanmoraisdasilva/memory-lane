import path from "node:path";
import { mkdir } from "node:fs/promises";
import {
  SCAN_STAGE_ORDER,
  type ScanStage,
  type ScanStageId,
  type ScanState,
} from "@shared/contracts/scan";
import type {
  HashSaveItem,
  MetadataSaveItem,
  PendingHashFile,
  PendingMetadataFile,
  PendingThumbnailFile,
  ThumbnailSaveItem,
} from "../domain/scan-files";
import { enumerateFiles } from "../infrastructure/file-enumerator";
import { concurrencyFor, mapWithConcurrency } from "./concurrency";
import { estimateEta, stageOf } from "./scan-runner-helpers";
import type { ProgressUpdate, ScanRuntime } from "./scan-runtime";
import type {
  ApplyCatalogResult,
  FinishCatalogResult,
} from "../../../db/repositories/scan-catalog-repository";

export class ScanRunner {
  constructor(private readonly runtime: ScanRuntime) {}

  async run(initial: ScanState): Promise<ScanState> {
    let state = initial;

    for (const stageId of SCAN_STAGE_ORDER) {
      const stage = stageOf(state, stageId);
      if (stage.state === "complete") {
        continue;
      }

      await this.runtime.checkpoint();
      state = await this.prepareStage(stage);
      state = await this.executeStage(state, stageId);
      await this.runtime.checkpoint();
      state = await this.completeStage(state, stageId);
      await this.runtime.checkpoint();
    }

    return state;
  }

  private async prepareStage(stage: ScanStage): Promise<ScanState> {
    if (stage.state === "queued" || stage.state === "failed") {
      await this.runtime.db.request("scan.prepareStage", {
        volumeId: this.runtime.volumeId,
        stage: stage.id,
      });
    }

    const pending = stage.id === "catalog" ? null : await this.pendingCount(stage.id);
    const total = pending === null ? null : Math.max(stage.total ?? 0, stage.processed + pending);
    const next = await this.runtime.db.request<ScanState>("scan.beginStage", {
      volumeId: this.runtime.volumeId,
      stage: stage.id,
      total,
      now: this.nowIso(),
    });
    this.runtime.publish(next);
    return next;
  }

  private async pendingCount(stageId: ScanStageId): Promise<number> {
    const method =
      stageId === "metadata"
        ? "scan.countPendingMetadata"
        : stageId === "thumbnails"
          ? "scan.countPendingThumbnails"
          : "scan.countPendingHashes";
    return this.runtime.db.request<number>(method, { volumeId: this.runtime.volumeId });
  }

  private async executeStage(state: ScanState, stageId: ScanStageId): Promise<ScanState> {
    switch (stageId) {
      case "catalog":
        return this.runCatalog(state);
      case "metadata":
        return this.runMetadata(state);
      case "thumbnails":
        return this.runThumbnails(state);
      case "hashes":
        return this.runHashes(state);
    }
  }

  private async runCatalog(state: ScanState): Promise<ScanState> {
    let current = state;
    let hadErrors = false;

    await enumerateFiles(
      this.runtime.rootPath,
      async (files) => {
        await this.runtime.checkpoint();
        const result = await this.runtime.db.request<ApplyCatalogResult>("scan.applyCatalogBatch", {
          volumeId: this.runtime.volumeId,
          files,
          seenAt: this.nowIso(),
        });
        current = await this.saveProgress({
          state: current,
          stageId: "catalog",
          processed: result.processed,
          total: null,
          etaSeconds: null,
        });
        await this.runtime.delay(0);
      },
      {
        batchSize: 500,
        onError: (filePath, error) => {
          hadErrors = true;
          this.runtime.logger.warn("Skipping unreadable path during scan", {
            path: filePath,
            message: error.message,
          });
        },
      },
    );

    await this.runtime.checkpoint();
    const result = await this.runtime.db.request<FinishCatalogResult>("scan.finishCatalog", {
      volumeId: this.runtime.volumeId,
      rootPath: this.runtime.rootPath,
      seenAt: this.nowIso(),
      markMissing: !hadErrors,
    });
    return this.saveProgress({
      state: current,
      stageId: "catalog",
      processed: result.processed,
      total: result.processed,
      etaSeconds: null,
    });
  }

  private async runMetadata(state: ScanState): Promise<ScanState> {
    let current = state;
    const startedAt = Date.now();

    while (true) {
      await this.runtime.checkpoint();
      const stage = stageOf(current, "metadata");
      const limit = concurrencyFor(this.runtime.getIntensity()) * 4;
      const batch = await this.runtime.db.request<PendingMetadataFile[]>(
        "scan.listPendingMetadata",
        { volumeId: this.runtime.volumeId, limit },
      );
      if (batch.length === 0) {
        return this.finishProgress(current, "metadata", startedAt);
      }

      const items = await mapWithConcurrency(
        batch,
        concurrencyFor(this.runtime.getIntensity()),
        (file) => this.extractMetadata(file),
      );
      await this.runtime.db.request("scan.saveMetadata", {
        volumeId: this.runtime.volumeId,
        items,
        now: this.nowIso(),
      });

      const processed = stage.processed + batch.length;
      const eta = estimateEta(processed, stage.total, startedAt, Date.now());
      current = await this.saveProgress({
        state: current,
        stageId: "metadata",
        processed,
        total: stage.total,
        etaSeconds: eta,
      });
      await this.runtime.delay(0);
    }
  }

  private async extractMetadata(file: PendingMetadataFile): Promise<MetadataSaveItem> {
    try {
      const extracted = await this.runtime.metadata.extract(file);
      return {
        fileId: file.id,
        status: "ok",
        entries: extracted.entries,
        date: extracted.date,
        width: extracted.width,
        height: extracted.height,
        durationSeconds: extracted.durationSeconds,
      };
    } catch (error) {
      this.runtime.logger.warn("Metadata extraction failed", {
        path: file.path,
        message: error instanceof Error ? error.message : String(error),
      });
      return {
        fileId: file.id,
        status: "failed",
        entries: [],
        date: null,
        width: null,
        height: null,
        durationSeconds: null,
      };
    }
  }

  private async runThumbnails(state: ScanState): Promise<ScanState> {
    let current = state;
    const startedAt = Date.now();
    const thumbnailDirectory = path.join(this.runtime.cachePath, "thumbs");
    await mkdir(thumbnailDirectory, { recursive: true });

    while (true) {
      await this.runtime.checkpoint();
      const stage = stageOf(current, "thumbnails");
      const limit = concurrencyFor(this.runtime.getIntensity()) * 2;
      const batch = await this.runtime.db.request<PendingThumbnailFile[]>(
        "scan.listPendingThumbnails",
        { volumeId: this.runtime.volumeId, limit },
      );
      if (batch.length === 0) {
        return this.finishProgress(current, "thumbnails", startedAt);
      }

      const items = await mapWithConcurrency(
        batch,
        concurrencyFor(this.runtime.getIntensity()),
        (file) => this.generateThumbnail(file, thumbnailDirectory),
      );
      await this.runtime.db.request("scan.saveThumbnail", {
        volumeId: this.runtime.volumeId,
        items,
        now: this.nowIso(),
      });

      const processed = stage.processed + batch.length;
      const eta = estimateEta(processed, stage.total, startedAt, Date.now());
      current = await this.saveProgress({
        state: current,
        stageId: "thumbnails",
        processed,
        total: stage.total,
        etaSeconds: eta,
      });
      await this.runtime.delay(0);
    }
  }

  private async generateThumbnail(
    file: PendingThumbnailFile,
    directory: string,
  ): Promise<ThumbnailSaveItem> {
    const outputPath = path.join(directory, `${file.id}.jpg`);
    try {
      const result = await this.runtime.thumbnails.generate(file.path, outputPath, "bulk");
      if (result === null) {
        return { fileId: file.id, path: "", bytes: 0, status: "failed" };
      }
      return { fileId: file.id, path: outputPath, bytes: result.bytes, status: "ready" };
    } catch (error) {
      this.runtime.logger.warn("Thumbnail generation failed", {
        path: file.path,
        message: error instanceof Error ? error.message : String(error),
      });
      return { fileId: file.id, path: "", bytes: 0, status: "failed" };
    }
  }

  private async runHashes(state: ScanState): Promise<ScanState> {
    let current = state;
    const startedAt = Date.now();

    while (true) {
      await this.runtime.checkpoint();
      const stage = stageOf(current, "hashes");
      const limit = concurrencyFor(this.runtime.getIntensity());
      const batch = await this.runtime.db.request<PendingHashFile[]>("scan.listPendingHashes", {
        volumeId: this.runtime.volumeId,
        limit,
      });
      if (batch.length === 0) {
        return this.finishProgress(current, "hashes", startedAt);
      }

      const items = await mapWithConcurrency(
        batch,
        concurrencyFor(this.runtime.getIntensity()),
        (file) => this.hashFile(file),
      );
      await this.runtime.db.request("scan.saveHash", {
        volumeId: this.runtime.volumeId,
        items,
        now: this.nowIso(),
      });

      const processed = stage.processed + batch.length;
      const eta = estimateEta(processed, stage.total, startedAt, Date.now());
      current = await this.saveProgress({
        state: current,
        stageId: "hashes",
        processed,
        total: stage.total,
        etaSeconds: eta,
      });
      await this.runtime.delay(0);
    }
  }

  private async hashFile(file: PendingHashFile): Promise<HashSaveItem> {
    try {
      const sha256 = await this.runtime.hasher.hash(file.path);
      return { fileId: file.id, sha256, status: "complete" };
    } catch (error) {
      this.runtime.logger.warn("Hash calculation failed", {
        path: file.path,
        message: error instanceof Error ? error.message : String(error),
      });
      return { fileId: file.id, sha256: "", status: "failed" };
    }
  }

  private async finishProgress(
    state: ScanState,
    stageId: ScanStageId,
    startedAt: number,
  ): Promise<ScanState> {
    const stage = stageOf(state, stageId);
    if (stage.total === null || stage.processed >= stage.total) {
      return state;
    }
    const eta = estimateEta(stage.total, stage.total, startedAt, Date.now());
    return this.saveProgress({
      state,
      stageId,
      processed: stage.total,
      total: stage.total,
      etaSeconds: eta,
    });
  }

  private async saveProgress(update: ProgressUpdate): Promise<ScanState> {
    const now = this.nowIso();
    await this.runtime.db.request("scan.saveProgress", {
      volumeId: this.runtime.volumeId,
      stage: update.stageId,
      processed: update.processed,
      total: update.total,
      etaSeconds: update.etaSeconds,
      now,
    });

    const next: ScanState = {
      ...update.state,
      stages: update.state.stages.map((stage) =>
        stage.id === update.stageId
          ? { ...stage, processed: update.processed, total: update.total }
          : stage,
      ),
      lastSavedAt: now,
      etaSeconds: update.etaSeconds,
    };
    this.runtime.publish(next);
    return next;
  }

  private async completeStage(state: ScanState, stageId: ScanStageId): Promise<ScanState> {
    const stage = stageOf(state, stageId);
    const processed =
      stage.total === null ? stage.processed : Math.max(stage.processed, stage.total);
    const total = stage.total ?? processed;
    const next = await this.runtime.db.request<ScanState>("scan.completeStage", {
      volumeId: this.runtime.volumeId,
      stage: stageId,
      processed,
      total,
      now: this.nowIso(),
    });
    this.runtime.publish(next);
    return next;
  }

  private nowIso(): string {
    return this.runtime.now().toISOString();
  }
}
