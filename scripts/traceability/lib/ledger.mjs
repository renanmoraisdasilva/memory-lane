import { readFile } from "node:fs/promises";
import path from "node:path";
import { ID_PATTERN, SCHEMA_VERSION, idsIn, relative } from "./context.mjs";
import {
  anchorOf,
  exists,
  getHeadings,
  isE2eFile,
  isTestFile,
  isVitestFile,
  stripAnchor,
  walkCodeFiles,
} from "./io.mjs";

const REQUIRED_FIELDS = ["id", "batch", "capability", "kind", "title", "status", "sources"];
const TAG_SCAN_EXCLUDES = ["scripts/traceability/"];

function localToday() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function validateLedger(ledger) {
  const errors = [];
  const warnings = [];

  if (ledger.schemaVersion !== SCHEMA_VERSION) {
    errors.push(`ledger schemaVersion must be ${SCHEMA_VERSION}.`);
  }
  if (typeof ledger.updated !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(ledger.updated)) {
    errors.push("ledger updated must be YYYY-MM-DD.");
  } else if (ledger.updated > localToday()) {
    errors.push(`ledger updated ${ledger.updated} is in the future.`);
  }

  const statuses = new Set(ledger.statusValues ?? []);
  const kinds = new Set(ledger.kindValues ?? []);
  const methods = new Set(ledger.verificationMethodValues ?? []);
  const batchIds = new Set((ledger.batches ?? []).map((batch) => batch.id));
  const conflictIds = new Set((ledger.conflicts ?? []).map((conflict) => conflict.id));
  const ids = new Set();

  if (!isStringArray(ledger.statusValues) || statuses.size === 0) {
    errors.push("ledger statusValues must be a non-empty string array.");
  }
  if (!isStringArray(ledger.kindValues) || kinds.size === 0) {
    errors.push("ledger kindValues must be a non-empty string array.");
  }
  if (!isStringArray(ledger.verificationMethodValues) || methods.size === 0) {
    errors.push("ledger verificationMethodValues must be a non-empty string array.");
  }

  for (const requirement of ledger.requirements ?? []) {
    if (typeof requirement.id !== "string" || !ID_PATTERN.test(requirement.id)) {
      errors.push(`Invalid requirement id ${requirement.id ?? "<missing>"}.`);
      continue;
    }
    if (ids.has(requirement.id)) {
      errors.push(`${requirement.id}: duplicate id.`);
    }
    ids.add(requirement.id);

    for (const field of REQUIRED_FIELDS) {
      if (requirement[field] === undefined || requirement[field] === "") {
        errors.push(`${requirement.id}: missing ${field}.`);
      }
    }
    if (typeof requirement.text !== "string" || requirement.text.trim() === "") {
      errors.push(`${requirement.id}: text must be a non-empty string.`);
    }
    if (
      requirement.sourceText !== undefined &&
      (typeof requirement.sourceText !== "string" || requirement.sourceText.trim() === "")
    ) {
      errors.push(`${requirement.id}: sourceText must be a non-empty string when present.`);
    }
    if ("currentText" in requirement || "proposedText" in requirement) {
      errors.push(
        `${requirement.id}: use text and optional sourceText, not currentText/proposedText.`,
      );
    }
    if ("tests" in requirement) {
      errors.push(
        `${requirement.id}: tests links are derived from ID tags; remove the tests field.`,
      );
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
    for (const field of ["sources", "adrs", "contracts", "implementation", "conflictsWith"]) {
      if (requirement[field] !== undefined && !isStringArray(requirement[field])) {
        errors.push(`${requirement.id}: ${field} must be a string array.`);
      }
    }
    if (requirement.status === "verified" || requirement.status === "implemented") {
      if (!methods.has(requirement.verificationMethod)) {
        errors.push(
          `${requirement.id}: ${requirement.status} requires a valid verificationMethod.`,
        );
      }
    } else if (
      requirement.verificationMethod !== undefined &&
      !methods.has(requirement.verificationMethod)
    ) {
      errors.push(
        `${requirement.id}: unknown verificationMethod ${requirement.verificationMethod}.`,
      );
    }
  }

  for (const conflict of ledger.conflicts ?? []) {
    for (const requirementId of conflict.affectedRequirements ?? []) {
      if (!ids.has(requirementId)) {
        errors.push(`${conflict.id}: unknown requirement ${requirementId}.`);
      }
    }
  }

  const seenBatches = new Set();
  for (const batch of ledger.batches ?? []) {
    if (seenBatches.has(batch.id)) {
      errors.push(`Duplicate batch ${batch.id}.`);
    }
    seenBatches.add(batch.id);
  }

  return { errors, warnings };
}

async function validateDocReference(requirement, field, value, context, errors) {
  const filePath = path.join(context.root, stripAnchor(value));
  if (!(await exists(filePath))) {
    errors.push(`${requirement.id}: missing ${field} ${value}.`);
    return;
  }
  const anchor = anchorOf(value);
  if (anchor === null) {
    return;
  }
  const headings = await getHeadings(context, filePath);
  if (!headings.has(anchor)) {
    errors.push(`${requirement.id}: missing anchor ${value}.`);
  }
}

export async function validateReferences(ledger, context) {
  const errors = [];
  for (const requirement of ledger.requirements ?? []) {
    for (const [field, values] of [
      ["source", requirement.sources],
      ["adr", requirement.adrs],
      ["contract", requirement.contracts],
    ]) {
      for (const value of values ?? []) {
        await validateDocReference(requirement, field, value, context, errors);
      }
    }
    for (const value of requirement.implementation ?? []) {
      if (!(await exists(path.join(context.root, value)))) {
        errors.push(`${requirement.id}: missing implementation ${value}.`);
      }
    }
  }
  return errors;
}

export async function collectTags(context) {
  const tags = new Map();
  const warnings = [];
  const testFiles = new Set();

  for (const root of context.scanRoots) {
    for (const file of await walkCodeFiles(root)) {
      const relativePath = relative(context, file);
      if (TAG_SCAN_EXCLUDES.some((prefix) => relativePath.startsWith(prefix))) {
        continue;
      }
      if (isTestFile(relativePath)) {
        testFiles.add(relativePath);
      }
      const text = await readFile(file, "utf8");
      const ids = idsIn(text);
      if (ids.length === 0) {
        continue;
      }
      if (!isTestFile(relativePath)) {
        warnings.push(`ID tag in non-test file ${relativePath}: ${ids.join(", ")}.`);
        continue;
      }
      for (const id of ids) {
        const files = tags.get(id) ?? new Set();
        files.add(relativePath);
        tags.set(id, files);
      }
    }
  }

  return { tags, warnings, testFiles };
}

function evidenceStatuses(results, id) {
  return results?.get(id) ?? [];
}

export function verifyEvidence(ledger, tags, results, options = {}) {
  const { requireResults = false, staleResults = false } = options;
  const errors = [];
  const warnings = [];
  const knownIds = new Set((ledger.requirements ?? []).map((requirement) => requirement.id));

  for (const id of tags.keys()) {
    if (!knownIds.has(id)) {
      errors.push(`Orphan ID tag ${id}: no requirement uses it.`);
    }
  }

  if (staleResults) {
    const message = "test-results.json is older than the newest test file; rerun Vitest.";
    (requireResults ? errors : warnings).push(message);
  }

  for (const requirement of ledger.requirements ?? []) {
    const testFiles = [...(tags.get(requirement.id) ?? [])];
    const method = requirement.verificationMethod;

    if (requirement.status === "verified") {
      if (method === "automated-test") {
        if (testFiles.length === 0) {
          errors.push(
            `${requirement.id}: verified but no [${requirement.id}] tag exists in a test file.`,
          );
        }
        const vitestFiles = testFiles.filter(isVitestFile);
        const e2eFiles = testFiles.filter(isE2eFile);
        if (vitestFiles.length === 0 && e2eFiles.length > 0) {
          warnings.push(
            `${requirement.id}: verified by E2E tests only; the quality gate cannot check Playwright results.`,
          );
        }
        if (results === null) {
          if (requireResults && vitestFiles.length > 0) {
            errors.push(`${requirement.id}: no test results are available for the gate.`);
          }
        } else if (vitestFiles.length > 0) {
          const statuses = evidenceStatuses(results, requirement.id);
          if (statuses.length === 0) {
            (requireResults ? errors : warnings).push(
              `${requirement.id}: no Vitest result carries [${requirement.id}].`,
            );
          } else if (statuses.some((status) => status !== "passed")) {
            (requireResults ? errors : warnings).push(
              `${requirement.id}: ID-tagged test result is ${statuses.join("/")}.`,
            );
          }
        }
      } else if (method === "manual") {
        if (!requirement.testNotes?.trim() && !requirement.notes?.trim()) {
          errors.push(`${requirement.id}: verified manual requirement needs a test note.`);
        }
        warnings.push(`${requirement.id}: manual evidence is not machine-checked.`);
      } else if (method === "automated-check" || method === "inspection") {
        if ((requirement.implementation ?? []).length === 0) {
          errors.push(
            `${requirement.id}: verified ${method} requirement needs an implementation path.`,
          );
        }
        if (method === "automated-check") {
          warnings.push(`${requirement.id}: script evidence is not run by the traceability gate.`);
        }
      }
    }

    if (
      requirement.status === "implemented" &&
      method === "automated-test" &&
      testFiles.length === 0
    ) {
      warnings.push(`${requirement.id}: implemented without an ID-tagged test yet.`);
    }
  }

  return { errors, warnings };
}
