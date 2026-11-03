import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { StartRunParamsSchema } from "../../src/shared/contracts/replication/run-types";
import {
  RegisterDestinationParamsSchema,
  UpdateDestinationParamsSchema,
} from "../../src/shared/contracts/replication/types";

const forbiddenKeys = ["sourcePath", "sourceRoot", "rootPath", "absolutePath", "filePath"];

describe("source path safety [ML-SAFE-007]", () => {
  it("[ML-SAFE-007] replication run requests accept no source path", () => {
    for (const key of forbiddenKeys) {
      expect(StartRunParamsSchema.shape).not.toHaveProperty(key);
    }
  });

  it("[ML-SAFE-007] destination requests accept no source path", () => {
    for (const key of forbiddenKeys) {
      expect(RegisterDestinationParamsSchema.shape).not.toHaveProperty(key);
      expect(UpdateDestinationParamsSchema.shape).not.toHaveProperty(key);
    }
  });

  it("[ML-SAFE-007] cleanup start accepts no parameters", async () => {
    const api = await readFile(path.join(process.cwd(), "src/shared/contracts/api.ts"), "utf8");
    expect(api).toMatch(/startCleanup\(\): Promise/);
  });
});
