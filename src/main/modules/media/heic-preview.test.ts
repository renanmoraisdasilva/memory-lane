import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "../../logging/types";
import { createHeicPreviewConverter, type PreviewConverter } from "./heic-preview";

const WORKER_SOURCE = `
const { parentPort } = require("node:worker_threads");
const fs = require("node:fs");
const path = require("node:path");

parentPort.on("message", (request) => {
  fs.appendFileSync(path.join(__dirname, "messages.log"), request.id + "\\n");
  setTimeout(() => {
    if (request.inputPath.includes("bad")) {
      parentPort.postMessage({ id: request.id, ok: false, error: "decode failed" });
    } else {
      parentPort.postMessage({ id: request.id, ok: true, bytes: 7 });
    }
  }, 40);
});
`;

const temporaryDirectories: string[] = [];
const converters: PreviewConverter[] = [];

function testLogger(): Logger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

async function createHarness(): Promise<{
  converter: PreviewConverter;
  logger: Logger;
  directory: string;
  logPath: string;
}> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "memory-lane-heic-"));
  temporaryDirectories.push(directory);
  const workerPath = path.join(directory, "worker.cjs");
  await writeFile(workerPath, WORKER_SOURCE);
  const logger = testLogger();
  const converter = createHeicPreviewConverter({ logger, workerPath });
  converters.push(converter);
  return { converter, logger, directory, logPath: path.join(directory, "messages.log") };
}

async function messageCount(logPath: string): Promise<number> {
  try {
    const text = await readFile(logPath, "utf8");
    return text
      .trim()
      .split("\n")
      .filter((line) => line.length > 0).length;
  } catch {
    return 0;
  }
}

afterEach(async () => {
  await Promise.all(converters.splice(0).map((converter) => converter.shutdown()));
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("HEIC preview worker", () => {
  it("returns converted bytes and deduplicates requests for the same output", async () => {
    const harness = await createHarness();
    const outputPath = path.join(harness.directory, "preview.jpg");

    const [first, second] = await Promise.all([
      harness.converter.convert("first.heic", outputPath),
      harness.converter.convert("second.heic", outputPath),
    ]);

    expect(first).toEqual({ bytes: 7 });
    expect(second).toBe(first);
    expect(await messageCount(harness.logPath)).toBe(1);
  });

  it("returns null and logs when the worker reports a decode failure", async () => {
    const harness = await createHarness();

    const result = await harness.converter.convert(
      "bad.heic",
      path.join(harness.directory, "bad.jpg"),
    );

    expect(result).toBeNull();
    expect(harness.logger.warn).toHaveBeenCalledWith(
      "HEIC preview conversion failed",
      expect.objectContaining({ message: "decode failed" }),
    );
  });

  it("shuts down the worker", async () => {
    const harness = await createHarness();
    await expect(harness.converter.shutdown()).resolves.toBeUndefined();
  });
});
