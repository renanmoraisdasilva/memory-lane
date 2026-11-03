import { describe, expect, it, vi } from "vitest";
import type { CoverageSummary } from "@shared/contracts/replication/types";
import type { DbClient } from "../../../clients/db-client";
import type { DbMethod } from "../../../db/worker-protocol";
import { PlanService } from "./plan-service";

const coverage: CoverageSummary = {
  sourceFiles: 131_393,
  sourceBytes: 500_000_000,
  partialFiles: 86_555,
  partialBytes: 300_000_000,
  partialPercent: 65.88,
  partialRemainderFiles: 44_838,
  partialRemainderBytes: 200_000_000,
  fullCopyFiles: 0,
  fullCopyBytes: 0,
  allDestinationFiles: 86_555,
  allDestinationBytes: 300_000_000,
  allDestinationPercent: 65.88,
  overlapBytes: 0,
  coverageAsOf: "2026-11-03T20:39:32.506Z",
};

describe("PlanService overview", () => {
  it("[ML-REPL-094] uses the aggregate coverage summary for the overview", async () => {
    const calls: DbMethod[] = [];
    const db = {
      request: vi.fn(async (method: DbMethod) => {
        calls.push(method);
        if (method === "replication.listDestinations") return [];
        if (method === "replication.getSourceIdentity") {
          return {
            catalogId: "catalog-1",
            label: "Archive",
            role: "source",
            previousLocalCatalogId: null,
            sourceCatalogId: null,
            sourceLabel: null,
            sourceRootRelative: "",
            libraryScope: "source_root",
            activeSourceVolumeId: "volume-1",
            promotedAt: null,
            demotedAt: null,
            lastIndexedAt: null,
            createdAt: "2026-11-01T12:00:00.000Z",
            schemaVersion: 12,
          };
        }
        if (method === "replication.getCoverageSummary") return coverage;
        throw new Error(`Unexpected method ${method}`);
      }),
    } as unknown as DbClient;

    const service = new PlanService({ db, listDetected: async () => [] });
    const overview = await service.getOverview();

    expect(overview.source).toMatchObject({
      label: "Archive",
      fileCount: 131_393,
      bytes: 500_000_000,
    });
    expect(overview.coverage).toEqual(coverage);
    expect(calls).toContain("replication.getCoverageSummary");
    expect(calls).not.toContain("replication.listSourceFiles");
    expect(calls).not.toContain("replication.listVerifiedCoverage");
  });
});
