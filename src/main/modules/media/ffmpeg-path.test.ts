import path from "node:path";
import ffmpegStatic from "ffmpeg-static";
import { describe, expect, it } from "vitest";
import { resolveFfmpegPath } from "./ffmpeg-path";

describe("ffmpeg path", () => {
  it("uses the packaged resources directory", () => {
    expect(resolveFfmpegPath(true, "C:\\app\\resources")).toBe(
      path.join("C:\\app\\resources", "bin", "ffmpeg.exe"),
    );
  });

  it("uses the installed development binary", () => {
    expect(resolveFfmpegPath(false)).toBe(ffmpegStatic ?? "ffmpeg");
  });
});
