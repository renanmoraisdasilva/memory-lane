import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { exiftool } from "exiftool-vendored";
import type { PendingMetadataFile } from "../../src/main/modules/scanning/domain/scan-files";
import { createFileMetadataExtractor } from "../../src/main/modules/scanning/infrastructure/file-metadata";

const ONE_PIXEL_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EB//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EB//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EB//2Q==",
  "base64",
);

const temporaryDirectories: string[] = [];

async function createPhoto(): Promise<{ directory: string; filePath: string }> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "memory-lane-exif-"));
  temporaryDirectories.push(directory);
  const filePath = path.join(directory, "dated.jpg");
  await writeFile(filePath, ONE_PIXEL_JPEG);
  await exiftool.write(
    filePath,
    {
      DateTimeOriginal: "2011:07:04 15:30:00",
      CreateDate: "2011:07:04 15:31:00",
      Make: "TestMake",
      Model: "TestModel",
      GPSLatitude: 48.8584,
      GPSLatitudeRef: "N",
      GPSLongitude: 2.2945,
      GPSLongitudeRef: "E",
    },
    ["-overwrite_original"],
  );
  return { directory, filePath };
}

afterAll(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
  await exiftool.end();
});

describe("ExifTool integration", () => {
  it("reads a real JPEG and resolves its capture date", async () => {
    const { filePath } = await createPhoto();
    const extractor = createFileMetadataExtractor();
    const file: PendingMetadataFile = {
      id: 1,
      path: filePath,
      mediaClass: "image",
      format: "JPG",
      size: ONE_PIXEL_JPEG.length,
      createdAtFs: "2020-05-01T10:00:00.000Z",
      modifiedAtFs: "2020-06-01T10:00:00.000Z",
    };

    try {
      const extracted = await extractor.extract(file);
      expect(extracted.date).toMatchObject({
        resolvedDate: "2011-07-04T15:30:00",
        precision: "exact",
        source: "exif.datetimeOriginal",
      });
      expect(extracted.width).toBe(1);
      expect(extracted.height).toBe(1);
      expect(extracted.entries).toEqual(
        expect.arrayContaining([
          { key: "metadata.exiftool", value: "ok", source: "exiftool" },
          { key: "camera.make", value: "TestMake", source: "exiftool" },
          { key: "gps.latitude", value: "48.858400", source: "exiftool" },
        ]),
      );
    } finally {
      await extractor.shutdown?.();
    }
  }, 30_000);
});
