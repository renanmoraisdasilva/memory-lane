import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createMediaResponse,
  createThumbnailResponse,
  parseMediaUrl,
  parseRangeHeader,
} from "./media-response";

const temporaryDirectories: string[] = [];

async function createTempDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "memory-lane-media-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("media URL parsing", () => {
  it("accepts source thumbnail and media URLs", () => {
    expect(parseMediaUrl("ml-media://thumbnail/42")).toEqual({
      scope: "source",
      kind: "thumbnail",
      fileId: 42,
    });
    expect(parseMediaUrl("ml-media://media/7")).toEqual({
      scope: "source",
      kind: "media",
      fileId: 7,
    });
    expect(parseMediaUrl("ml-media://proxy/9")).toEqual({
      scope: "source",
      kind: "proxy",
      fileId: 9,
    });
  });

  it("accepts destination-scoped URLs by id", () => {
    expect(parseMediaUrl("ml-media://destination/dest-1/thumbnail/42")).toEqual({
      scope: "destination",
      destinationId: "dest-1",
      kind: "thumbnail",
      fileId: 42,
    });
    expect(parseMediaUrl("ml-media://destination/dest-1/media/7")).toEqual({
      scope: "destination",
      destinationId: "dest-1",
      kind: "media",
      fileId: 7,
    });
  });

  it("rejects other schemes, hosts, ids, and path injection", () => {
    expect(parseMediaUrl("https://thumbnail/42")).toBeNull();
    expect(parseMediaUrl("ml-media://other/42")).toBeNull();
    expect(parseMediaUrl("ml-media://thumbnail/0")).toBeNull();
    expect(parseMediaUrl("ml-media://thumbnail/4/extra")).toBeNull();
    expect(parseMediaUrl("ml-media://destination/../media/4")).toBeNull();
    expect(parseMediaUrl("ml-media://destination/dest/other/4")).toBeNull();
    expect(parseMediaUrl("ml-media://destination/dest/media/0")).toBeNull();
    expect(parseMediaUrl("ml-media://destination/dest/media")).toBeNull();
  });
});

describe("range parsing", () => {
  it("parses closed, open, and suffix ranges", () => {
    expect(parseRangeHeader("bytes=0-99", 1_000)).toEqual({ start: 0, end: 99 });
    expect(parseRangeHeader("bytes=100-", 1_000)).toEqual({ start: 100, end: 999 });
    expect(parseRangeHeader("bytes=-100", 1_000)).toEqual({ start: 900, end: 999 });
    expect(parseRangeHeader("bytes=900-1200", 1_000)).toEqual({ start: 900, end: 999 });
  });

  it("returns null for a full response and invalid for bad ranges", () => {
    expect(parseRangeHeader(null, 1_000)).toBeNull();
    expect(parseRangeHeader("bytes=0-1,2-3", 1_000)).toBe("invalid");
    expect(parseRangeHeader("bytes=1000-", 1_000)).toBe("invalid");
    expect(parseRangeHeader("bytes=10-5", 1_000)).toBe("invalid");
    expect(parseRangeHeader("items=0-5", 1_000)).toBe("invalid");
  });
});

describe("media responses", () => {
  it("serves a full file and a byte range", async () => {
    const directory = await createTempDirectory();
    const filePath = path.join(directory, "clip.bin");
    await writeFile(filePath, Buffer.from("0123456789"));

    const full = createMediaResponse({
      filePath,
      mime: "video/mp4",
      size: 10,
      rangeHeader: null,
      method: "GET",
    });
    expect(full.status).toBe(200);
    expect(full.headers.get("content-type")).toBe("video/mp4");
    expect(await full.text()).toBe("0123456789");

    const partial = createMediaResponse({
      filePath,
      mime: "video/mp4",
      size: 10,
      rangeHeader: "bytes=2-5",
      method: "GET",
    });
    expect(partial.status).toBe(206);
    expect(partial.headers.get("content-range")).toBe("bytes 2-5/10");
    expect(await partial.text()).toBe("2345");
  });

  it("returns 416 for an invalid range and supports HEAD", async () => {
    const directory = await createTempDirectory();
    const filePath = path.join(directory, "clip.bin");
    await writeFile(filePath, Buffer.from("0123456789"));

    const invalid = createMediaResponse({
      filePath,
      mime: null,
      size: 10,
      rangeHeader: "bytes=10-",
      method: "GET",
    });
    expect(invalid.status).toBe(416);
    expect(invalid.headers.get("content-range")).toBe("bytes */10");

    const head = createMediaResponse({
      filePath,
      mime: "image/png",
      size: 10,
      rangeHeader: null,
      method: "HEAD",
    });
    expect(head.status).toBe(200);
    expect(head.body).toBeNull();
  });

  it("serves a thumbnail with a cache header", async () => {
    const directory = await createTempDirectory();
    const filePath = path.join(directory, "thumb.jpg");
    await writeFile(filePath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

    const response = await createThumbnailResponse(filePath);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toContain("max-age");
  });
});
