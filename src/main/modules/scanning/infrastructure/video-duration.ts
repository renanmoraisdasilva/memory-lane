import { open } from "node:fs/promises";
import path from "node:path";

const SUPPORTED_EXTENSIONS = new Set([".mp4", ".mov", ".m4v"]);
const MAX_MOOV_BYTES = 2 * 1024 * 1024;
const MAX_HEADER_BYTES = 16;

interface BoxHeader {
  type: string;
  size: number;
  headerSize: number;
}

function readBoxHeader(buffer: Buffer, offset: number, endOffset: number): BoxHeader | null {
  if (offset + 8 > buffer.length) {
    return null;
  }

  const size32 = buffer.readUInt32BE(offset);
  const type = buffer.toString("ascii", offset + 4, offset + 8);
  let size = size32;
  let headerSize = 8;

  if (size32 === 1) {
    if (offset + 16 > buffer.length) {
      return null;
    }
    const largeSize = buffer.readBigUInt64BE(offset + 8);
    if (largeSize > BigInt(Number.MAX_SAFE_INTEGER)) {
      return null;
    }
    size = Number(largeSize);
    headerSize = 16;
  } else if (size32 === 0) {
    size = endOffset - offset;
  }

  if (size < headerSize) {
    return null;
  }
  return { type, size, headerSize };
}

function secondsFromTimescale(timescale: number, duration: number): number | null {
  if (timescale <= 0 || duration <= 0) {
    return null;
  }
  const seconds = duration / timescale;
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

export function parseMvhdDuration(payload: Buffer): number | null {
  if (payload.length < 20) {
    return null;
  }

  const version = payload[0];
  if (version === 0) {
    const timescale = payload.readUInt32BE(12);
    const duration = payload.readUInt32BE(16);
    if (duration === 0xffffffff) {
      return null;
    }
    return secondsFromTimescale(timescale, duration);
  }

  if (version === 1) {
    if (payload.length < 32) {
      return null;
    }
    const timescale = payload.readUInt32BE(20);
    const duration = payload.readBigUInt64BE(24);
    if (duration > BigInt(Number.MAX_SAFE_INTEGER)) {
      return null;
    }
    return secondsFromTimescale(timescale, Number(duration));
  }

  return null;
}

function parseMoovDuration(payload: Buffer): number | null {
  let offset = 0;
  while (offset + 8 <= payload.length) {
    const header = readBoxHeader(payload, offset, payload.length);
    if (header === null) {
      return null;
    }
    if (header.type === "mvhd") {
      const start = offset + header.headerSize;
      const end = Math.min(payload.length, offset + header.size);
      return parseMvhdDuration(payload.subarray(start, end));
    }
    offset += header.size;
  }
  return null;
}

async function readBytes(
  handle: Awaited<ReturnType<typeof open>>,
  length: number,
  position: number,
): Promise<Buffer> {
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await handle.read(buffer, 0, length, position);
  return buffer.subarray(0, bytesRead);
}

export async function readVideoDurationSeconds(filePath: string): Promise<number | null> {
  if (!SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
    return null;
  }

  const handle = await open(filePath, "r");
  try {
    const stats = await handle.stat();
    let offset = 0;

    while (offset + 8 <= stats.size) {
      const headerBytes = await readBytes(
        handle,
        Math.min(MAX_HEADER_BYTES, stats.size - offset),
        offset,
      );
      const header = readBoxHeader(headerBytes, 0, stats.size - offset);
      if (header === null || header.size === 0) {
        return null;
      }

      if (header.type === "moov") {
        const payloadLength = Math.min(header.size - header.headerSize, MAX_MOOV_BYTES);
        if (payloadLength <= 0) {
          return null;
        }
        const payload = await readBytes(handle, payloadLength, offset + header.headerSize);
        const duration = parseMoovDuration(payload);
        if (duration !== null) {
          return duration;
        }
      }

      offset += header.size;
    }

    return null;
  } finally {
    await handle.close();
  }
}
