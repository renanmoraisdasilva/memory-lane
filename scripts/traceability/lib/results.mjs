import path from "node:path";
import { idsIn } from "./context.mjs";
import { exists, newestMtime, readJson } from "./io.mjs";

export async function loadResults(context) {
  if (!(await exists(context.resultsPath))) {
    return null;
  }
  return readJson(context.resultsPath);
}

export function extractResults(testResults) {
  const results = new Map();
  for (const file of testResults?.testResults ?? []) {
    for (const assertion of file.assertionResults ?? []) {
      const text = `${assertion.fullName ?? ""} ${assertion.title ?? ""}`;
      const ids = new Set(idsIn(text));
      for (const id of ids) {
        const statuses = results.get(id) ?? [];
        statuses.push(assertion.status ?? "unknown");
        results.set(id, statuses);
      }
    }
  }
  return results;
}

export async function resultsAreStale(context, testResults, testFiles) {
  if (typeof testResults?.startTime !== "number" || testFiles.size === 0) {
    return false;
  }
  const files = [...testFiles].map((file) => path.join(context.root, file));
  const newest = await newestMtime(files);
  return newest > testResults.startTime + 1000;
}

export function summarizeStatuses(statuses) {
  if (statuses.length === 0) {
    return "not run";
  }
  if (statuses.every((status) => status === "passed")) {
    return "pass";
  }
  if (statuses.every((status) => status === "failed")) {
    return "fail";
  }
  return "mixed";
}
