import { isE2eFile, isVitestFile } from "./io.mjs";
import { summarizeStatuses } from "./results.mjs";

function inlineList(values) {
  if (!values || values.length === 0) {
    return "_none_";
  }
  return values.map((value) => `\`${value}\``).join(", ");
}

function testsFor(requirement, tags) {
  return [...(tags.get(requirement.id) ?? [])].sort();
}

function renderRequirement(requirement, tags) {
  const conflicts = (requirement.conflictsWith ?? []).join(", ") || "_none_";
  return [
    `### ${requirement.id} — ${requirement.title}`,
    "",
    `- **Kind:** ${requirement.kind}`,
    `- **Status:** ${requirement.status}`,
    `- **Verification:** ${requirement.verificationMethod ?? "_none_"}`,
    ...(requirement.legacyId ? [`- **Legacy ID:** ${requirement.legacyId}`] : []),
    `- **Text:** ${requirement.text}`,
    ...(requirement.sourceText ? [`- **Source text:** ${requirement.sourceText}`] : []),
    `- **Sources:** ${inlineList(requirement.sources)}`,
    `- **ADRs:** ${inlineList(requirement.adrs)}`,
    `- **Contracts:** ${inlineList(requirement.contracts)}`,
    `- **Implementation:** ${inlineList(requirement.implementation)}`,
    `- **Proving tests:** ${inlineList(testsFor(requirement, tags))}`,
    `- **Test notes:** ${requirement.testNotes ?? "_none_"}`,
    `- **Conflicts:** ${conflicts}`,
    `- **Notes:** ${requirement.notes || "_none_"}`,
    `- **Decision:** ${requirement.status === "needs-review" ? "_pending_" : requirement.status}`,
    "",
  ].join("\n");
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] ?? "none";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

export function renderReview(ledger, batch, tags) {
  const requirements = (ledger.requirements ?? []).filter((item) => item.batch === batch.id);
  const conflicts = (ledger.conflicts ?? []).filter((item) => item.batch === batch.id);
  const kinds = countBy(requirements, "kind");
  const methods = countBy(requirements, "verificationMethod");

  const summaryRows = requirements
    .map(
      (item) =>
        `| ${item.id} | ${item.kind} | ${item.status} | ${item.verificationMethod ?? "_none_"} | ${item.title} |`,
    )
    .join("\n");

  const intro =
    batch.status === "in-review"
      ? "This sheet is generated from `docs/traceability/requirements.json`. Review the proposed wording, edit the JSON if needed, then change `status` from `needs-review` to `accepted` (or `non-goal`) before the ledger is used as a gate."
      : "This sheet is generated from `docs/traceability/requirements.json`. This batch is accepted; the matrix is the live view. New requirements start at `needs-review`.";

  return [
    `# Batch ${batch.id} review — ${batch.title ?? batch.capability}`,
    "",
    `Status: **${batch.status}**. Requirements: **${requirements.length}**. Conflicts: **${conflicts.length}**.`,
    "",
    intro,
    "",
    `Kinds: ${Object.entries(kinds)
      .map(([kind, count]) => `${kind} ${count}`)
      .join(", ")}.`,
    "",
    "Verification: " +
      `${Object.entries(methods)
        .map(([method, count]) => `${method} ${count}`)
        .join(", ")}.`,
    "",
    "## Summary",
    "",
    "| ID | Kind | Status | Verification | Title |",
    "|---|---|---|---|---|",
    summaryRows,
    "",
    "## Requirements",
    "",
    requirements.map((requirement) => renderRequirement(requirement, tags)).join("\n"),
    "## Conflicts",
    "",
    conflicts.length === 0
      ? "_No conflicts in this batch._"
      : conflicts.map(renderConflict).join("\n"),
    "## Approval",
    "",
    batch.status === "in-review"
      ? "For each requirement, either:"
      : "This batch is approved. For future batches, either:",
    "",
    "1. change `status` to `accepted` and keep the text;",
    "2. edit `text` in the JSON and keep `needs-review`; or",
    "3. change `status` to `non-goal` if the item is out of scope.",
    "",
    "Do not mark a requirement `verified` unless its `verificationMethod` is satisfied:",
    "",
    "- `automated-test`: at least one test carries the requirement ID and passes;",
    "- `automated-check`: an implementation or guard path is recorded;",
    "- `manual`: a test note records the manual acceptance;",
    "- `inspection`: an implementation or guard path is recorded.",
    "",
  ].join("\n");
}

