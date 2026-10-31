import type { LibraryItem } from "../features/library/types";

const MB = 1024 ** 2;

export function createLargeLibraryFixture(count = 500): LibraryItem[] {
  const base = Date.parse("2024-08-18T18:42:00.000Z");
  return Array.from({ length: count }, (_, index) => {
    const fileId = index + 1;
    const video = index % 5 === 0;
    return {
      fileId,
      name: video
        ? `CLIP_${String(fileId).padStart(4, "0")}.MP4`
        : `IMG_${String(fileId).padStart(4, "0")}.JPG`,
      mediaClass: video ? "video" : "image",
      format: video ? "MP4" : "JPEG",
      sizeBytes: (video ? 120 : 8) * MB,
      width: video ? 1920 : 3000,
      height: video ? 1080 : 2000,
      durationSeconds: video ? 75 : null,
      date: {
        value: new Date(base - index * 86_400_000).toISOString(),
        precision: "exact",
        source: "EXIF DateTimeOriginal",
      },
      thumbnailStatus: "ready",
      thumbnailUrl: `ml-media://thumbnail/${String(fileId)}`,
      isMissing: false,
    } satisfies LibraryItem;
  });
}
