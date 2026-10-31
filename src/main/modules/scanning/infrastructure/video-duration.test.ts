import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseMvhdDuration, readVideoDurationSeconds } from "./video-duration";

const temporaryDirectories: string[] = [];

async function createTempDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "memory-lane-video-"));
  temporaryDirectories.push(directory);
  return directory;
}

function mvhdV0(timescale: number, duration: number): Buffer {
  const payload = Buffer.alloc(20);
  payload.writeUInt32BE(timescale, 12);
  payload.writeUInt32BE(duration, 16);
  return payload;
}

function mvhdV1(timescale: number, duration: bigint): Buffer {
  const payload = Buffer.alloc(32);
  payload[0] = 1;
  payload.writeUInt32BE(timescale, 20);
  payload.writeBigUInt64BE(duration, 24);
  return payload;
}

function box(type: string, payload: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(payload.length + 8, 0);
  header.write(type, 4, "ascii");
  return Buffer.concat([header, payload]);
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("video duration", () => {
  it("reads version 0 and version 1 mvhd durations", () => {
    expect(parseMvhdDuration(mvhdV0(1_000, 5_000))).toBe(5);
    expect(parseMvhdDuration(mvhdV1(600, 1_200n))).toBe(2);
  });

  it("rejects invalid timescales, durations, and versions", () => {
    expect(parseMvhdDuration(mvhdV0(0, 5_000))).toBeNull();
    expect(parseMvhdDuration(mvhdV0(1_000, 0))).toBeNull();
    expect(parseMvhdDuration(mvhdV0(1_000, 0xffffffff))).toBeNull();
    expect(parseMvhdDuration(Buffer.from([2, 0, 0, 0]))).toBeNull();
  });

  it("finds mvhd after ftyp and mdat boxes", async () => {
    const directory = await createTempDirectory();
    const filePath = path.join(directory, "clip.mp4");
    const ftyp = box("ftyp", Buffer.from("isomisom"));
    const mdat = box("mdat", Buffer.alloc(32, 1));
    const moov = box("moov", box("mvhd", mvhdV0(1_000, 12_500)));
    await writeFile(filePath, Buffer.concat([ftyp, mdat, moov]));

    await expect(readVideoDurationSeconds(filePath)).resolves.toBe(12.5);
  });

  it("ignores unsupported extensions and files without mvhd", async () => {
    const directory = await createTempDirectory();
    const textPath = path.join(directory, "clip.txt");
    const emptyPath = path.join(directory, "empty.mp4");
    await writeFile(textPath, "not a video");
    await writeFile(emptyPath, "");

    await expect(readVideoDurationSeconds(textPath)).resolves.toBeNull();
    await expect(readVideoDurationSeconds(emptyPath)).resolves.toBeNull();
  });
});
