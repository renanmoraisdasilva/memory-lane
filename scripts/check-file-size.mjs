import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve("src");
const HARD_LIMIT = 400;
const SOFT_LIMIT = 300;
const EXCLUDED_DIRS = new Set([path.join("src", "main", "db", "migrations")]);
const EXCLUDED_EXTENSIONS = new Set([".sql"]);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(path.relative(process.cwd(), fullPath))) {
        continue;
      }
      files.push(...(await collectFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function countLines(content) {
  if (content.length === 0) {
    return 0;
  }
  const normalized = content.replace(/\r\n/g, "\n");
  return normalized.endsWith("\n")
    ? normalized.split("\n").length - 1
    : normalized.split("\n").length;
}

const files = await collectFiles(ROOT);
const results = [];

for (const file of files) {
  if (file.endsWith(".d.ts") || EXCLUDED_EXTENSIONS.has(path.extname(file))) {
    continue;
  }
  const info = await stat(file);
  if (!info.isFile()) {
    continue;
  }
  const content = await readFile(file, "utf8");
  const lines = countLines(content);
  results.push({ file: path.relative(process.cwd(), file), lines });
}

results.sort((a, b) => b.lines - a.lines);
const overSoft = results.filter((result) => result.lines > SOFT_LIMIT);
const overHard = results.filter((result) => result.lines > HARD_LIMIT);

console.log(`Scanned ${results.length} TypeScript files.`);
console.log(`Soft target: ${SOFT_LIMIT} lines. Hard limit: ${HARD_LIMIT} lines.`);

if (overSoft.length > 0) {
  console.log("\nFiles over the soft target:");
  for (const result of overSoft) {
    console.log(`  ${result.lines.toString().padStart(4)}  ${result.file}`);
  }
}

if (overHard.length > 0) {
  console.error("\nFiles over the hard limit:");
  for (const result of overHard) {
    console.error(`  ${result.lines.toString().padStart(4)}  ${result.file}`);
  }
  process.exitCode = 1;
}
