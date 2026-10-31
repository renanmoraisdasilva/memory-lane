import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";

export type MediaUrlTarget =
  { kind: "thumbnail"; fileId: number } | { kind: "media"; fileId: number };

export function parseMediaUrl(url: string): MediaUrlTarget | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "ml-media:") {
    return null;
  }
  if (parsed.hostname !== "thumbnail" && parsed.hostname !== "media") {
    return null;
  }
  const match = /^\/(\d+)$/.exec(parsed.pathname);
  if (match === null || match[1] === undefined) {
    return null;
  }
  const fileId = Number(match[1]);
  if (!Number.isSafeInteger(fileId) || fileId <= 0) {
    return null;
  }
  return { kind: parsed.hostname === "thumbnail" ? "thumbnail" : "media", fileId };
}

export type RangeResult = { start: number; end: number } | null | "invalid";

interface RangeParts {
  startText: string;
  endText: string;
}

function parseRangeParts(value: string): RangeParts | null {
  if (!value.startsWith("bytes=") || value.includes(",")) {
    return null;
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (match === null) {
    return null;
  }
  const startText = match[1];
  const endText = match[2];
  if (startText === undefined || endText === undefined) {
    return null;
  }
  if (startText === "" && endText === "") {
    return null;
  }
  return { startText, endText };
}

function parseSuffixRange(endText: string, size: number): RangeResult {
  const suffixLength = Number(endText);
  if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
    return "invalid";
  }
  const start = Math.max(0, size - suffixLength);
  return { start, end: size - 1 };
}

function parseBoundedRange(startText: string, endText: string, size: number): RangeResult {
  const start = Number(startText);
  if (!Number.isSafeInteger(start) || start < 0 || start >= size) {
    return "invalid";
  }
  if (endText === "") {
    return { start, end: size - 1 };
  }
  const end = Number(endText);
  if (!Number.isSafeInteger(end) || end < start) {
    return "invalid";
  }
  return { start, end: Math.min(end, size - 1) };
}

export function parseRangeHeader(value: string | null, size: number): RangeResult {
  if (value === null) {
    return null;
  }
  const parts = parseRangeParts(value);
  if (parts === null) {
    return "invalid";
  }
  return parts.startText === ""
    ? parseSuffixRange(parts.endText, size)
    : parseBoundedRange(parts.startText, parts.endText, size);
}

export function createMediaResponse(options: {
  filePath: string;
  mime: string | null;
  size: number;
  rangeHeader: string | null;
  method: string;
}): Response {
  const contentType = options.mime ?? "application/octet-stream";
  const range = parseRangeHeader(options.rangeHeader, options.size);

  if (range === "invalid") {
    return new Response(null, {
      status: 416,
      headers: {
        "Content-Range": `bytes */${options.size}`,
        "Accept-Ranges": "bytes",
      },
    });
  }

  if (range === null) {
    const headers = new Headers({
      "Content-Type": contentType,
      "Content-Length": String(options.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
    });
    if (options.method === "HEAD") {
      return new Response(null, { status: 200, headers });
    }
    const stream = createReadStream(options.filePath);
    return new Response(Readable.toWeb(stream) as ReadableStream, { status: 200, headers });
  }

  const length = range.end - range.start + 1;
  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Length": String(length),
    "Content-Range": `bytes ${range.start}-${range.end}/${options.size}`,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
  });
  if (options.method === "HEAD") {
    return new Response(null, { status: 206, headers });
  }
  const stream = createReadStream(options.filePath, { start: range.start, end: range.end });
  return new Response(Readable.toWeb(stream) as ReadableStream, { status: 206, headers });
}

export async function createThumbnailResponse(cachePath: string): Promise<Response> {
  const bytes = await readFile(cachePath);
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
