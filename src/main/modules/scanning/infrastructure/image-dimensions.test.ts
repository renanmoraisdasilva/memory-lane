import { describe, expect, it } from "vitest";
import { parseImageDimensions } from "./image-dimensions";

function png(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(24);
  buffer.writeUInt32BE(0x89504e47, 0);
  buffer.writeUInt32BE(0x0d0a1a0a, 4);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function jpeg(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(32);
  buffer[0] = 0xff;
  buffer[1] = 0xd8;
  buffer[2] = 0xff;
  buffer[3] = 0xe0;
  buffer.writeUInt16BE(4, 4);
  buffer[8] = 0xff;
  buffer[9] = 0xc0;
  buffer.writeUInt16BE(17, 10);
  buffer[12] = 8;
  buffer.writeUInt16BE(height, 13);
  buffer.writeUInt16BE(width, 15);
  return buffer;
}

function webp(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(30);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(22, 4);
  buffer.write("WEBP", 8, "ascii");
  buffer.write("VP8X", 12, "ascii");
  buffer.writeUInt32LE(10, 16);
  buffer.writeUIntLE(width - 1, 24, 3);
  buffer.writeUIntLE(height - 1, 27, 3);
  return buffer;
}

describe("image dimensions", () => {
  it("reads PNG dimensions", () => {
    expect(parseImageDimensions(png(1920, 1080))).toEqual({ width: 1920, height: 1080 });
  });

  it("reads GIF dimensions", () => {
    const buffer = Buffer.alloc(10);
    buffer.write("GIF89a", 0, "ascii");
    buffer.writeUInt16LE(640, 6);
    buffer.writeUInt16LE(480, 8);
    expect(parseImageDimensions(buffer)).toEqual({ width: 640, height: 480 });
  });

  it("reads BMP dimensions and ignores a top-down height", () => {
    const buffer = Buffer.alloc(26);
    buffer.write("BM", 0, "ascii");
    buffer.writeInt32LE(800, 18);
    buffer.writeInt32LE(-600, 22);
    expect(parseImageDimensions(buffer)).toEqual({ width: 800, height: 600 });
  });

  it("reads JPEG start-of-frame dimensions", () => {
    expect(parseImageDimensions(jpeg(1200, 800))).toEqual({ width: 1200, height: 800 });
  });

  it("reads WebP VP8X dimensions", () => {
    expect(parseImageDimensions(webp(300, 200))).toEqual({ width: 300, height: 200 });
  });

  it("returns null for unknown, truncated, or invalid data", () => {
    expect(parseImageDimensions(Buffer.from("plain text"))).toBeNull();
    expect(parseImageDimensions(png(10, 10).subarray(0, 20))).toBeNull();
    expect(parseImageDimensions(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBeNull();
    expect(parseImageDimensions(png(0, 0))).toBeNull();
  });
});
