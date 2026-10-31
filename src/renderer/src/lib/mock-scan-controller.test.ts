import { describe, expect, it } from "vitest";
import { toVolumeId } from "@shared/contracts/drives";
import { createMockScanController, createScanFixture } from "./mock-scan-controller";

const volumeId = toVolumeId("test-drive");
const driveLabel = "Test Drive";

describe("createMockScanController", () => {
  it("returns null until a scan exists", async () => {
    const scans = createMockScanController();
    await expect(scans.getScanState(volumeId)).resolves.toBeNull();
  });

  it("starts an active scan that can pause and resume", async () => {
    const scans = createMockScanController();

    const started = await scans.startScan(volumeId);
    expect(started.status).toBe("active");
    expect(started.currentStage).toBe("catalog");

    const paused = await scans.pauseScan(volumeId);
    expect(paused.status).toBe("paused");
    expect(paused.stages[0]?.state).toBe("paused");

    const resumed = await scans.resumeScan(volumeId);
    expect(resumed.status).toBe("active");
    expect(resumed.stages[0]?.state).toBe("active");
  });

  it("updates intensity even before the first scan", async () => {
    const scans = createMockScanController();

    const state = await scans.setScanIntensity(volumeId, "max");

    expect(state.status).toBe("idle");
    expect(state.intensity).toBe("max");
    expect(await scans.getScanState(volumeId)).toMatchObject({ intensity: "max" });
  });

  it("advances through every stage to a completion report", async () => {
    const scans = createMockScanController({
      autoAdvance: true,
      states: { [volumeId]: createScanFixture("active", driveLabel, volumeId) },
    });

    let state = await scans.getScanState(volumeId);
    for (let attempt = 0; attempt < 60 && state?.status === "active"; attempt += 1) {
      state = await scans.getScanState(volumeId);
    }

    expect(state?.status).toBe("complete");
    expect(state?.report).not.toBeNull();
    expect(state?.stages.every((stage) => stage.state === "complete")).toBe(true);
  });
});
