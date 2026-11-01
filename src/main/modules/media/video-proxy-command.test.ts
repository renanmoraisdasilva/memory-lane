import { describe, expect, it } from "vitest";
import { buildVideoProxyArgs, parseFfmpegProgressSeconds } from "./video-proxy-command";

describe("video proxy command", () => {
  it("builds a Chromium-compatible H.264/AAC MP4 command", () => {
    const args = buildVideoProxyArgs({
      inputPath: "C:\\archive\\clip.wmv",
      outputPath: "C:\\cache\\clip.mp4",
    });
    expect(args).toContain("libx264");
    expect(args).toContain("aac");
    expect(args).toContain("yuv420p");
    expect(args).toContain("+faststart");
    expect(args).toContain("pipe:1");
    expect(args).toContain("0:a:0?");
    expect(args.at(-1)).toBe("C:\\cache\\clip.mp4");
  });

  it("parses FFmpeg progress microseconds", () => {
    expect(parseFfmpegProgressSeconds("out_time_ms=1500000")).toBe(1.5);
    expect(parseFfmpegProgressSeconds("out_time_us=2500000")).toBe(2.5);
    expect(parseFfmpegProgressSeconds("progress=continue")).toBeNull();
    expect(parseFfmpegProgressSeconds("out_time_ms=not-a-number")).toBeNull();
  });
});
