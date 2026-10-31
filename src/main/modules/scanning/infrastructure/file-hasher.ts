import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import type { FileHasher } from "../domain/scan-files";

export function createFileHasher(): FileHasher {
  return {
    hash(filePath: string): Promise<string> {
      return new Promise((resolve, reject) => {
        const hash = createHash("sha256");
        const stream = createReadStream(filePath, { highWaterMark: 1024 * 1024 });
        stream.on("data", (chunk: string | Buffer) => {
          hash.update(chunk);
        });
        stream.on("error", reject);
        stream.on("end", () => {
          resolve(hash.digest("hex"));
        });
      });
    },
  };
}
