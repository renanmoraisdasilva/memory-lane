import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const WRITE_PATTERN =
  /\b(?:writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream|rename|renameSync|unlink|unlinkSync|rm|rmSync|truncate|truncateSync|copyFile|copyFileSync|mkdir|mkdirSync|rmdir|rmdirSync|cp|cpSync)\s*\(/;

export const ALLOWED = new Set(
  [
    "src/main/bootstrap/user-data.ts",
    "src/main/db/backup-runner.ts",
    "src/main/db/db-worker-handler.ts",
    "src/main/db/promotion-snapshot-files.ts",
    "src/main/db/settings-db-handlers.ts",
    "src/main/db/source-index-writer.ts",
    "src/main/modules/drives/application/drive-service.ts",
    "src/main/modules/health/infrastructure/quarantine-mover.ts",
    "src/main/modules/media/media-request-handler.ts",
    "src/main/modules/media/video-proxy.ts",
    "src/main/modules/replication/infrastructure/destination-writer.ts",
    "src/main/modules/scanning/application/scan-runner.ts",
    "src/main/modules/scanning/infrastructure/electron-thumbnail-generator.ts",
    "src/main/modules/settings/application/settings-service.ts",
    "src/main/platform/catalog-lock.ts",
    "src/main/workers/heic-worker.ts",
  ].map((file) => file.replaceAll("/", path.sep)),
);

export async function collect(directory, files) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collect(entryPath, files);
    } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      files.push(entryPath);
    }
  }
}

export function findViolations(inputs, allowed = ALLOWED) {
  const violations = [];
  for (const input of inputs) {
    if (allowed.has(input.relativeFile)) {
      continue;
    }
    const lines = input.content.split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      if (WRITE_PATTERN.test(line)) {
        violations.push(`${input.relativeFile}:${index + 1}: ${line.trim()}`);
      }
    }
  }
  return violations;
}

export async function scanReadOnly(root, allowed = ALLOWED) {
  const files = [];
  await collect(root, files);
  const inputs = [];
  for (const file of files) {
    const relativeFile = path.relative(process.cwd(), file);
    if (allowed.has(relativeFile)) {
      continue;
    }
    inputs.push({ relativeFile, content: await readFile(file, "utf8") });
  }
  return { scanned: files.length, violations: findViolations(inputs, allowed) };
}
