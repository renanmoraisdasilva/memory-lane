import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const RELEASE_DIR = path.resolve("release");
const UNPACKED_EXE = path.join(RELEASE_DIR, "win-unpacked", "Memory Lane.exe");

try {
  const info = await stat(UNPACKED_EXE);
  if (!info.isFile() || info.size === 0) {
    throw new Error("win-unpacked executable is empty");
  }
} catch (error) {
  console.error(`Packaged executable not found: ${UNPACKED_EXE}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const entries = await readdir(RELEASE_DIR, { withFileTypes: true });
const artifacts = entries
  .filter((entry) => entry.isFile() && /\.(exe|zip)$/i.test(entry.name))
  .map((entry) => entry.name)
  .sort();

if (artifacts.length === 0) {
  console.error("No installer or portable ZIP artifacts were produced.");
  process.exit(1);
}

console.log("Packaged executable found.");
console.log("Release artifacts:");
for (const artifact of artifacts) {
  console.log(`  ${artifact}`);
}
