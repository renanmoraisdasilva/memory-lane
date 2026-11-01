export interface VideoProxyCommandInput {
  inputPath: string;
  outputPath: string;
}

export function buildVideoProxyArgs(input: VideoProxyCommandInput): string[] {
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    input.inputPath,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-sn",
    "-dn",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-vf",
    "scale=trunc(iw/2)*2:trunc(ih/2)*2",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-max_muxing_queue_size",
    "4096",
    "-movflags",
    "+faststart",
    "-progress",
    "pipe:1",
    "-nostats",
    "-f",
    "mp4",
    input.outputPath,
  ];
}

export function parseFfmpegProgressSeconds(line: string): number | null {
  const match = /^out_time_(?:ms|us)=(\d+)$/u.exec(line.trim());
  if (match === null || match[1] === undefined) {
    return null;
  }
  const microseconds = Number(match[1]);
  if (!Number.isFinite(microseconds) || microseconds < 0) {
    return null;
  }
  return microseconds / 1_000_000;
}
