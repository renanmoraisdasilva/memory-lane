import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parentPort } from "node:worker_threads";
import convert from "heic-convert";
import type {
  HeicPreviewRequest,
  HeicPreviewResponse,
} from "../modules/media/heic-preview-protocol";

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function post(response: HeicPreviewResponse): void {
  parentPort?.postMessage(response);
}

async function convertOne(request: HeicPreviewRequest): Promise<void> {
  try {
    const input = await readFile(request.inputPath);
    const output = await convert({ buffer: input, format: "JPEG", quality: 0.9 });
    await mkdir(path.dirname(request.outputPath), { recursive: true });
    await writeFile(request.outputPath, output);
    post({ id: request.id, ok: true, bytes: output.length });
  } catch (error) {
    post({ id: request.id, ok: false, error: errorText(error).slice(0, 500) });
  }
}

if (parentPort === null) {
  throw new Error("HEIC preview worker must run inside a worker thread");
}

let tail: Promise<void> = Promise.resolve();

parentPort.on("message", (request: HeicPreviewRequest) => {
  tail = tail.then(() => convertOne(request));
});
