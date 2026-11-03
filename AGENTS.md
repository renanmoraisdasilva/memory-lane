# Memory Lane - agent guide

This file adds repo-specific rules. When the repository is used inside the
workspace, the workspace `../AGENTS.md` and `../ENGINEERING-STANDARD.md` also
apply.

## What this is

Memory Lane is a local-first Electron archive catalog for Windows. It indexes
external drives without modifying originals, with one narrow exception: the
explicit, confirmed duplicate-quarantine mover.

Read first:

- `README.md`
- `docs/product/scope-and-implementation.md`
- `docs/contracts/`
- `docs/adr/`
- `docs/traceability/README.md`
- `ui-mockups/` for UI work

## Source safety

- Originals may be moved only by the duplicate-quarantine mover, only into
  `<drive>\.memorylane_quarantine\`.
- Scan, metadata, thumbnails, hashing, validation, media playback, and
  replication open source files read-only.
- Never delete, edit, or rename an original outside the quarantine mover.
- Scans exclude `.memorylane` and `.memorylane_quarantine`.
- `scripts/check-read-only.mjs` is the static guard. Keep the allowlist narrow.
- A new source-write path needs an ADR and explicit approval before code.

## Architecture boundaries

- `src/main/` is Electron main and application services. It does not open SQLite
  directly for normal app work.
- `src/main/workers/db-worker.ts` and `src/main/db/` are the only SQLite writer.
- `src/preload/` exposes only the typed, validated bridge.
- `src/renderer/` has no Node, Electron, or filesystem access.
- `src/shared/contracts/` is the Zod contract source of truth. Do not hand-edit
  generated API types.
- Database migrations are append-only. Add a new migration, bump
  `CATALOG_SCHEMA_VERSION`, and add a migration test. Never edit an applied
  migration.
- One-off catalog recovery scripts are exceptions: ask first, close the app,
  back up the catalog, and report exactly what was changed.

## Traceability

Traceability is the map from requirements to sources, contracts, ADRs, tests,
and results. The ledger is `docs/traceability/requirements.json`.

Rules:

- Requirements have stable IDs such as `ML-HEALTH-008`. Never reuse or rename an
  ID.
- When behavior changes, update the existing requirement's text, sources,
  contracts, tests, and test notes. Add a new ID only for new scope.
- Mark replaced requirements `superseded`; do not delete the old ID.
- Tag at least one proving test with the requirement ID in the test name, for
  example:
  `it("[ML-HEALTH-008] orders disregarded files newest first and pages them", ...)`.
- A requirement is `verified` only when the ID-tagged test passes. `implemented`
  means code and a candidate test exist. New requirements start at
  `needs-review`.
- `requirements.json` is the source. `reviews/*`, `matrix.md`, and `conflicts.md`
  are generated; do not hand-edit them.
- After changing the ledger:

  ```powershell
  npm run traceability:review
  npm run traceability:check
  ```

- `npm run check` includes the traceability check, and CI blocks on it.
- Keep the ledger to product requirements and durable invariants, not every
  implementation detail.

## UI and mockups

- Any new screen, flow, navigation, layout, or empty/loading/error/success/
  disabled state gets a static HTML mockup in `ui-mockups/` first.
- Mockups open from `file://`, use the shared shell/tokens, use fake data, and
  show the relevant responsive and accessibility states.
- A one-button, label, copy, or spacing fix is exempt.
- Implement the approved mockup; screenshots in docs come from the running app.

## Quality gates

Run the narrowest useful checks first, then the full gates before release:

```powershell
npm run check
npm run test:coverage
npm run test:e2e
```

- Tests should prove behavior, not implementation. Use a real SQLite database
  for persistence, temp directories for file operations, fake external
  providers, and failure paths. Do not use sleeps.
- The native `better-sqlite3` build must match the runtime: Node for Vitest,
  Electron for E2E and packaging. Use the repo rebuild scripts; do not mix ABIs.
- If Node 20 throws `ERR_REQUIRE_ESM` for `exiftool-vendored`, run Vitest and
  Playwright with Node 22.

## Release

- Do not rebuild `release/win-unpacked` while Memory Lane is running.
- Use `npm run package:unpacked`, then:

  ```powershell
  npm run verify:package
  npm run smoke:packaged
  ```

- Commit messages are one line. Do not push unless explicitly asked.
- Before committing, review staged paths and confirm no `.env`, database, key,
  token, or credential is included.
