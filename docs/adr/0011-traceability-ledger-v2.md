# 0011 - Traceability ledger v2

- Status: Accepted
- Date: 2026-11-03

## Context

The first traceability ledger stored a hand-written test file list on every
requirement. That list and the `[ML-...]` tags in test names were two sources of
truth, and they drifted. An audit found 12 requirements marked `verified` whose
listed test files contained no ID tag; the proving test existed, but somewhere
else. The gate could not see the difference because it only checked that each
listed file existed.

The ledger also carried `currentText` and `proposedText` on every requirement.
After a batch was accepted, the two wordings competed for authority. The
verification method was implicit, so a manual release pass and a passing
automated test looked the same in the matrix. The matrix read tags from test
results while the ledger kept its own list, so the two views could disagree
silently.

## Decision

Make the ledger a requirement catalog, not a link database.

- **Test links are derived.** A test proves a requirement only when its name
  carries `[ML-...]`. The ledger does not store `tests`. The review sheets and
  matrix are generated from the tags.
- **One authoritative text.** `text` is the approved requirement. `sourceText`
  keeps the original source wording only when it differs, for audit history.
- **Verification is explicit.** Every `verified` or `implemented` requirement
  declares one method:
  - `automated-test`: a Vitest or Playwright test carries the ID;
  - `automated-check`: a guard, smoke, or packaging script proves it;
  - `manual`: a human release pass is the final evidence;
  - `inspection`: a static or document review is the final evidence.
- **Critical invariants name their implementation.** An optional
  `implementation` list records the code or guard paths behind durable
  invariants, so a moved or deleted guard fails the gate.
- **The gate checks evidence, not shape.** It rejects orphan tags, missing
  paths and anchors, a `verified` automated requirement without an ID-tagged
  test, and (in CI) a `verified` requirement without a passing result in fresh
  test output.
- **CI runs tests before the gate.** The quality job writes
  `docs/traceability/test-results.json`, runs `traceability:check
  --require-results`, then fails if the generated matrix or review sheets differ
  from the committed files.
- **Impact analysis is a command.** `npm run trace:impact -- <paths>` maps
  changed files to requirements and the tests to run.

## Alternatives

- **Keep the hand lists and check that each tag exists in them.** Rejected: it
  preserves two sources of truth and requires a manual sync after every test
  move.
- **Generate a separate `links.json` from tags.** Rejected: one more generated
  artifact to review and commit; the matrix already renders the same links.
- **Require Playwright results in the same gate.** Rejected for now: the
  quality job does not run Electron. E2E-only evidence is labeled `e2e` and is
  verified in the electron job.
- **Keep `currentText` and `proposedText`.** Rejected: after approval, the
  distinction is history, not a live requirement. Git holds the history.
- **Treat all tests as equal evidence.** Rejected: a manual real-drive pass and
  a passing unit test should not render the same way.

## Consequences

- Renaming a test must keep its ID; removing the tag removes the proof and the
  gate fails.
- A test tag is now a contract, not a decorative label.
- Manual evidence is explicit and cannot be mistaken for a passing automated
  test.
- `test-results.json` stays gitignored; CI generates it fresh and the matrix is
  regenerated before the staleness check.
- Adding a requirement no longer requires listing test files, only tagging the
  test that proves it.
