import { access, readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const LEDGER = path.join(ROOT, "docs", "traceability", "requirements.json");
const REVIEW_DIR = path.join(ROOT, "docs", "traceability", "reviews");
const MATRIX = path.join(ROOT, "docs", "traceability", "matrix.md");
const CONFLICTS = path.join(ROOT, "docs", "traceability", "conflicts.md");
const TEST_RESULTS = path.join(ROOT, "docs", "traceability", "test-results.json");

const ID_PATTERN = /\[(ML-[A-Z]+-\d{3})\]/g;

function rel(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

function sourcePath(source) {
  const withoutAnchor = source.split("#")[0];
  return withoutAnchor.replace(/:\d+(?:-\d+)?$/, "");
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function validate(ledger) {
  const errors = [];
  const warnings = [];
  const ids = new Set();
  const statuses = new Set(ledger.statusValues ?? []);
  const kinds = new Set(ledger.kindValues ?? []);
  const batchIds = new Set((ledger.batches ?? []).map((batch) => batch.id));
  const conflictIds = new Set((ledger.conflicts ?? []).map((conflict) => conflict.id));

  for (const requirement of ledger.requirements ?? []) {
    if (!requirement.id) {
      errors.push("A requirement is missing an id.");
      continue;
    }
    if (ids.has(requirement.id)) {
      errors.push(`${requirement.id}: duplicate id.`);
    }
    ids.add(requirement.id);

    for (const field of ["title", "kind", "status", "proposedText", "batch"]) {
      if (requirement[field] === undefined || requirement[field] === "") {
        errors.push(`${requirement.id}: missing ${field}.`);
      }
    }
    if (!statuses.has(requirement.status)) {
      errors.push(`${requirement.id}: unknown status ${requirement.status}.`);
    }
    if (!kinds.has(requirement.kind)) {
      errors.push(`${requirement.id}: unknown kind ${requirement.kind}.`);
    }
    if (!batchIds.has(requirement.batch)) {
      errors.push(`${requirement.id}: unknown batch ${requirement.batch}.`);
    }
    for (const conflict of requirement.conflictsWith ?? []) {
      if (!conflictIds.has(conflict)) {
        errors.push(`${requirement.id}: unknown conflict ${conflict}.`);
      }
    }
    if (requirement.status === "verified" && (requirement.tests ?? []).length === 0) {
      errors.push(`${requirement.id}: verified without a test.`);
    }
  }

  for (const conflict of ledger.conflicts ?? []) {
    for (const requirementId of conflict.affectedRequirements ?? []) {
      if (!ids.has(requirementId)) {
        errors.push(`${conflict.id}: unknown requirement ${requirementId}.`);
      }
    }
  }

  return { errors, warnings };
}

async function validatePaths(ledger) {
  const errors = [];
  for (const requirement of ledger.requirements ?? []) {
    for (const source of requirement.sources ?? []) {
      const filePath = path.join(ROOT, sourcePath(source));
      if (!(await exists(filePath))) {
        errors.push(`${requirement.id}: missing source ${source}.`);
      }
    }
    for (const test of requirement.tests ?? []) {
      if (!(await exists(path.join(ROOT, test)))) {
        errors.push(`${requirement.id}: missing test ${test}.`);
      }
    }
  }
  return errors;
}

async function validateDocs() {
  const errors = [];
  const migrationsDir = path.join(ROOT, "src", "main", "db", "migrations", "catalog");
  const migrations = (await readdir(migrationsDir)).filter((file) => /^\d{4}-.*\.sql$/.test(file));
  const latest = Math.max(...migrations.map((file) => Number(file.slice(0, 4))));

  const contractDir = path.join(ROOT, "docs", "contracts");
  for (const file of (await readdir(contractDir)).filter((item) => item.endsWith(".md"))) {
    const text = await readFile(path.join(contractDir, file), "utf8");
    const pattern =
      /(?:Catalog schema version:|current catalog schema version is|catalog schema is version)\s*(\d+)/gi;
    for (const match of text.matchAll(pattern)) {
      if (Number(match[1]) !== latest) {
        errors.push(
          `docs/contracts/${file}: schema version ${match[1]} does not match migration ${latest}.`,
        );
      }
    }
  }

  const currentDocs = [
    "README.md",
    "docs/product/scope-and-implementation.md",
    "docs/product/roadmap.md",
  ];
  for (const relPath of currentDocs) {
    const text = await readFile(path.join(ROOT, relPath), "utf8");
    if (/\b\d+\s+(?:automated\s+)?tests?\s+across\s+\d+\s+files\b/i.test(text)) {
      errors.push(
        `${relPath}: contains a hand-written test count; link to docs/traceability/matrix.md instead.`,
      );
    }
  }

  const docsIndex = await readFile(path.join(ROOT, "docs", "README.md"), "utf8");
  for (const required of ["product/duplicate-quarantine-plan.md", "traceability/README.md"]) {
    if (!docsIndex.includes(required)) {
      errors.push(`docs/README.md: missing ${required}.`);
    }
  }

  const adrIndex = await readFile(path.join(ROOT, "docs", "adr", "README.md"), "utf8");
  if (!adrIndex.includes("0010-duplicate-quarantine.md")) {
    errors.push("docs/adr/README.md: missing 0010-duplicate-quarantine.md.");
  }

  return errors;
}

function inlineList(values) {
  if (!values || values.length === 0) {
    return "_none_";
  }
  return values.map((value) => `\`${value}\``).join(", ");
}

function renderRequirement(requirement) {
  const conflicts = (requirement.conflictsWith ?? []).join(", ") || "_none_";
  return [
    `### ${requirement.id} — ${requirement.title}`,
    "",
    `- **Kind:** ${requirement.kind}`,
    `- **Status:** ${requirement.status}`,
    ...(requirement.legacyId ? [`- **Legacy ID:** ${requirement.legacyId}`] : []),
    `- **Proposed:** ${requirement.proposedText}`,
    `- **Current / source:** ${requirement.currentText ?? "_not recorded_"}`,
    `- **Sources:** ${inlineList(requirement.sources)}`,
    `- **ADRs:** ${inlineList(requirement.adrs)}`,
    `- **Contracts:** ${inlineList(requirement.contracts)}`,
    `- **Existing tests:** ${inlineList(requirement.tests)}`,
    `- **Test notes:** ${requirement.testNotes ?? "_none_"}`,
    `- **Conflicts:** ${conflicts}`,
    `- **Notes:** ${requirement.notes || "_none_"}`,
    `- **Decision:** ${requirement.status === "needs-review" ? "_pending_" : requirement.status}`,
    "",
  ].join("\n");
}

function renderReview(ledger, batch) {
  const requirements = (ledger.requirements ?? []).filter((item) => item.batch === batch.id);
  const conflicts = (ledger.conflicts ?? []).filter((item) => item.batch === batch.id);
  const counts = requirements.reduce((result, item) => {
    result[item.kind] = (result[item.kind] ?? 0) + 1;
    return result;
  }, {});

  const summaryRows = requirements
    .map((item) => `| ${item.id} | ${item.kind} | ${item.status} | ${item.title} |`)
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
    `Kinds: ${Object.entries(counts)
      .map(([kind, count]) => `${kind} ${count}`)
      .join(", ")}.`,
    "",
    "## Summary",
    "",
    "| ID | Kind | Status | Title |",
    "|---|---|---|---|",
    summaryRows,
    "",
    "## Requirements",
    "",
    requirements.map(renderRequirement).join("\n"),
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
    "1. change `status` to `accepted` and keep the proposed text;",
    "2. edit `proposedText` in the JSON and keep `needs-review`; or",
    "3. change `status` to `non-goal` if the item is out of scope.",
    "",
    "Do not mark a requirement `verified` until at least one test carries its ID and the test result is green.",
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

function renderConflicts(ledger) {
  const conflicts = ledger.conflicts ?? [];
  return [
    "# Traceability conflicts",
    "",
    "Generated from `docs/traceability/requirements.json`.",
    "",
    conflicts.length === 0 ? "_No conflicts recorded._" : conflicts.map(renderConflict).join("\n"),
  ].join("\n");
}

function extractTestIds(testResults) {
  const results = new Map();
  for (const file of testResults.testResults ?? []) {
    for (const assertion of file.assertionResults ?? []) {
      const title = assertion.title ?? "";
      for (const match of title.matchAll(ID_PATTERN)) {
        const id = match[1];
        const status = assertion.status ?? "unknown";
        const current = results.get(id) ?? [];
        current.push(status);
        results.set(id, current);
      }
    }
  }
  return results;
}

function summarizeTestStatus(statuses) {
  if (!statuses || statuses.length === 0) {
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

function renderMatrix(ledger, testResults) {
  const results = testResults ? extractTestIds(testResults) : new Map();
  const rows = (ledger.requirements ?? [])
    .map((requirement) => {
      const statuses = results.get(requirement.id) ?? [];
      return `| ${requirement.id} | ${requirement.title} | ${requirement.kind} | ${requirement.status} | ${requirement.tests?.length ?? 0} | ${summarizeTestStatus(statuses)} |`;
    })
    .join("\n");

  return [
    "# Requirement matrix",
    "",
    "Generated from `docs/traceability/requirements.json`.",
    "",
    "| ID | Requirement | Kind | Status | Test files | Result |",
    "|---|---|---|---|---:|---|",
    rows,
    "",
    "Test results are read from `docs/traceability/test-results.json` when present. A requirement is `verified` when at least one ID-tagged test passes; non-goals have no test by design.",
    "",
  ].join("\n");
}

async function main() {
  const check = process.argv.includes("--check");
  const ledger = await readJson(LEDGER);
  const validation = validate(ledger);
  const pathErrors = await validatePaths(ledger);
  const docsErrors = await validateDocs();
  const errors = [...validation.errors, ...pathErrors, ...docsErrors];

  if (errors.length > 0) {
    console.error("Traceability validation failed:");
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    if (check) {
      process.exitCode = 1;
      return;
    }
  }

  const batches = (ledger.batches ?? []).filter((item) => item.reviewSheet);
  if (batches.length === 0) {
    throw new Error("No batches with a review sheet are defined.");
  }

  await mkdir(REVIEW_DIR, { recursive: true });

  let testResults = null;
  if (await exists(TEST_RESULTS)) {
    testResults = await readJson(TEST_RESULTS);
  }

  for (const batch of batches) {
    const reviewPath = path.join(ROOT, batch.reviewSheet);
    await writeFile(reviewPath, renderReview(ledger, batch), "utf8");
    console.log(`Wrote ${rel(reviewPath)}`);
  }
  await writeFile(CONFLICTS, renderConflicts(ledger), "utf8");
  await writeFile(MATRIX, renderMatrix(ledger, testResults), "utf8");

  console.log(`Wrote ${rel(CONFLICTS)}`);
  console.log(`Wrote ${rel(MATRIX)}`);
  console.log(
    `Requirements: ${ledger.requirements.length}; conflicts: ${ledger.conflicts.length}; validation errors: ${errors.length}.`,
  );

  if (check && errors.length > 0) {
    process.exitCode = 1;
  }
}

await main();
