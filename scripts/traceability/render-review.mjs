import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, relative } from "./lib/context.mjs";
import { readJson, writeText } from "./lib/io.mjs";
import { collectTags, validateLedger, validateReferences, verifyEvidence } from "./lib/ledger.mjs";
import { extractResults, loadResults, resultsAreStale } from "./lib/results.mjs";
import { renderConflicts, renderMatrix, renderReview } from "./lib/render.mjs";

async function validateDocs(context) {
  const errors = [];
  const migrations = (await readdir(context.migrationsDir)).filter((file) =>
    /^\d{4}-.*\.sql$/.test(file),
  );
  const latestMigration = Math.max(...migrations.map((file) => Number(file.slice(0, 4))));

  for (const file of (await readdir(context.contractsDir)).filter((item) => item.endsWith(".md"))) {
    const text = await readFile(path.join(context.contractsDir, file), "utf8");
    const pattern =
      /(?:Catalog schema version:|current catalog schema version is|catalog schema is version)\s*(\d+)/gi;
    for (const match of text.matchAll(pattern)) {
      if (Number(match[1]) !== latestMigration) {
        errors.push(
          `docs/contracts/${file}: schema version ${match[1]} does not match migration ${latestMigration}.`,
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
    const text = await readFile(path.join(context.root, relPath), "utf8");
    if (/\b\d+\s+(?:[a-z/-]+\s+){0,4}tests?\s+across\s+\d+\s+files\b/i.test(text)) {
      errors.push(
        `${relPath}: contains a hand-written test count; link to docs/traceability/matrix.md instead.`,
      );
    }
  }

  const traceabilityReadme = await readFile(
    path.join(context.docsDir, "traceability", "README.md"),
    "utf8",
  );
  if (/\b\d{2,}\s+(?:automated\s+)?tests?\b(?!\s+files)/i.test(traceabilityReadme)) {
    errors.push(
      "docs/traceability/README.md: contains a hand-written test count; the matrix is the source.",
    );
  }

  const docsIndex = await readFile(context.docsIndexPath, "utf8");
  for (const required of ["product/duplicate-quarantine-plan.md", "traceability/README.md"]) {
    if (!docsIndex.includes(required)) {
      errors.push(`docs/README.md: missing ${required}.`);
    }
  }

  const adrIndex = await readFile(context.adrIndexPath, "utf8");
  const adrFiles = (await readdir(context.adrDir)).filter((file) => /^\d{4}-.*\.md$/.test(file));
  for (const file of adrFiles) {
    if (!adrIndex.includes(file)) {
      errors.push(`docs/adr/README.md: missing ${file}.`);
    }
  }

  return errors;
}

function printList(label, values, write = console.log) {
  if (values.length === 0) {
    return;
  }
  write(label);
  for (const value of values.slice(0, 25)) {
    write(`  - ${value}`);
  }
  if (values.length > 25) {
    write(`  ... and ${values.length - 25} more.`);
  }
}

export async function run({ root = process.cwd(), argv = process.argv.slice(2) } = {}) {
  const check = argv.includes("--check");
  const requireResults = argv.includes("--require-results");
  const context = createContext(root);
  const ledger = await readJson(context.ledgerPath);

  const validation = validateLedger(ledger);
  const referenceErrors =
    validation.errors.length === 0 ? await validateReferences(ledger, context) : [];
  const tagResult = await collectTags(context);
  const rawResults = await loadResults(context);
  const staleResults = rawResults
    ? await resultsAreStale(context, rawResults, tagResult.testFiles)
    : false;
  const results = rawResults !== null && !staleResults ? extractResults(rawResults) : null;
  const evidence = verifyEvidence(ledger, tagResult.tags, results, {
    requireResults,
    staleResults,
  });
  const docsErrors = await validateDocs(context);

  const errors = [
    ...validation.errors,
    ...referenceErrors,
    ...tagResult.warnings,
    ...evidence.errors,
    ...docsErrors,
  ];
  const warnings = [...validation.warnings, ...evidence.warnings];

  if (!check && validation.errors.length === 0) {
    for (const batch of (ledger.batches ?? []).filter((item) => item.reviewSheet)) {
      const reviewPath = path.join(root, batch.reviewSheet);
      await writeText(reviewPath, renderReview(ledger, batch, tagResult.tags));
      console.log(`Wrote ${relative(context, reviewPath)}`);
    }
    await writeText(context.conflictsPath, renderConflicts(ledger));
    await writeText(context.matrixPath, renderMatrix(ledger, tagResult.tags, results));
    console.log(`Wrote ${relative(context, context.conflictsPath)}`);
    console.log(`Wrote ${relative(context, context.matrixPath)}`);
  }

  printList("Traceability validation failed:", errors, console.error);
  printList("Traceability warnings:", warnings);
  console.log(
    `Requirements: ${ledger.requirements.length}; conflicts: ${ledger.conflicts.length}; ` +
      `errors: ${errors.length}; warnings: ${warnings.length}.`,
  );

  return errors.length > 0 ? 1 : 0;
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();

if (isMain) {
  process.exitCode = await run();
}
