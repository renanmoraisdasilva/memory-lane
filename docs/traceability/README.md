# Traceability

This directory links requirements to the tests that prove them. Batches 1-9 are
accepted; batch 9 is implemented with partial and deferred requirements. The
ledger and matrix are the live view. The check is blocking in CI and part of
`npm run check`.

## Files

| File | Purpose |
|---|---|
| `requirements.json` | The ledger: stable requirement IDs, proposed wording, sources, existing tests, status, and conflicts. |
| `reviews/01-source-safety.md` | Batch 1 review sheet, generated from the ledger. |
| `reviews/02-scan-library.md` | Batch 2 review sheet, generated from the ledger. |
| `reviews/03-health.md` | Batch 3 review sheet, generated from the ledger. |
| `reviews/04-replication-core.md` | Batch 4 review sheet, generated from the ledger. |
| `reviews/05-replication-planning.md` | Batch 5 review sheet, generated from the ledger. |
| `reviews/06-replication-runs.md` | Batch 6 review sheet, generated from the ledger. |
| `reviews/07-replication-safety.md` | Batch 7 review sheet, generated from the ledger. |
| `reviews/08-video-settings.md` | Batch 8 review sheet, generated from the ledger. |
| `reviews/09-release.md` | Batch 9 review sheet, generated from the ledger. |
| `conflicts.md` | Open contradictions and proposed resolutions, generated from the ledger. |
| `matrix.md` | Requirement → test file → result view, generated from the ledger. |
| `test-results.json` | Optional Vitest JSON output. When present, `matrix.md` shows pass/fail per requirement. |

## Current batches

Batch 1 covers **source safety and duplicate quarantine**: 28 requirements and
5 conflicts. It is `verified`: 25 requirements have passing ID-tagged tests and
3 are explicit non-goals.

The read-only conflict is resolved. README, acceptance row 2, scan contract,
other-files contract, and security review now use the canonical wording:
originals are never deleted or edited; only the confirmed quarantine mover may
move an eligible duplicate copy. ADR-0010 records the exception, and
`conflicts.md` keeps the decision record.

Batch 2 covers **scan and library**: 24 requirements and 0 conflicts. It is
`verified`: all 24 requirements have passing ID-tagged tests.

Batch 3 covers **health and validation**: 25 requirements and 0 conflicts. It is
`implemented`: 24 requirements have passing ID-tagged tests; ML-HEALTH-025
(catalog-changing actions refresh affected views) remains implemented because its
test covers the duplicate-cleanup dialog but not every affected view.

Batch 4 covers **replication: schema, adoption, and coverage**: 26 requirements
and 1 conflict. It is `implemented`: 24 requirements have passing ID-tagged
tests. ML-REPL-015 (letter-change resolution) and ML-REPL-026 (adoption restart
recovery) remain implemented because their tests cover only part of the
behavior. C-006 is resolved: R-01 now says the current catalog schema.

Batch 5 covers **replication: coverage and planning**: 26 requirements and 0
conflicts. It is `implemented`: 20 requirements have passing ID-tagged tests.
ML-REPL-028, 042, 043, 044, 047, and 050 remain implemented because their tests
cover only part of the behavior; ML-REPL-047 has no test at all.

Batch 6 covers **replication: run controls and failures**: 15 requirements and 0
conflicts. It is `implemented`: 11 requirements have passing ID-tagged tests.
ML-REPL-059, 060, 063, and 064 remain implemented because there is no test for
run reachability, running-state edit locks, replan recopy behavior, or queued
destination addition.

Batch 7 covers **replication: copy, promotion, and safety**: 26 requirements and
0 conflicts. It is `implemented`: 17 requirements have passing ID-tagged tests.
ML-REPL-072, 073, 074, 075, 077, 078, 081, 087, and 093 remain implemented
because their tests cover only part of the behavior; 072, 075, 078, and 093
have no ID-tagged test at all.

Batch 8 covers **video playback and settings/backups**: 26 requirements and 1
conflict. It is `implemented`: 14 requirements have passing ID-tagged tests and
1 is a non-goal. ML-VIDEO-002, 003, 005, 006, 009, and 010 and ML-SET-003, 007,
010, 011, and 014 remain implemented because their tests cover only part of the
behavior; ML-VIDEO-002, 003, 005, and 010 and ML-SET-003 and 007 have no
ID-tagged Vitest test. C-007 is resolved: the product spec now names both
SQLite databases.

Batch 9 covers **release acceptance criteria**: 18 requirements and 0 conflicts.
It is `implemented`: 7 requirements are verified, 10 remain implemented because
their automated evidence is green but a real-drive, clean-VM, packaging, or
mixed-corpus pass is still manual, and ML-REL-017 is deferred because the clean
Windows VM release pass is manual only.

## Workflow

1. Read the review sheet for the batch you are working on.
2. For a new batch, inventory each requirement as `needs-review`.
3. Edit `requirements.json` directly:
   - change `status` from `needs-review` to `accepted` or `non-goal`;
   - edit `proposedText` if the wording needs work;
   - add review notes in `notes`.
4. Regenerate the review sheet:

   ```powershell
   npm run traceability:review
   ```

5. After the batch is approved, add `[ML-...]` IDs to the test names that prove
   each requirement.
6. Run the tests with the JSON reporter and regenerate the matrix:

   ```powershell
   npx vitest run --reporter=json --outputFile=docs/traceability/test-results.json
   npm run traceability:review
   ```

7. The check is blocking in CI and part of `npm run check`.
   `npm run traceability:check` exits non-zero on malformed IDs, missing
   sources, missing test files, unknown statuses, or a `verified` requirement
   without a test.

## Status values

| Status | Meaning |
|---|---|
| `needs-review` | The requirement is inventoried but the wording is not approved. |
| `accepted` | The wording is approved; implementation or tests may still be missing. |
| `implemented` | Code exists and the requirement has at least one candidate test. |
| `verified` | The requirement has a test carrying its ID and the test is green. |
| `superseded` | A later requirement replaced this one; keep the old ID for history. |
| `non-goal` | Explicitly out of scope; no test required. |
| `deferred` | Deliberately postponed; no test required yet. |

## ID scheme

IDs are stable and capability-scoped:

- `ML-SAFE-*` — source safety and read-only invariants.
- `ML-QUAR-*` — duplicate quarantine.
- `ML-SCAN-*`, `ML-LIB-*`, `ML-HEALTH-*`, `ML-REPL-*` — scan, library, health,
  and replication.
- `ML-VIDEO-*` — video playback and HEIC previews.
- `ML-SET-*` — settings, cache, and backups.
- `ML-REL-*` — release acceptance criteria.

The replication matrix keeps `R-01`…`R-91` as legacy aliases when it is
migrated.

## What the first batch found

- The read-only promise and the quarantine mover disagreed across five documents.
- The security review allowlist did not name the quarantine mover.
- The cleanup-then-rescan test exposed a missing `rebuildDuplicateGroups` import
  in `health-cleanup-repository.ts`; cleanup runs failed after moving files until
  it was fixed.
- Catalog schema references were 12, 9, and 6; the current migration is 0012.
- Published test counts were stale; the matrix is now the source for requirement
  coverage and test counts.

## What is not done yet

- The gate validates ledger structure and test-file existence; it does not
  rerun tests. The matrix shows pass/fail only when `test-results.json` is
  present.
- Batch 9 is implemented; the manual release checklist items remain.
- The full Vitest run is 595 tests. The matrix is generated from
  `test-results.json`.
