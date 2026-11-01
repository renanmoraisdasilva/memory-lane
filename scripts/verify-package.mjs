import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const RELEASE_DIR =
  process.env.MEMORY_LANE_RELEASE_DIR === undefined
    ? path.resolve("release")
    : path.resolve(process.env.MEMORY_LANE_RELEASE_DIR);
const packageJson = JSON.parse(await readFile(path.resolve("package.json"), "utf8"));
const version = packageJson.version;
const unpackedExe = path.join(RELEASE_DIR, "win-unpacked", "Memory Lane.exe");
const setupExe = path.join(RELEASE_DIR, `Memory-Lane-Setup-${version}-x64.exe`);
const portableExe = path.join(RELEASE_DIR, `Memory-Lane-${version}-x64.exe`);
const setupBlockmap = `${setupExe}.blockmap`;
const appAsar = path.join(RELEASE_DIR, "win-unpacked", "resources", "app.asar");
const appIcon = path.join(RELEASE_DIR, "win-unpacked", "resources", "icon.png");
const sqliteBinary = path.join(
  RELEASE_DIR,
  "win-unpacked",
  "resources",
  "app.asar.unpacked",
  "node_modules",
  "better-sqlite3",
  "build",
  "Release",
  "better_sqlite3.node",
);
const exifToolBinary = path.join(
  RELEASE_DIR,
  "win-unpacked",
  "resources",
  "app.asar.unpacked",
  "node_modules",
  "exiftool-vendored.exe",
  "bin",
  "exiftool.exe",
);
const ffmpegBinary = path.join(RELEASE_DIR, "win-unpacked", "resources", "bin", "ffmpeg.exe");

const required = [
  ["Unpacked executable", unpackedExe],
  ["NSIS installer", setupExe],
  ["Portable executable", portableExe],
  ["NSIS blockmap", setupBlockmap],
  ["Application archive", appAsar],
  ["Application icon", appIcon],
  ["SQLite native binary", sqliteBinary],
  ["ExifTool binary", exifToolBinary],
  ["FFmpeg binary", ffmpegBinary],
];

for (const [label, filePath] of required) {
  try {
    const info = await stat(filePath);
    if (!info.isFile() || info.size === 0) {
      throw new Error("file is empty");
    }
  } catch (error) {
    console.error(`${label} is missing or invalid: ${filePath}`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

const checksumTargets = [setupExe, portableExe, unpackedExe];
const checksums = [];
for (const filePath of checksumTargets) {
  checksums.push(`${await hashFile(filePath)}  ${path.basename(filePath)}`);
}
const checksumPath = path.join(RELEASE_DIR, "SHA256SUMS.txt");
await writeFile(checksumPath, `${checksums.join("\n")}\n`, "utf8");

const entries = await readdir(RELEASE_DIR, { withFileTypes: true });
const artifacts = entries
  .filter((entry) => entry.isFile() && /\.(exe|zip)$/i.test(entry.name))
  .map((entry) => entry.name)
  .sort();

console.log("Packaged executable and runtime binaries found.");
console.log("Release artifacts:");
for (const artifact of artifacts) {
  console.log(`  ${artifact}`);
}
console.log("SHA-256:");
for (const checksum of checksums) {
  console.log(`  ${checksum}`);
}
console.log(`Checksums written to ${path.relative(process.cwd(), checksumPath)}.`);
