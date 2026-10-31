import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve("resources", "bin");
const MANIFEST = path.resolve("native-binaries.lock.json");

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function validateEntry(entry) {
  if (!entry || typeof entry !== "object") {
    throw new Error("Binary entry must be an object");
  }
  if (typeof entry.name !== "string" || entry.name.length === 0) {
    throw new Error("Binary entry needs a name");
  }
  if (typeof entry.url !== "string" || !entry.url.startsWith("https://")) {
    throw new Error(`${entry.name}: url must be HTTPS`);
  }
  if (typeof entry.destination !== "string" || entry.destination.length === 0) {
    throw new Error(`${entry.name}: destination is required`);
  }
  if (path.isAbsolute(entry.destination) || entry.destination.includes("..")) {
    throw new Error(`${entry.name}: destination must stay inside resources/bin`);
  }
  if (typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(entry.sha256)) {
    throw new Error(`${entry.name}: sha256 must be 64 hex characters`);
  }
}

const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
if (!Array.isArray(manifest.binaries)) {
  throw new Error("native-binaries.lock.json must contain a binaries array");
}

if (manifest.binaries.length === 0) {
  console.log("No native binaries are configured yet. Nothing to fetch.");
  process.exit(0);
}

await mkdir(ROOT, { recursive: true });

for (const entry of manifest.binaries) {
  validateEntry(entry);
  const destination = path.join(ROOT, entry.destination);

  if (await exists(destination)) {
    const existing = await readFile(destination);
    if (sha256(existing) === entry.sha256.toLowerCase()) {
      console.log(`Verified ${entry.name}`);
      continue;
    }
    console.log(`Checksum mismatch for ${entry.name}; downloading a fresh copy.`);
  }

  console.log(`Fetching ${entry.name}...`);
  const response = await fetch(entry.url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`${entry.name}: download failed with ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const actual = sha256(buffer);
  if (actual !== entry.sha256.toLowerCase()) {
    throw new Error(`${entry.name}: checksum mismatch (${actual})`);
  }

  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, buffer);
  console.log(`Downloaded and verified ${entry.name}`);
}
