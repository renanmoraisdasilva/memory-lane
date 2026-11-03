import { describe, expect, it, vi } from "vitest";
import type { DbClient } from "../../../clients/db-client";
import type { DbMethod } from "../../../db/worker-protocol";
import type {
  DestinationFileEntry,
  DestinationScanResult,
} from "../infrastructure/destination-reader";
import { runAdoption, type AdoptionControl } from "./adoption-runner";

const now = "2026-10-31T12:00:00.000Z";
const hash = "a".repeat(64);

interface RequestLog {
  method: DbMethod;
  params: Record<string, unknown>;
}

function destinationFiles(count: number): DestinationFileEntry[] {
  return Array.from({ length: count }, (_, index) => {
    const name = `file-${String(index).padStart(4, "0")}.jpg`;
    return {
      relativePath: name,
      absolutePath: `G:\\archive\\${name}`,
      name,
      size: 10,
      modifiedAtFs: now,
    };
  });
}

function createControl(): AdoptionControl {
  return {
    paused: false,
    cancelled: false,
    currentFile: null,
    etaSeconds: null,
    totalFiles: 0,
  };
}

function createHarness(files: DestinationFileEntry[], control: AdoptionControl) {
  const requests: RequestLog[] = [];
  const db: DbClient = {
    request<T>(method: DbMethod, params: unknown): Promise<T> {
      requests.push({ method, params: params as Record<string, unknown> });
      if (
        method === "replication.listSourceFiles" ||
        method === "replication.listAdoptionReplicas"
      ) {
        return Promise.resolve([] as T);
      }
      if (
        method === "replication.saveAdoptionBatch" ||
        method === "replication.markUnseenReplicasMissing" ||
        method === "replication.upsertDestinationLibrary"
      ) {
        return Promise.resolve({ saved: true } as T);
      }
      throw new Error(`Unexpected database method ${method}`);
    },
  };
  const scan: DestinationScanResult = {
    files,
    skipped: [{ relativePath: "locked.jpg", reason: "Access denied" }],
  };
  return {
    requests,
    dependencies: {
      db,
      reader: { scan: async () => scan },
      hasher: { hash: async () => hash },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      now: () => new Date(now),
      control,
    },
  };
}

describe("adoption runner", () => {
  it("flushes destination library rows in large batches instead of every scan batch", async () => {
    const control = createControl();
    const harness = createHarness(destinationFiles(1_050), control);

    await expect(
      runAdoption(harness.dependencies, {
        destinationRowId: 1,
        destinationRoot: "G:\\archive",
        copyRootRelative: null,
        runStartedAt: now,
      }),
    ).resolves.toBe("complete");

    const libraryCalls = harness.requests.filter(
      (request) => request.method === "replication.upsertDestinationLibrary",
    );
    expect(libraryCalls).toHaveLength(2);
    expect((libraryCalls[0]?.params.files as unknown[]).length).toBe(1_000);
    expect((libraryCalls[1]?.params.files as unknown[]).length).toBe(50);
    expect(
      harness.requests.filter((request) => request.method === "replication.saveAdoptionBatch"),
    ).toHaveLength(53);
    expect(control.totalFiles).toBe(1_050);
    expect(control.etaSeconds).toBe(0);
  });

  it("[ML-REPL-026] flushes pending library rows when the adoption is paused", async () => {
    const control = createControl();
    const harness = createHarness(destinationFiles(30), control);
    let hashed = 0;
    harness.dependencies.hasher.hash = async () => {
      hashed += 1;
      if (hashed === 10) {
        control.paused = true;
      }
      return hash;
    };

    await expect(
      runAdoption(harness.dependencies, {
        destinationRowId: 1,
        destinationRoot: "G:\\archive",
        copyRootRelative: null,
        runStartedAt: now,
      }),
    ).resolves.toBe("paused");

    const libraryCalls = harness.requests.filter(
      (request) => request.method === "replication.upsertDestinationLibrary",
    );
    expect(libraryCalls).toHaveLength(1);
    expect((libraryCalls[0]?.params.files as unknown[]).length).toBe(10);
    expect(
      harness.requests.some(
        (request) => request.method === "replication.markUnseenReplicasMissing",
      ),
    ).toBe(false);
  });
});
