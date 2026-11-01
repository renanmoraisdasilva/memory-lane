import path from "node:path";
import ffmpegStatic from "ffmpeg-static";

export function resolveFfmpegPath(
  isPackaged: boolean,
  resourcesPath = process.resourcesPath,
): string {
  if (isPackaged) {
    return path.join(resourcesPath, "bin", "ffmpeg.exe");
  }
  return ffmpegStatic ?? "ffmpeg";
}
