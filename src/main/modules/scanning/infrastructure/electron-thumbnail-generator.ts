import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { nativeImage } from "electron";
import type { ThumbnailGenerator } from "../domain/scan-files";

const THUMBNAIL_SIZE = { width: 320, height: 320 };

export function createElectronThumbnailGenerator(): ThumbnailGenerator {
  return {
    async generate(filePath: string, outputPath: string): Promise<{ bytes: number } | null> {
      if (process.platform !== "win32" && process.platform !== "darwin") {
        return null;
      }

      const image = await nativeImage.createThumbnailFromPath(filePath, THUMBNAIL_SIZE);
      if (image.isEmpty()) {
        return null;
      }

      const buffer = image.toJPEG(80);
      if (buffer.length === 0) {
        return null;
      }

      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, buffer);
      return { bytes: buffer.length };
    },
  };
}
