import path from "node:path";
import { scanReadOnly } from "./read-only-guard.mjs";

const result = await scanReadOnly(path.resolve("src", "main"));

if (result.violations.length > 0) {
  console.error("Read-only guard failed. Direct filesystem writes appeared outside the allowlist:");
  for (const violation of result.violations) {
    console.error(`  ${violation}`);
  }
  console.error(
    "Review the change. Original archive files must never be written, renamed, or deleted outside the reviewed quarantine mover.",
  );
  process.exit(1);
}

console.log(`Read-only guard passed: ${result.scanned} main-process files scanned.`);
