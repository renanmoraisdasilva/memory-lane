import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve("src", "main");
const WRITE_PATTERN =
  /\b(?:writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream|rename|renameSync|unlink|unlinkSync|rm|rmSync|truncate|truncateSync|copyFile|copyFileSync|mkdir|mkdirSync|rmdir|rmdirSync|cp|cpSync)\s*\(/;
const ALLOWED = new Set(
  [
    "src/main/bootstrap/user-data.ts",
    "src/main/db/db-worker-handler.ts",
    "src/main/db/promotion-snapshot-files.ts",
    "src/main/db/settings-db-handlers.ts",
    "src/main/db/source-index-writer.ts",
    "src/main/modules/drives/application/drive-service.ts",
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

async function collect(directory, files) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collect(entryPath, files);
    } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      files.push(entryPath);
    }
  }
}

const files = [];
await collect(ROOT, files);
const violations = [];

for (const file of files) {
  const relativeFile = path.relative(process.cwd(), file);
  if (ALLOWED.has(relativeFile)) {
    continue;
  }
  const content = await readFile(file, "utf8");
  const lines = content.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (WRITE_PATTERN.test(line)) {
      violations.push(`${relativeFile}:${index + 1}: ${line.trim()}`);
    }
  }
}

if (violations.length > 0) {
  console.error("Read-only guard failed. Direct filesystem writes appeared outside the allowlist:");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  console.error(
    "Review the change. Original archive files must never be written, renamed, or deleted.",
  );
  process.exit(1);
}

console.log(`Read-only guard passed: ${files.length} main-process files scanned.`);
