import { execFileSync } from "node:child_process";
import path from "node:path";
import { toPosix } from "./context.mjs";
import { isE2eFile, isVitestFile, stripAnchor } from "./io.mjs";

function normalizePath(root, value) {
  const absolute = path.isAbsolute(value) ? value : path.join(root, value);
  return toPosix(path.relative(root, absolute));
}

function normalizeLinked(value) {
  return path.posix.normalize(toPosix(stripAnchor(value)).replace(/\/+$/, ""));
}

function pathMatches(changed, linked) {
  return changed === linked || changed.startsWith(`${linked}/`);
}

export function parseImpactArgs(argv) {
  const options = { paths: [], staged: false, since: null, json: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--staged") {
      options.staged = true;
    } else if (arg === "--since") {
      options.since = argv[index + 1] ?? null;
      index += 1;
      if (options.since === null) {
        throw new Error("--since needs a git ref.");
      }
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown option ${arg}.`);
    } else {
      options.paths.push(arg);
    }
  }
  return options;
}

export function gitChangedPaths(root, options) {
  const args = ["diff", "--name-only", "--diff-filter=ACMR"];
  if (options.staged) {
    args.push("--cached");
  } else if (options.since) {
    args.push(`${options.since}...HEAD`);
  } else {
    args.push("HEAD");
  }
  const output = execFileSync("git", args, { cwd: root, encoding: "utf8" });
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function resolveImpact(ledger, tags, paths, root = process.cwd()) {
  const changed = paths.map((value) => normalizePath(root, value));
  const matches = [];
  for (const requirement of ledger.requirements ?? []) {
    const linked = new Set(
      [
        ...(requirement.sources ?? []),
        ...(requirement.adrs ?? []),
        ...(requirement.contracts ?? []),
        ...(requirement.implementation ?? []),
      ].map(normalizeLinked),
    );
    const testFiles = new Set(tags.get(requirement.id) ?? []);
    const hits = changed.filter(
      (value) =>
        [...linked].some((linkedPath) => pathMatches(value, linkedPath)) || testFiles.has(value),
    );
    if (hits.length > 0) {
      matches.push({ requirement, hits, tests: [...testFiles].sort() });
    }
  }
  return matches;
}

export function formatImpact(paths, matches) {
  if (matches.length === 0) {
    return [`No requirements are linked to ${paths.length} changed path(s).`];
  }
  const allTests = new Set();
  const lines = [`Traceability impact for ${paths.length} changed path(s):`, ""];
  for (const { requirement, hits, tests } of matches) {
    lines.push(
      `${requirement.id}  ${requirement.status}  ${requirement.verificationMethod ?? "_none_"}`,
      `  ${requirement.title}`,
      `  changed: ${hits.join(", ")}`,
    );
    if (tests.length > 0) {
      lines.push(`  tests:   ${tests.join(", ")}`);
      for (const test of tests) {
        allTests.add(test);
      }
    }
    lines.push("");
  }
  lines.push(`${matches.length} requirement(s); ${allTests.size} test file(s).`);
  const sorted = [...allTests].sort();
  const vitestFiles = sorted.filter(isVitestFile);
  const e2eFiles = sorted.filter(isE2eFile);
  if (vitestFiles.length > 0) {
    lines.push("", `npx vitest run ${vitestFiles.join(" ")}`);
  }
  if (e2eFiles.length > 0) {
    lines.push("", `npx playwright test ${e2eFiles.join(" ")}`);
  }
  return lines;
}
