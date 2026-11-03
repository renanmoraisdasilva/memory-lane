import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { TEST_FILE_PATTERN, VITEST_FILE_PATTERN, E2E_PREFIX } from "./context.mjs";

const IGNORED_DIRS = new Set([
  ".git",
  "coverage",
  "node_modules",
  "out",
  "playwright-report",
  "release",
]);

export async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function writeText(filePath, text) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, text, "utf8");
}

export async function walkCodeFiles(directory, files = []) {
  if (!(await exists(directory))) {
    return files;
  }
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        await walkCodeFiles(path.join(directory, entry.name), files);
      }
      continue;
    }
    if (entry.isFile() && /\.(ts|tsx|mjs|js)$/.test(entry.name)) {
      files.push(path.join(directory, entry.name));
    }
  }
  return files;
}

export function stripAnchor(value) {
  return value.split("#")[0].replace(/:\d+(?:-\d+)?$/, "");
}

export function anchorOf(value) {
  const index = value.indexOf("#");
  return index === -1 ? null : value.slice(index + 1);
}

export function isTestFile(filePath) {
  return TEST_FILE_PATTERN.test(filePath);
}

export function isVitestFile(filePath) {
  return VITEST_FILE_PATTERN.test(filePath);
}

export function isE2eFile(filePath) {
  return filePath.startsWith(E2E_PREFIX);
}

export function slugifyHeading(heading) {
  return heading
    .toLowerCase()
    .replace(/`|\*|_|\[|\]|\(|\)|\.|,|:|\/|\\|!|\?|"|'/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export async function getHeadings(context, filePath) {
  if (context.headingCache.has(filePath)) {
    return context.headingCache.get(filePath);
  }
  const text = await readFile(filePath, "utf8");
  const headings = new Set();
  for (const line of text.split(/\r?\n/)) {
    const match = /^#{1,6}\s+(.+)$/.exec(line);
    if (match) {
      headings.add(slugifyHeading(match[1]));
    }
  }
  context.headingCache.set(filePath, headings);
  return headings;
}

export async function newestMtime(files) {
  let newest = 0;
  for (const file of files) {
    try {
      const info = await stat(file);
      if (info.mtimeMs > newest) {
        newest = info.mtimeMs;
      }
    } catch {
      // A file can disappear during a scan; ignore it.
    }
  }
  return newest;
}