function matrixResult(requirement, testFiles, results) {
  if (requirement.status === "non-goal" || requirement.status === "deferred") {
    return requirement.status;
  }
  if (requirement.verificationMethod === "manual") {
    return "manual";
  }
  if (requirement.verificationMethod === "inspection") {
    return "inspection";
  }
  if (requirement.verificationMethod === "automated-check") {
    return "script";
  }
  if (testFiles.some(isVitestFile)) {
    return summarizeStatuses(results?.get(requirement.id) ?? []);
  }
  if (testFiles.some(isE2eFile)) {
    return "e2e";
  }
  return "not run";
}

export function renderMatrix(ledger, tags, results) {
  const requirements = ledger.requirements ?? [];
  const statuses = countBy(requirements, "status");
  const methods = countBy(requirements, "verificationMethod");
  const rows = requirements
    .map((requirement) => {
      const testFiles = testsFor(requirement, tags);
      const result = matrixResult(requirement, testFiles, results);
      return `| ${requirement.id} | ${requirement.title} | ${requirement.kind} | ${requirement.status} | ${requirement.verificationMethod ?? "_none_"} | ${testFiles.length} | ${result} |`;
    })
    .join("\n");

  return [
    "# Requirement matrix",
    "",
    "Generated from `docs/traceability/requirements.json`. Test links are derived from",
    "`[ML-...]` tags in test names; the ledger does not store test paths.",
    "",
    `Requirements: **${requirements.length}**. Status: ${Object.entries(statuses)
      .map(([status, count]) => `${status} ${count}`)
      .join(", ")}.`,
    "",
    `Verification: ${Object.entries(methods)
      .map(([method, count]) => `${method} ${count}`)
      .join(", ")}.`,
    "",
    "| ID | Requirement | Kind | Status | Verification | Tests | Result |",
    "|---|---|---|---|---|---:|---|",
    rows,
    "",
    "Result values: `pass`, `fail`, and `mixed` come from `docs/traceability/test-results.json`;",
    "`e2e` means Playwright tags only; `script`, `manual`, and `inspection` follow the recorded",
    "method; `not run` means no automated result exists yet; `non-goal` and `deferred` are",
    "explicit scope decisions. A requirement is `verified` only when it meets the gate for its",
    "method.",
    "",
  ].join("\n");
}

function renderConflict(conflict) {
  const claims = (conflict.claims ?? [])
    .map((claim) => `- \`${claim.source}\`: ${claim.text}`)
    .join("\n");
  const contradicted = (conflict.contradictedBy ?? [])
    .map((claim) => `- \`${claim.source}\`: ${claim.text}`)
    .join("\n");

  return [
    `### ${conflict.id} — ${conflict.title}`,
    "",
    `- **Severity:** ${conflict.severity}`,
    `- **Status:** ${conflict.status}`,
    `- **Decision:** ${conflict.decision ?? "_pending_"}`,
    `- **Affected requirements:** ${(conflict.affectedRequirements ?? []).join(", ") || "_none_"}`,
    "",
    "**Claims**",
    "",
    claims || "_none_",
    "",
    "**Contradicted by**",
    "",
    contradicted || "_none_",
    "",
    `**Proposed resolution:** ${conflict.proposedResolution}`,
    "",
    `**Recommendation:** ${conflict.recommendation}`,
    "",
  ].join("\n");
}

export function renderConflicts(ledger) {
  const conflicts = ledger.conflicts ?? [];
  return [
    "# Traceability conflicts",
    "",
    "Generated from `docs/traceability/requirements.json`.",
    "",
    conflicts.length === 0 ? "_No conflicts recorded._" : conflicts.map(renderConflict).join("\n"),
  ].join("\n");
}
