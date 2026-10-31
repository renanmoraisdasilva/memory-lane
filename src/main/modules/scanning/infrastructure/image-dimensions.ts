import { open } from "node:fs/promises";

export interface ImageDimensions {
  width: number;
  height: number;
}

const READ_BYTES = 128 * 1024;

function validDimensions(width: number, height: number): ImageDimensions | null {
  return width > 0 && height > 0 ? { width, height } : null;
}

function parsePng(data: Buffer): ImageDimensions | null {
  if (data.length < 24 || data.readUInt32BE(0) !== 0x89504e47) {
    return null;
  }
  return validDimensions(data.readUInt32BE(16), data.readUInt32BE(20));
}

function parseGif(data: Buffer): ImageDimensions | null {
  if (data.length < 10 || data.toString("ascii", 0, 3) !== "GIF") {
    return null;
  }
  return validDimensions(data.readUInt16LE(6), data.readUInt16LE(8));
}

function parseBmp(data: Buffer): ImageDimensions | null {
  if (data.length < 26 || data.toString("ascii", 0, 2) !== "BM") {
    return null;
  }
  return validDimensions(Math.abs(data.readInt32LE(18)), Math.abs(data.readInt32LE(22)));
}

interface JpegMarker {
  code: number;
  offset: number;
}

function readJpegMarker(data: Buffer, offset: number): JpegMarker | null {
  let index = offset;
  if (data[index] !== 0xff) {
    return null;
  }
  while (data[index] === 0xff) {
    index += 1;
  }
  const code = data[index];
  return code === undefined ? null : { code, offset: index + 1 };
}

function isStandaloneMarker(code: number): boolean {
  return code === 0x01 || (code >= 0xd0 && code <= 0xd7);
}

function isStartOfFrame(code: number): boolean {
  return (
    (code >= 0xc0 && code <= 0xc3) ||
    (code >= 0xc5 && code <= 0xc7) ||
    (code >= 0xc9 && code <= 0xcb) ||
    (code >= 0xcd && code <= 0xcf)
  );
}

function readStartOfFrame(data: Buffer, offset: number): ImageDimensions | null {
  if (offset + 7 >= data.length) {
    return null;
  }
  return validDimensions(data.readUInt16BE(offset + 5), data.readUInt16BE(offset + 3));
}

function hasJpegSignature(data: Buffer): boolean {
  return data.length >= 4 && data[0] === 0xff && data[1] === 0xd8;
}

function isEndMarker(code: number): boolean {
  return code === 0xd9 || code === 0xda;
}

function readSegmentLength(data: Buffer, offset: number): number | null {
  if (offset + 1 >= data.length) {
    return null;
  }
  const length = data.readUInt16BE(offset);
  return length >= 2 && offset + length <= data.length ? length : null;
}

function parseJpeg(data: Buffer): ImageDimensions | null {
  if (!hasJpegSignature(data)) {
    return null;
  }

  let offset = 2;
  while (offset + 1 < data.length) {
    const marker = readJpegMarker(data, offset);
    if (marker === null) {
      return null;
    }
    offset = marker.offset;

    if (isStandaloneMarker(marker.code)) {
      continue;
    }
    if (isEndMarker(marker.code)) {
      return null;
    }

    const length = readSegmentLength(data, offset);
    if (length === null) {
      return null;
    }
    if (isStartOfFrame(marker.code)) {
      return readStartOfFrame(data, offset);
    }
    offset += length;
  }

  return null;
}

function parseWebp(data: Buffer): ImageDimensions | null {
  if (data.length < 30 || data.toString("ascii", 0, 4) !== "RIFF") {
    return null;
  }

  const chunk = data.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    return validDimensions(
      1 + (data.readUIntLE(24, 3) & 0xffffff),
      1 + (data.readUIntLE(27, 3) & 0xffffff),
    );
  }
  if (chunk === "VP8 ") {
    return validDimensions(data.readUInt16LE(26) & 0x3fff, data.readUInt16LE(28) & 0x3fff);
  }
  return null;
}

export function parseImageDimensions(data: Buffer): ImageDimensions | null {
  return parsePng(data) ?? parseGif(data) ?? parseBmp(data) ?? parseJpeg(data) ?? parseWebp(data);
}

export async function readImageDimensions(filePath: string): Promise<ImageDimensions | null> {
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(READ_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, READ_BYTES, 0);
    return parseImageDimensions(buffer.subarray(0, bytesRead));
  } finally {
    await handle.close();
  }
}
