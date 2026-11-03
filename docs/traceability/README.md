# Traceability

This directory maps requirements to their sources, decisions, implementation,
and tests. The ledger is `requirements.json`; the review sheets, matrix, and
conflicts view are generated from it. `npm run check` validates the ledger, and
CI blocks on the same gate.

## Files

| File | Purpose |
|---|---|
| `requirements.json` | The ledger: stable requirement IDs, text, sources, decisions, implementation, verification method, status, and conflicts. |
| `reviews/01-source-safety.md` | Batch 1 review sheet, generated from the ledger. |
| `reviews/02-scan-library.md` | Batch 2 review sheet, generated from the ledger. |
| `reviews/03-health.md` | Batch 3 review sheet, generated from the ledger. |
| `reviews/04-replication-core.md` | Batch 4 review sheet, generated from the ledger. |
| `reviews/05-replication-planning.md` | Batch 5 review sheet, generated from the ledger. |
| `reviews/06-replication-runs.md` | Batch 6 review sheet, generated from the ledger. |
| `reviews/07-replication-safety.md` | Batch 7 review sheet, generated from the ledger. |
| `reviews/08-video-settings.md` | Batch 8 review sheet, generated from the ledger. |
| `reviews/09-release.md` | Batch 9 review sheet, generated from the ledger. |
| `conflicts.md` | Decisions that reconciled contradictory sources, generated from the ledger. |
| `matrix.md` | Requirement to test to result view, generated from the ledger. |
| `test-results.json` | Optional Vitest JSON output. Gitignored; the matrix shows pass/fail only when it exists and is fresh. |

## Ledger schema

Each requirement has:

- `id`: stable ID such as `ML-HEALTH-008`. Never reuse or rename it.
- `batch`, `capability`, `kind`, `title`.
- `text`: the authoritative requirement.
- `sourceText`: optional original source wording, kept only when it differs.
- `sources`, `adrs`, `contracts`: document links, including `#anchors`.
- `implementation`: optional code, directory, or guard paths for durable
  invariants.
- `verificationMethod`: `automated-test`, `automated-check`, `manual`, or
  `inspection`.
- `testNotes`: what the evidence covers and what remains.
- `status`: see below.
- `conflictsWith`, `notes`.

The ledger does **not** store test paths. A test proves a requirement only when
its name contains `[ML-...]`. The review sheets and matrix derive the links from
the tags.

## Status values

| Status | Meaning |
|---|---|
| `needs-review` | The requirement is inventoried but the wording is not approved. |
| `accepted` | The wording is approved; implementation or evidence may still be missing. |
| `implemented` | Code exists and the requirement has a candidate test or recorded evidence. |
| `verified` | The verification method is satisfied: a tagged test passes, or the manual, inspection, or script evidence is recorded. |
| `superseded` | A later requirement replaced this one; keep the old ID for history. |
| `non-goal` | Explicitly out of scope; no test required. |
| `deferred` | Deliberately postponed; no test required yet. |

## Verification methods

| Method | Evidence |
|---|---|
| `automated-test` | A Vitest or Playwright test name carries the requirement ID. |
| `automated-check` | A guard, smoke, or packaging script proves it; `implementation` names the script or code. |
| `manual` | A human release pass is the final evidence; `testNotes` records what was done. |
| `inspection` | A static or document review is the final evidence; `implementation` names the reviewed path. |

## Workflow

1. Add or edit a requirement in `requirements.json`. New IDs start at
   `needs-review`.
2. Approve the text and change the status to `accepted`.
3. Tag the proving test with the requirement ID, for example:
   `it("[ML-HEALTH-008] orders disregarded files newest first", ...)`.
4. For `automated-check`, `manual`, or `inspection`, record the implementation
   path or the test note that proves the method.
5. Change the status to `implemented` when code exists, and to `verified` only
   when the method is satisfied.
6. Regenerate the review sheets and matrix:

   ```powershell
   npm run traceability:review
   ```

7. Validate the ledger:

   ```powershell
   npm run traceability:check
   ```

8. To check evidence locally, produce fresh results first:

   ```powershell
   npm run test:traceability
   npm run traceability:check -- --require-results
   ```

9. In CI, the tests run before the gate and `--require-results` is always on.

## Commands

| Command | Purpose |
|---|---|
| `npm run traceability:review` | Regenerate the review sheets, matrix, and conflicts view. |
| `npm run traceability:check` | Validate the ledger, links, tags, and docs without requiring fresh results. |
| `npm run test:traceability` | Run Vitest with the JSON reporter for the evidence gate. |
| `npm run traceability:check -- --require-results` | Validate with fresh results; fail on missing, stale, or failing evidence. |
| `npm run trace:impact -- <paths>` | Map changed files to affected requirements and tests. |
| `npm run trace:impact -- --staged` | Use staged files instead of explicit paths. |
| `npm run trace:impact -- --since HEAD~1` | Use files changed since a git ref. |
| `npm run trace:impact -- --json <paths>` | Print the same mapping as JSON. |

`traceability:check` never rewrites the generated files. Run
`traceability:review` after changing the ledger, then commit the regenerated
review sheets, matrix, and conflicts view.

## What the gate checks

Errors:

- malformed, duplicate, or missing requirement IDs and required fields;
- unknown statuses, kinds, batches, conflicts, or verification methods;
- missing source, ADR, or contract files, and missing heading anchors;
- missing `implementation` paths;
- ID tags in non-test files, or tags that no requirement uses;
- a `verified` automated requirement without an ID-tagged test;
- a `verified` manual requirement without a test note;
- a `verified` script or inspection requirement without an implementation path;
- with `--require-results`: missing, stale, or failing Vitest evidence;
- schema-version drift in contracts, hand-written test counts, and unindexed
  ADRs.

Warnings:

- an `implemented` automated requirement without a tag yet;
- E2E-only evidence, because the quality job does not run Electron;
- script or manual evidence, because it is not executed by this gate;
- stale results outside `--require-results`.

## Impact analysis

Traceability is useful when it answers a coding question: what does this change
touch?

```powershell
npm run trace:impact -- src/main/db/repositories/health-missing-repository.ts
npm run trace:impact -- --staged
npm run trace:impact -- --since HEAD~1
```

The command matches changed paths against `sources`, `adrs`, `contracts`,
`implementation`, and the test files that carry each requirement ID. It prints
the affected requirements, their status and method, the test files to run, and
a ready-to-run Vitest command.

## CI

The quality job:

1. runs `npm run test:coverage` with the default and JSON reporters;
2. runs `npm run traceability:check -- --require-results`;
3. fails if `git diff --exit-code docs/traceability` finds a stale generated
   file;
4. uploads the matrix, review sheets, conflicts, and coverage.

The Electron job runs Playwright separately. E2E-only evidence is labeled `e2e`
in the matrix; the quality gate does not mark it `verified` on its own.

## What the gate does not do

- It does not judge whether a test fully proves a requirement. The tag says the
  test is the evidence; the review notes say whether it is sufficient.
- It does not run Playwright, `automated-check` scripts, or the manual release
  checklist. Those run in their own CI steps or by hand.
- It does not track requirement-to-requirement dependencies. Add them only if
  impact analysis needs them.

## Batches

Batches 1 through 9 are accepted. Each review sheet is generated from the
ledger and shows the current status, verification method, derived proving
tests, and conflicts for that batch.
