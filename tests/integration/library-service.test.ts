import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type {
  LibraryItemDetails,
  LibrarySummary,
  LibraryTimelinePage,
} from "@shared/contracts/library";
import { handleMediaRequest } from "../../src/main/modules/media/media-request-handler";
import type { ThumbnailWorkScheduler } from "../../src/main/modules/scanning/domain/scan-files";
import { createScanHarness, testLogger, waitForComplete } from "./scan-harness";

function png(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(24);
  buffer.writeUInt32BE(0x89504e47, 0);
  buffer.writeUInt32BE(0x0d0a1a0a, 4);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function request(url: string, headers: Record<string, string> = {}): Request {
  return { url, method: "GET", headers: new Headers(headers) } as Request;
}

describe("library integration", () => {
  it("queries scanned media and serves its thumbnail and media range", async () => {
    const harness = await createScanHarness();
    try {
      await mkdir(path.join(harness.drive.rootPath, "nested"), { recursive: true });
      const photoPath = path.join(harness.drive.rootPath, "photo.png");
      await writeFile(photoPath, png(1024, 768));
      await writeFile(path.join(harness.drive.rootPath, "notes.txt"), "notes");

      await harness.scanService.startScan(harness.drive.volumeId, "max");
      await waitForComplete(harness.scanService, harness.drive);

      const summary = await harness.db.request<LibrarySummary>("library.getSummary", {});
      expect(summary).toMatchObject({
        totalItems: 1,
        photoCount: 1,
        videoCount: 0,
        indexedBytes: 24,
        undatedCount: 0,
      });
      expect(summary.lastScanAt).not.toBeNull();

      const page = await harness.db.request<LibraryTimelinePage>("library.getTimeline", {
        filter: "all",
        limit: 200,
      });
      expect(page.items).toHaveLength(1);
      expect(page.items[0]).toMatchObject({
        name: "photo.png",
        mediaClass: "image",
        width: 1024,
        height: 768,
        thumbnailStatus: "ready",
        isMissing: false,
      });
      const item = page.items[0];
      expect(item?.thumbnailUrl).toContain("ml-media://thumbnail/");

      const details = await harness.db.request<LibraryItemDetails>("library.getItem", {
        fileId: item?.fileId,
        filter: "all",
      });
      expect(details).toMatchObject({
        path: photoPath,
        folder: harness.drive.rootPath,
        position: 1,
        total: 1,
      });
      expect(details.mediaUrl).toContain("ml-media://media/");
      expect(details.metadata).toEqual(
        expect.arrayContaining([
          { key: "media.width", value: "1024", source: "image" },
          { key: "media.height", value: "768", source: "image" },
        ]),
      );

      const context = await harness.db.request<{ cachePath: string }>("library.getContext", {});
      expect(context.cachePath).toBe(path.join(harness.drive.rootPath, ".memorylane", "cache"));

      const noThumbnails: ThumbnailWorkScheduler = {
        generate: async () => {
          throw new Error("cached thumbnail should not regenerate");
        },
      };
      const noPreviews = {
        convert: async () => null,
        shutdown: async () => undefined,
      };
      const thumbnail = await handleMediaRequest(
        { db: harness.db, thumbnails: noThumbnails, previews: noPreviews, logger: testLogger() },
        request(item?.thumbnailUrl ?? ""),
      );
      expect(thumbnail.status).toBe(200);
      expect(thumbnail.headers.get("content-type")).toBe("image/jpeg");

      const media = await handleMediaRequest(
        { db: harness.db, thumbnails: noThumbnails, previews: noPreviews, logger: testLogger() },
        request(details.mediaUrl ?? "", { range: "bytes=0-3" }),
      );
      expect(media.status).toBe(206);
      expect(media.headers.get("content-range")).toMatch(/^bytes 0-3\/24$/);
      expect((await media.arrayBuffer()).byteLength).toBe(4);
    } finally {
      await harness.dispose();
    }
  });
});
