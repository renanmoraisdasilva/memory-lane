import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ValidationState } from "@shared/contracts/health";
import type { DbClient } from "../../../clients/db-client";
import type { DbMethod } from "../../../db/worker-protocol";
import type { FileMetadataExtractor, FileHasher } from "../../scanning/domain/scan-files";
import { HealthService } from "./health-service";

const idle: ValidationState = {
  sessionId: null,
  status: "idle",
  levels: [],
  total: 0,
  processed: 0,
  currentLevel: null,
  startedAt: null,
  finishedAt: null,
  errorMessage: null,
  report: null,
};

function logger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

function createDb(overrides: Partial<Record<DbMethod, unknown>> = {}): DbClient {
  return {
    request: async <T>(method: DbMethod, params: unknown): Promise<T> => {
      const override = overrides[method];
      if (override !== undefined) {
        return (
          typeof override === "function"
            ? (override as (input: unknown) => unknown)(params)
            : override
        ) as T;
      }
      if (method === "health.getValidationState") {
        return idle as T;
      }
      throw new Error(`Unexpected method ${method}`);
    },
  };
}

function hasher(): FileHasher {
  return { hash: vi.fn(async () => "hash") };
}

function metadata(): FileMetadataExtractor {
  return {
    extract: async () => {
      throw new Error("Metadata extraction is not used by this test");
    },
  };
}

describe("HealthService", () => {
  it("confirms only moved candidates that still exist and hash correctly", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "memory-lane-health-"));
    const goodPath = path.join(root, "good.jpg");
    await writeFile(goodPath, "good");
    const captured: { confirmed: { candidateIds: number[]; now: string } | null } = {
      confirmed: null,
    };
    const confirm = vi.fn(async (input: { candidateIds: number[]; now: string }) => {
      captured.confirmed = input;
      return { updated: 1, skipped: 0 };
    });
    const db = createDb({
      "health.getMoved": {
        items: [
          {
            id: 1,
            fileId: 10,
            name: "good.jpg",
            oldPath: "C:\\old\\good.jpg",
            newPath: goodPath,
            sizeBytes: 4,
            sha256: "hash",
          },
          {
            id: 2,
            fileId: 11,
            name: "missing.jpg",
            oldPath: "C:\\old\\missing.jpg",
            newPath: path.join(root, "missing.jpg"),
            sizeBytes: 4,
            sha256: "hash",
          },
        ],
        total: 2,
      },
      "health.confirmMoved": confirm,
    });
    const service = new HealthService({
      db,
      hasher: hasher(),
      metadata: metadata(),
      logger: logger(),
    });

    await expect(service.confirmMoved([1, 2, 999])).resolves.toEqual({
      updated: 1,
      skipped: 2,
    });
    expect(captured.confirmed?.candidateIds).toEqual([1]);
    expect(captured.confirmed?.now).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    await rm(root, { recursive: true, force: true });
  });

  it("pauses a stale running session when no local run is active", async () => {
    const running = {
      ...idle,
      sessionId: 7,
      status: "running" as const,
      levels: ["existence" as const],
      total: 1,
    };
    const capturedPause: { input: { sessionId: number; now: string } | null } = {
      input: null,
    };
    const pause = vi.fn(async (input: { sessionId: number; now: string }) => {
      capturedPause.input = input;
      return { ...running, status: "paused" as const };
    });
    const db = createDb({
      "health.getValidationState": running,
      "health.pauseValidation": pause,
    });
    const service = new HealthService({
      db,
      hasher: hasher(),
      metadata: metadata(),
      logger: logger(),
    });

    await expect(service.getValidationState()).resolves.toMatchObject({ status: "paused" });
    expect(capturedPause.input?.sessionId).toBe(7);
    expect(capturedPause.input?.now).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("runs validation to completion", async () => {
    let state: ValidationState = {
      sessionId: 3,
      status: "running",
      levels: ["existence"],
      total: 1,
      processed: 0,
      currentLevel: null,
      startedAt: "2026-10-31T12:00:00.000Z",
      finishedAt: null,
      errorMessage: null,
      report: null,
    };
    let pending = true;
    const finish = vi.fn(async () => {
      state = { ...state, status: "complete", processed: 1 };
      return state;
    });
    const db = createDb({
      "health.createValidation": state,
      "health.setValidationLevel": { saved: true },
      "health.listPendingValidation": () => {
        if (!pending) {
          return [];
        }
        pending = false;
        return [
          {
            fileId: 1,
            path: "C:\\archive\\a.jpg",
            sizeBytes: 1,
            createdAtFs: null,
            modifiedAtFs: null,
            state: "present",
            sha256: null,
          },
        ];
      },
      "health.saveValidationResults": () => {
        state = { ...state, processed: 1 };
        return state;
      },
      "health.finishValidation": finish,
    });
    const service = new HealthService({
      db,
      hasher: hasher(),
      metadata: metadata(),
      logger: logger(),
    });

    await expect(service.startValidation(["existence"])).resolves.toMatchObject({
      status: "running",
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(finish).toHaveBeenCalled();
  });

  it("passes through summaries and dismissals", async () => {
    const summary = {
      duplicateGroups: 0,
      duplicateFiles: 0,
      duplicateBytes: 0,
      missingFiles: 0,
      movedCandidates: 0,
      lastValidationAt: null,
    };
    const db = createDb({
      "health.getSummary": summary,
      "health.getMissing": { items: [], total: 0 },
      "health.getDuplicates": { groups: [], totalGroups: 0, totalFiles: 0, totalBytes: 0 },
      "health.dismissMoved": { updated: 1, skipped: 0 },
    });
    const service = new HealthService({
      db,
      hasher: hasher(),
      metadata: metadata(),
      logger: logger(),
    });

    await expect(service.getSummary()).resolves.toEqual(summary);
    await expect(service.getMissing()).resolves.toEqual({ items: [], total: 0 });
    await expect(service.getDuplicates()).resolves.toMatchObject({ totalGroups: 0 });
    await expect(service.dismissMoved([1])).resolves.toEqual({ updated: 1, skipped: 0 });
  });
});
