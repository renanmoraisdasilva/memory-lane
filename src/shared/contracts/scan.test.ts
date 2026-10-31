import { describe, expect, it } from "vitest";
import { toVolumeId } from "./drives";
import {
  SCAN_STAGE_ORDER,
  ScanIntensityParamsSchema,
  ScanStartParamsSchema,
  ScanStateSchema,
  ScanVolumeParamsSchema,
} from "./scan";

const volumeId = toVolumeId("volume-1");

const idleState = {
  driveLabel: "Archive",
  volumeId,
  status: "idle",
  mode: "initial",
  stages: SCAN_STAGE_ORDER.map((id) => ({
    id,
    state: "queued",
    processed: 0,
    total: null,
  })),
  currentStage: null,
  startedAt: null,
  finishedAt: null,
  lastSavedAt: null,
  etaSeconds: null,
  intensity: "balanced",
  report: null,
  errorMessage: null,
};

describe("scan contracts", () => {
  it("freezes the stage order", () => {
    expect(SCAN_STAGE_ORDER).toEqual(["catalog", "metadata", "thumbnails", "hashes"]);
  });

  it("parses an idle scan state with four stages", () => {
    const parsed = ScanStateSchema.parse(idleState);

    expect(parsed.stages).toHaveLength(4);
    expect(parsed.stages[0]?.id).toBe("catalog");
  });

  it("requires exactly four stages", () => {
    expect(() =>
      ScanStateSchema.parse({ ...idleState, stages: idleState.stages.slice(0, 3) }),
    ).toThrow();
  });

  it("rejects negative progress and unknown states", () => {
    expect(() =>
      ScanStateSchema.parse({
        ...idleState,
        stages: [{ ...idleState.stages[0], processed: -1 }, ...idleState.stages.slice(1)],
      }),
    ).toThrow();
    expect(() => ScanStateSchema.parse({ ...idleState, status: "running" })).toThrow();
  });

  it("validates scan request parameters", () => {
    expect(ScanVolumeParamsSchema.parse({ volumeId }).volumeId).toBe(volumeId);
    expect(ScanStartParamsSchema.parse({ volumeId, intensity: "eco" }).intensity).toBe("eco");
    expect(ScanStartParamsSchema.parse({ volumeId }).intensity).toBeUndefined();
    expect(ScanIntensityParamsSchema.parse({ volumeId, intensity: "max" }).intensity).toBe("max");
    expect(() => ScanIntensityParamsSchema.parse({ volumeId, intensity: "turbo" })).toThrow();
  });
});
