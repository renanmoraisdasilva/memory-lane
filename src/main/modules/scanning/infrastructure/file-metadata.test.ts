import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PendingMetadataFile } from "../domain/scan-files";
import { classifyFile, createFileMetadataExtractor } from "./file-metadata";
import type { ExifMetadataReader } from "./exif-metadata";

const temporaryDirectories: string[] = [];

async function createTempDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "memory-lane-metadata-"));
  temporaryDirectories.push(directory);
  return directory;
}

function pendingFile(overrides: Partial<PendingMetadataFile> = {}): PendingMetadataFile {
  return {
    id: 1,
    path: "C:\\archive\\photo.jpg",
    mediaClass: "image",
    format: "JPG",
    size: 2048,
    createdAtFs: "2020-05-01T10:00:00.000Z",
    modifiedAtFs: "2020-06-01T10:00:00.000Z",
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("file classification", () => {
  it("classifies common image and video formats", () => {
    expect(classifyFile("C:\\a\\photo.JPG")).toMatchObject({
      extension: "jpg",
      mediaClass: "image",
      format: "JPG",
      mime: "image/jpeg",
    });
    expect(classifyFile("C:\\a\\clip.mp4")).toMatchObject({
      extension: "mp4",
      mediaClass: "video",
      mime: "video/mp4",
    });
  });

  it("classifies unknown and extensionless files as other", () => {
    expect(classifyFile("C:\\a\\notes.txt")).toMatchObject({
      extension: "txt",
      mediaClass: "other",
      format: "TXT",
      mime: null,
    });
    expect(classifyFile("C:\\a\\LICENSE")).toEqual({
      extension: null,
      mediaClass: "other",
      format: null,
      mime: null,
    });
  });
});

describe("file metadata extractor", () => {
  it("extracts filesystem metadata, image dimensions, and a resolved date", async () => {
    const directory = await createTempDirectory();
    const filePath = path.join(directory, "photo.png");
    const png = Buffer.alloc(24);
    png.writeUInt32BE(0x89504e47, 0);
    png.writeUInt32BE(0x0d0a1a0a, 4);
    png.writeUInt32BE(1024, 16);
    png.writeUInt32BE(768, 20);
    await writeFile(filePath, png);

    const extracted = await createFileMetadataExtractor({ exif: null }).extract(
      pendingFile({ path: filePath }),
    );

    expect(extracted.entries).toEqual(
      expect.arrayContaining([
        { key: "filesystem.size", value: "2048", source: "filesystem" },
        { key: "media.width", value: "1024", source: "image" },
        { key: "media.height", value: "768", source: "image" },
      ]),
    );
    expect(extracted.date).toMatchObject({
      precision: "exact",
      source: "filesystem.created",
      confidence: 0.6,
    });
    expect(extracted.width).toBe(1024);
    expect(extracted.height).toBe(768);
    expect(extracted.durationSeconds).toBeNull();
  });

  it("falls back to the modified date when the created date is unusable", async () => {
    const extracted = await createFileMetadataExtractor({ exif: null }).extract(
      pendingFile({
        path: "C:\\missing\\photo.jpg",
        createdAtFs: "1800-01-01T00:00:00.000Z",
        modifiedAtFs: "2021-07-01T10:00:00.000Z",
      }),
    );

    expect(extracted.date).toMatchObject({
      resolvedDate: "2021-07-01T10:00:00.000Z",
      source: "filesystem.modified",
      confidence: 0.4,
    });
  });

  it("does not read dimensions for videos", async () => {
    const extracted = await createFileMetadataExtractor({ exif: null }).extract(
      pendingFile({ path: "C:\\missing\\clip.mp4", mediaClass: "video", format: "MP4" }),
    );

    expect(extracted.entries.some((entry) => entry.key.startsWith("media."))).toBe(false);
    expect(extracted.width).toBeNull();
    expect(extracted.durationSeconds).toBeNull();
  });

  it("[ML-SCAN-011] uses ExifTool facts and date candidates when available", async () => {
    const shutdown = vi.fn(async () => undefined);
    const exif: ExifMetadataReader = {
      read: vi.fn(async () => ({
        entries: [
          { key: "metadata.exiftool", value: "ok", source: "exiftool" },
          { key: "media.width", value: "1920", source: "exiftool" },
          { key: "media.height", value: "1080", source: "exiftool" },
        ],
        dateCandidates: [
          {
            resolvedDate: "2011-07-04T15:30:00",
            precision: "exact" as const,
            source: "exif.datetimeOriginal",
            confidence: 0.95,
            originalValue: "2011:07:04 15:30:00",
            suspicious: false,
            suspiciousReason: null,
          },
        ],
        width: 1920,
        height: 1080,
        durationSeconds: null,
        frameRate: 29.97,
      })),
      shutdown,
    };

    const extractor = createFileMetadataExtractor({ exif });
    const extracted = await extractor.extract(pendingFile({ path: "C:\\missing\\photo.jpg" }));

    expect(extracted.date).toMatchObject({
      resolvedDate: "2011-07-04T15:30:00",
      source: "exif.datetimeOriginal",
    });
    expect(extracted.width).toBe(1920);
    expect(extracted.frameRate).toBe(29.97);
    expect(extracted.entries).toEqual(
      expect.arrayContaining([
        { key: "metadata.exiftool", value: "ok", source: "exiftool" },
        { key: "media.width", value: "1920", source: "exiftool" },
      ]),
    );
    await extractor.shutdown?.();
    expect(shutdown).toHaveBeenCalled();
  });

  it("falls back when ExifTool fails", async () => {
    const exif: ExifMetadataReader = {
      read: vi.fn(async () => {
        throw new Error("ExifTool unavailable");
      }),
      shutdown: vi.fn(async () => undefined),
    };

    const extracted = await createFileMetadataExtractor({ exif }).extract(
      pendingFile({ path: "C:\\missing\\photo.jpg" }),
    );

    expect(extracted.date?.source).toBe("filesystem.created");
    expect(extracted.entries).toContainEqual({
      key: "metadata.exiftool",
      value: "failed",
      source: "exiftool",
    });
  });
});
