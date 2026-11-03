# Batch 1 review — Source safety and duplicate quarantine

Status: **verified**. Requirements: **28**. Conflicts: **5**.

This sheet is generated from `docs/traceability/requirements.json`. This batch is accepted; the matrix is the live view. New requirements start at `needs-review`.

Kinds: invariant 13, constraint 2, outcome 10, non-goal 3.

## Summary

| ID | Kind | Status | Title |
|---|---|---|---|
| ML-SAFE-001 | invariant | verified | Original files are never deleted, edited, or truncated |
| ML-SAFE-002 | invariant | verified | Only the duplicate quarantine mover may move or rename an original file |
| ML-SAFE-003 | invariant | verified | Every non-quarantine source read opens the original file read-only |
| ML-SAFE-004 | invariant | verified | The quarantine mover is the only source write path |
| ML-SAFE-005 | constraint | verified | The read-only guard fails on unreviewed write APIs |
| ML-SAFE-006 | invariant | verified | The DB worker is the only SQLite writer |
| ML-SAFE-007 | invariant | verified | No IPC contract accepts a source path for writing |
| ML-SAFE-008 | invariant | verified | The source catalog database may be written; source archive files may not |
| ML-SAFE-009 | invariant | verified | Scans exclude app-managed directories |
| ML-SAFE-010 | invariant | verified | Backups and validation read source data read-only |
| ML-QUAR-001 | outcome | verified | Duplicate groups are exact full-SHA-256 groups |
| ML-QUAR-002 | outcome | verified | The keeper is a verified backup copy first, then the oldest copy |
| ML-QUAR-003 | outcome | verified | Coverage is a preference, not an eligibility gate |
| ML-QUAR-004 | outcome | verified | The duplicates view shows KEEP/MOVE and SKIP with a reason |
| ML-QUAR-005 | outcome | verified | The confirmation states the full consequence |
| ML-QUAR-006 | outcome | verified | Progress shows moved files, bytes, current path, and cancel |
| ML-QUAR-007 | outcome | verified | Completion states the manual next steps |
| ML-QUAR-008 | invariant | verified | The mover verifies before and after the move |
| ML-QUAR-009 | invariant | verified | The mover never moves the last eligible copy |
| ML-QUAR-010 | invariant | verified | The mover skips unsafe or ambiguous candidates |
| ML-QUAR-011 | invariant | verified | Every move is auditable and the quarantine is never deleted |
| ML-QUAR-012 | outcome | verified | A move batch updates the catalog and audit state |
| ML-QUAR-013 | outcome | verified | A rescan does not report moved files as missing |
| ML-QUAR-014 | outcome | verified | Cancel, failure, and interruption leave an auditable run |
| ML-QUAR-015 | constraint | verified | The Move button is live; there is no preview-only phase |
| ML-QUAR-016 | non-goal | non-goal | No user-defined protected folders in the first release |
| ML-QUAR-017 | non-goal | non-goal | No history or restore UI in the first release |
| ML-QUAR-018 | non-goal | non-goal | No automatic quarantine removal |

## Requirements

### ML-SAFE-001 — Original files are never deleted, edited, or truncated

- **Kind:** invariant
- **Status:** verified
- **Proposed:** The app never deletes, edits, or truncates an original archive file.
- **Current / source:** The app never deletes or edits original files.
- **Sources:** `docs/product/product-specification.md#5-source-safety-guarantee`, `README.md`, `docs/release/acceptance.md`
- **ADRs:** `docs/adr/0002-whole-catalog-integrity.md`
- **Contracts:** `docs/contracts/health.md#duplicate-quarantine`
- **Existing tests:** `scripts/check-read-only.mjs`, `tests/integration/read-only-guard.test.ts`
- **Test notes:** Static read-only guard; no direct Vitest assertion yet.
- **Conflicts:** C-001
- **Notes:** This is the core promise. The quarantine exception must not weaken it.
- **Decision:** verified

### ML-SAFE-002 — Only the duplicate quarantine mover may move or rename an original file

- **Kind:** invariant
- **Status:** verified
- **Proposed:** The only operation that may move or rename an original file is the duplicate quarantine mover, after explicit confirmation. Every other source operation is read-only.
- **Current / source:** Original files are never moved, renamed, edited, or deleted.
- **Sources:** `docs/product/product-specification.md#5-source-safety-guarantee`, `docs/product/scope-and-implementation.md#53-source-safety-enforcement`, `docs/contracts/health.md#duplicate-quarantine`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md#duplicate-quarantine`
- **Existing tests:** `src/main/modules/health/infrastructure/quarantine-mover.test.ts`, `src/main/modules/health/application/cleanup-service.test.ts`
- **Test notes:** Covers the mover and the confirmed cleanup service; not yet ID-tagged.
- **Conflicts:** C-001
- **Notes:** The README, acceptance row 2, scan contract, other-files contract, and security review still state the old absolute rule.
- **Decision:** verified

### ML-SAFE-003 — Every non-quarantine source read opens the original file read-only

- **Kind:** invariant
- **Status:** verified
- **Proposed:** Scan, metadata, thumbnails, hashing, validation, media playback, and replication open source files read-only. Only the quarantine mover may open a source file for a rename.
- **Current / source:** Source files are opened with read access only, except by the quarantine mover.
- **Sources:** `docs/product/scope-and-implementation.md#53-source-safety-enforcement`, `docs/release/security-review.md`
- **ADRs:** `docs/adr/0008-replication-implementation-boundaries.md`
- **Contracts:** `docs/contracts/scan.md`, `docs/contracts/library.md`, `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/media/media-request-handler.test.ts`, `src/main/modules/media/video-proxy-command.test.ts`, `tests/integration/scan-service.test.ts`, `src/main/modules/scanning/infrastructure/quick-file-hasher.read-only.test.ts`
- **Test notes:** Candidate tests exercise the readers, but none asserts the open mode directly.
- **Conflicts:** _none_
- **Notes:** A direct open-mode assertion would make this invariant stronger than a code review.
- **Decision:** verified

### ML-SAFE-004 — The quarantine mover is the only source write path

- **Kind:** invariant
- **Status:** verified
- **Proposed:** The quarantine mover is the only source write path. It is reachable only through the confirmed cleanup operation, and every other source write is rejected by the guard.
- **Current / source:** The read-only guard allows only the quarantine mover to rename source files.
- **Sources:** `docs/contracts/health.md#duplicate-quarantine`, `docs/product/duplicate-quarantine-plan.md`, `docs/product/scope-and-implementation.md#53-source-safety-enforcement`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md#duplicate-quarantine`
- **Existing tests:** `src/main/modules/health/infrastructure/quarantine-mover.test.ts`, `src/main/modules/health/application/cleanup-service.test.ts`, `src/main/db/cleanup-db-handlers.test.ts`
- **Test notes:** Covers the mover and the cleanup handler; the static guard is separate.
- **Conflicts:** C-002
- **Notes:** The security review allowlist does not yet name the quarantine mover.
- **Decision:** verified

### ML-SAFE-005 — The read-only guard fails on unreviewed write APIs

- **Kind:** constraint
- **Status:** verified
- **Proposed:** The read-only guard fails the quality gate when a direct filesystem write API appears outside the reviewed allowlist. The allowlist names every permitted writer and is reviewed with the security review.
- **Current / source:** A static read-only guard fails the build if direct filesystem write calls appear outside the reviewed allowlist.
- **Sources:** `docs/product/scope-and-implementation.md#53-source-safety-enforcement`, `docs/release/security-review.md`
- **ADRs:** _none_
- **Contracts:** _none_
- **Existing tests:** `scripts/check-read-only.mjs`, `tests/integration/read-only-guard.test.ts`
- **Test notes:** The guard is the gate itself; it is not a Vitest test.
- **Conflicts:** C-002
- **Notes:** The guard is defense-in-depth, not the primary runtime control.
- **Decision:** verified

### ML-SAFE-006 — The DB worker is the only SQLite writer

- **Kind:** invariant
- **Status:** verified
- **Proposed:** The DB worker is the only SQLite writer for the app database and the active catalog. Main and renderer never open SQLite directly.
- **Current / source:** The DB worker is the single SQLite writer for both databases. The main process never opens SQLite directly.
- **Sources:** `docs/product/scope-and-implementation.md#51-process-model`, `docs/release/security-review.md`
- **ADRs:** `docs/adr/0008-replication-implementation-boundaries.md`
- **Contracts:** _none_
- **Existing tests:** `src/main/db/worker-protocol.test.ts`, `src/main/db/catalog-registry.test.ts`
- **Test notes:** Candidate tests cover the worker protocol and catalog registry; dependency-cruiser enforces the import boundary.
- **Conflicts:** _none_
- **Notes:** The boundary is also enforced by .dependency-cruiser.cjs.
- **Decision:** verified

### ML-SAFE-007 — No IPC contract accepts a source path for writing

- **Kind:** invariant
- **Status:** verified
- **Proposed:** No IPC contract accepts a source path for writing outside the quarantine operation. Renderer requests use catalog IDs, never arbitrary filesystem paths.
- **Current / source:** No replication IPC accepts a source path for writing.
- **Sources:** `docs/release/security-review.md`, `docs/product/scope-and-implementation.md#53-source-safety-enforcement`
- **ADRs:** `docs/adr/0008-replication-implementation-boundaries.md`
- **Contracts:** `docs/contracts/scan.md`, `docs/contracts/library.md`, `docs/contracts/health.md`, `docs/contracts/replication.md`
- **Existing tests:** `src/main/ipc/trusted-sender.test.ts`, `src/shared/contracts/health.test.ts`, `src/shared/contracts/replication/types.test.ts`, `tests/integration/source-path-safety.test.ts`
- **Test notes:** Candidate tests cover sender trust and contract shapes; no single test scans every IPC contract for source paths.
- **Conflicts:** _none_
- **Notes:** A contract-wide scan could become a traceability check later.
- **Decision:** verified

### ML-SAFE-008 — The source catalog database may be written; source archive files may not

- **Kind:** invariant
- **Status:** verified
- **Proposed:** The app writes the source archive's catalog database and app-managed caches. It does not write source archive files, except for the quarantine mover.
- **Current / source:** Source files remain unmodified; only the source archive's catalog database is written.
- **Sources:** `docs/product/partial-backups.md#14-acceptance-criteria`, `docs/release/security-review.md`
- **ADRs:** `docs/adr/0008-replication-implementation-boundaries.md`
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/db/connection.test.ts`, `src/main/db/source-index-writer.test.ts`
- **Test notes:** Candidate tests cover read-only database connections and the source index.
- **Conflicts:** C-001
- **Notes:** This is the wording that lets replication write metadata without weakening the source-file promise.
- **Decision:** verified

### ML-SAFE-009 — Scans exclude app-managed directories

- **Kind:** invariant
- **Status:** verified
- **Proposed:** Scans exclude both `.memorylane` and `.memorylane_quarantine` so app-managed data is never cataloged as archive content.
- **Current / source:** Scans exclude `.memorylane`; `.memorylane_quarantine` is also excluded.
- **Sources:** `docs/product/product-specification.md#5-source-safety-guarantee`, `docs/product/duplicate-quarantine-plan.md`, `docs/contracts/health.md#duplicate-quarantine`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/scan.md`
- **Existing tests:** `src/main/modules/scanning/infrastructure/file-enumerator.test.ts`
- **Test notes:** The enumerator test creates a quarantine folder and asserts it is skipped.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-SAFE-010 — Backups and validation read source data read-only

- **Kind:** invariant
- **Status:** verified
- **Proposed:** Backups and validation open source databases and files read-only. Backups use SQLite's online backup API, not a live file copy.
- **Current / source:** Backups open both databases read-only and use SQLite's backup API.
- **Sources:** `docs/adr/0003-scheduled-backups-and-cache.md`, `docs/release/security-review.md`
- **ADRs:** `docs/adr/0003-scheduled-backups-and-cache.md`
- **Contracts:** _none_
- **Existing tests:** `src/main/db/connection.test.ts`, `src/main/db/backup-runner.test.ts`, `tests/integration/recovery.test.ts`
- **Test notes:** Candidate tests cover the read-only connection and backup runner.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-QUAR-001 — Duplicate groups are exact full-SHA-256 groups

- **Kind:** outcome
- **Status:** verified
- **Proposed:** Duplicate groups contain only files with the same full SHA-256 and list every present copy.
- **Current / source:** Duplicate files are detected by SHA-256 and shown with all locations.
- **Sources:** `docs/product/product-specification.md#10-duplicate-detection`, `docs/contracts/health.md#duplicate-quarantine`
- **ADRs:** `docs/adr/0002-whole-catalog-integrity.md`
- **Contracts:** `docs/contracts/health.md`
- **Existing tests:** `src/main/db/repositories/health-repository.test.ts`, `src/shared/domain/duplicate-cleanup.test.ts`
- **Test notes:** Candidate tests cover exact grouping and the cleanup domain.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-QUAR-002 — The keeper is a verified backup copy first, then the oldest copy

- **Kind:** outcome
- **Status:** verified
- **Proposed:** The keeper is a verified backup copy first. If several copies are covered, the oldest covered copy wins; otherwise the oldest copy wins. Remaining tiebreakers are oldest modified, shallower and shorter path, shorter name, then lower file ID.
- **Current / source:** The keeper is a verified backup copy first. If several copies are covered, the oldest covered copy wins, then oldest modified, then shallower and shorter path, then shorter name, then lower file ID.
- **Sources:** `docs/product/duplicate-quarantine-plan.md#keeper-rule`, `docs/contracts/health.md#duplicate-quarantine`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md#duplicate-quarantine`
- **Existing tests:** `src/shared/domain/duplicate-cleanup.test.ts`, `src/main/db/repositories/health-cleanup-repository.test.ts`
- **Test notes:** Candidate tests cover the keeper comparator and covered-copy promotion.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-QUAR-003 — Coverage is a preference, not an eligibility gate

- **Kind:** outcome
- **Status:** verified
- **Proposed:** Coverage is a preference, not an eligibility gate. A group with no covered copy remains eligible and is shown with a warning that the quarantine folder is not a backup until it is copied elsewhere.
- **Current / source:** Verified backup coverage is not required. A group with no covered copy is eligible, but the confirmation and completion screens warn that the quarantine folder is not a backup until it is copied elsewhere.
- **Sources:** `docs/product/duplicate-quarantine-plan.md#eligibility`, `docs/contracts/health.md#duplicate-quarantine`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md#duplicate-quarantine`
- **Existing tests:** `src/shared/domain/duplicate-cleanup.test.ts`, `src/main/db/repositories/health-cleanup-repository.test.ts`, `src/renderer/src/features/health/HealthPage.test.tsx`, `src/main/modules/health/application/cleanup-service.test.ts`
- **Test notes:** Candidate tests cover uncovered-group eligibility and the warning UI.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-QUAR-004 — The duplicates view shows KEEP/MOVE and SKIP with a reason

- **Kind:** outcome
- **Status:** verified
- **Proposed:** The duplicates view shows KEEP and MOVE badges for eligible groups, and SKIP with the reason for every group that fails a gate.
- **Current / source:** The page shows KEEP / MOVE badges for eligible groups and SKIP plus the reason for groups that fail a gate.
- **Sources:** `docs/contracts/health.md#duplicate-quarantine`, `docs/product/duplicate-quarantine-plan.md#ux`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md#duplicate-quarantine`
- **Existing tests:** `src/renderer/src/features/health/HealthPage.test.tsx`, `tests/e2e/health.spec.ts`
- **Test notes:** Candidate component and E2E tests cover keeper badges and skip reasons.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-QUAR-005 — The confirmation states the full consequence

- **Kind:** outcome
- **Status:** verified
- **Proposed:** The confirmation shows the counts, keeper rule, quarantine path, skip rules, required acknowledgement, and how many groups have no verified backup.
- **Current / source:** The confirmation requires an explicit acknowledgement and reports how many groups have no verified backup.
- **Sources:** `docs/product/duplicate-quarantine-plan.md#ux`, `docs/contracts/health.md#duplicate-quarantine`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md#duplicate-quarantine`
- **Existing tests:** `src/renderer/src/features/health/HealthPage.test.tsx`, `tests/e2e/health.spec.ts`
- **Test notes:** Candidate tests cover the dialog and the required acknowledgement.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-QUAR-006 — Progress shows moved files, bytes, current path, and cancel

- **Kind:** outcome
- **Status:** verified
- **Proposed:** Progress shows files and bytes moved, the current path, and a cancel action that stops after the current file.
- **Current / source:** Progress shows files/bytes moved, current path, and cancel-after-current.
- **Sources:** `docs/product/duplicate-quarantine-plan.md#ux`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md#duplicate-quarantine`
- **Existing tests:** `src/main/modules/health/application/cleanup-service.test.ts`, `src/renderer/src/features/health/HealthPage.test.tsx`
- **Test notes:** Candidate tests cover progress state and cancel-after-current.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-QUAR-007 — Completion states the manual next steps

- **Kind:** outcome
- **Status:** verified
- **Proposed:** Completion shows moved and skipped totals and the manual next steps: back up the quarantine folder, remove it, and rescan.
- **Current / source:** Completion shows moved/skipped totals and the manual next steps: back up the quarantine folder, remove it, rescan.
- **Sources:** `docs/product/duplicate-quarantine-plan.md#ux`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md#duplicate-quarantine`
- **Existing tests:** `src/renderer/src/features/health/HealthPage.test.tsx`, `src/main/modules/health/application/cleanup-service.test.ts`
- **Test notes:** Candidate tests cover completion state and totals.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-QUAR-008 — The mover verifies before and after the move

- **Kind:** invariant
- **Status:** verified
- **Proposed:** The mover re-hashes the source immediately before the move and the quarantined copy immediately after. A mismatch restores the source and journals the restore; if the restore fails, the run aborts.
- **Current / source:** The mover re-checks the keeper and every candidate with full SHA-256 immediately before the same-volume move. After the move it hashes the quarantined copy again. A mismatch is moved back to the source path and journaled; if the restore fails, the run aborts.
- **Sources:** `docs/product/duplicate-quarantine-plan.md#guardrails`, `docs/contracts/health.md#duplicate-quarantine`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md#duplicate-quarantine`
- **Existing tests:** `src/main/modules/health/infrastructure/quarantine-mover.test.ts`
- **Test notes:** The mover test restores a file when the quarantined copy fails verification.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-QUAR-009 — The mover never moves the last eligible copy

- **Kind:** invariant
- **Status:** verified
- **Proposed:** The mover never moves the last eligible copy. Every group retains one keeper.
- **Current / source:** One keeper per group; never move the last copy.
- **Sources:** `docs/product/duplicate-quarantine-plan.md#guardrails`, `docs/contracts/health.md#duplicate-quarantine`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md#duplicate-quarantine`
- **Existing tests:** `src/shared/domain/duplicate-cleanup.test.ts`, `src/main/modules/health/infrastructure/quarantine-mover.test.ts`
- **Test notes:** Candidate tests cover keeper selection and the last-copy guard.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-QUAR-010 — The mover skips unsafe or ambiguous candidates

- **Kind:** invariant
- **Status:** verified
- **Proposed:** The mover skips and reports groups with active date overrides on non-keeper copies, multiple overrides, hard links, empty files, files under 1 KB, changed or missing files, outside-root paths, or cross-volume renames.
- **Current / source:** Skip groups with active date overrides on non-keeper copies, multiple overrides, hard links, empty files, files under 1 KB, changed or missing files, outside-root paths, or cross-volume renames.
- **Sources:** `docs/product/duplicate-quarantine-plan.md#eligibility`, `docs/product/duplicate-quarantine-plan.md#edge-cases`, `docs/contracts/health.md#duplicate-quarantine`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md#duplicate-quarantine`
- **Existing tests:** `src/shared/domain/duplicate-cleanup.test.ts`, `src/main/modules/health/infrastructure/quarantine-mover.test.ts`, `src/main/modules/scanning/infrastructure/file-enumerator.test.ts`
- **Test notes:** Candidate tests cover changed, missing, hard-link, and outside-root cases.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-QUAR-011 — Every move is auditable and the quarantine is never deleted

- **Kind:** invariant
- **Status:** verified
- **Proposed:** Every move writes a manifest entry, a journal line, and a `cleanup_moves` audit row. The app never deletes the quarantine folder.
- **Current / source:** Write a journal line for every move. The app never deletes the quarantine folder.
- **Sources:** `docs/product/duplicate-quarantine-plan.md#quarantine`, `docs/contracts/health.md#duplicate-quarantine`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md#duplicate-quarantine`
- **Existing tests:** `src/main/modules/health/infrastructure/quarantine-mover.test.ts`, `src/main/db/repositories/health-cleanup-repository.test.ts`, `src/main/db/migrations/catalog-cleanup-migration.test.ts`
- **Test notes:** Candidate tests cover the manifest, journal, audit rows, and migration.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-QUAR-012 — A move batch updates the catalog and audit state

- **Kind:** outcome
- **Status:** verified
- **Proposed:** After a move batch, the moved catalog rows are deleted, `cleanup_moves` keeps the audit record, duplicate groups are rebuilt, and destination adoption counters are refreshed.
- **Current / source:** Moves are applied to the catalog in batches. The moved files rows are deleted, cleanup_moves keeps the audit record, duplicate groups are rebuilt, and destination adoption counters are refreshed.
- **Sources:** `docs/contracts/health.md#duplicate-quarantine`, `docs/product/duplicate-quarantine-plan.md#quarantine`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md#duplicate-quarantine`
- **Existing tests:** `src/main/db/repositories/health-cleanup-repository.test.ts`, `src/main/modules/health/application/cleanup-service.test.ts`
- **Test notes:** Candidate tests cover row deletion, audit rows, duplicate rebuild, and counters.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-QUAR-013 — A rescan does not report moved files as missing

- **Kind:** outcome
- **Status:** verified
- **Proposed:** After a cleanup, a rescan does not report the moved files as missing because their catalog rows were removed with the move.
- **Current / source:** A rescan therefore does not treat the moved files as missing.
- **Sources:** `docs/contracts/health.md#duplicate-quarantine`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md#duplicate-quarantine`
- **Existing tests:** `src/main/modules/health/application/cleanup-service.test.ts`, `tests/integration/scan-service.test.ts`, `tests/integration/cleanup-rescan.test.ts`
- **Test notes:** Candidate tests cover catalog row deletion; no dedicated rescan-after-cleanup E2E yet.
- **Conflicts:** _none_
- **Notes:** This is a good candidate for a new integration test.
- **Decision:** verified

### ML-QUAR-014 — Cancel, failure, and interruption leave an auditable run

- **Kind:** outcome
- **Status:** verified
- **Proposed:** Cancel stops after the current file. A cancelled, failed, or interrupted run remains auditable through its journal, manifest, and cleanup run record.
- **Current / source:** Cancel stops after the current file. The run remains auditable if it is cancelled, fails, or is interrupted by an app restart.
- **Sources:** `docs/contracts/health.md#duplicate-quarantine`, `docs/product/duplicate-quarantine-plan.md#edge-cases`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md#duplicate-quarantine`
- **Existing tests:** `src/main/modules/health/application/cleanup-service.test.ts`, `src/main/db/repositories/health-cleanup-repository.test.ts`
- **Test notes:** Candidate tests cover cancel and interrupted state.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-QUAR-015 — The Move button is live; there is no preview-only phase

- **Kind:** constraint
- **Status:** verified
- **Proposed:** The Move button is live in the first release. There is no preview-only phase and no settings toggle.
- **Current / source:** The Move button is live in the first release; no read-only preview phase and no settings toggle.
- **Sources:** `docs/product/duplicate-quarantine-plan.md#decisions`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md#duplicate-quarantine`
- **Existing tests:** `src/renderer/src/features/health/HealthPage.test.tsx`, `tests/e2e/health.spec.ts`
- **Test notes:** Candidate tests cover the live button and confirmation.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-QUAR-016 — No user-defined protected folders in the first release

- **Kind:** non-goal
- **Status:** non-goal
- **Proposed:** The first release does not support user-defined protected folders. System paths `.memorylane` and `.memorylane_quarantine` are always excluded.
- **Current / source:** Scope: all eligible groups; no user-defined protected folders.
- **Sources:** `docs/product/duplicate-quarantine-plan.md#decisions`
- **ADRs:** _none_
- **Contracts:** _none_
- **Existing tests:** _none_
- **Test notes:** No test: explicit non-goal.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** non-goal

### ML-QUAR-017 — No history or restore UI in the first release

- **Kind:** non-goal
- **Status:** non-goal
- **Proposed:** The first release has no history or restore UI. Restore is a manual copy back plus a rescan.
- **Current / source:** Restore manually by copying files back and rescanning. History/restore is phase 2.
- **Sources:** `docs/product/duplicate-quarantine-plan.md#quarantine`
- **ADRs:** _none_
- **Contracts:** _none_
- **Existing tests:** _none_
- **Test notes:** No test: explicit non-goal.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** non-goal

### ML-QUAR-018 — No automatic quarantine removal

- **Kind:** non-goal
- **Status:** non-goal
- **Proposed:** The app never deletes the quarantine folder and never removes quarantine content automatically.
- **Current / source:** The app never deletes the quarantine folder. Journal and DB audit; no automatic quarantine removal.
- **Sources:** `docs/product/duplicate-quarantine-plan.md#guardrails`, `docs/contracts/health.md#duplicate-quarantine`
- **ADRs:** _none_
- **Contracts:** _none_
- **Existing tests:** _none_
- **Test notes:** No test: explicit non-goal.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** non-goal

## Conflicts

### C-001 — The read-only promise and the quarantine mover disagree

- **Severity:** high
- **Status:** accepted
- **Decision:** Adopt the product-spec wording; update README, acceptance row 2, scan.md, other-files.md, and security review; add ADR-0010.
- **Affected requirements:** ML-SAFE-002, ML-SAFE-008

**Claims**

- `README.md:7`: It never moves, renames, edits, or deletes the originals.
- `docs/release/acceptance.md:8`: Original files are never moved, renamed, edited, or deleted.
- `docs/contracts/scan.md:123`: source files are never moved or modified.
- `docs/contracts/other-files.md:37`: The app never moves, renames, edits, or deletes an original.
- `docs/release/security-review.md:55`: No module is allowed to write, rename, truncate, or delete an original archive file.

**Contradicted by**

- `docs/contracts/health.md:53`: This is the only Memory Lane action that moves archive files. It never deletes them.
- `docs/product/product-specification.md:20-22`: The single exception is the explicit duplicate quarantine, which moves only confirmed duplicate copies into X:\.memorylane_quarantine. Nothing is deleted or edited.
- `docs/product/duplicate-quarantine-plan.md:3`: Status: implemented (MVP).

**Proposed resolution:** Adopt the product-spec wording: originals are never deleted or edited; the quarantine mover is the only operation that may move an eligible duplicate copy, after explicit confirmation. Update README, acceptance row 2, scan contract, other-files contract, and security review. Add ADR-0010 for the quarantine exception.

**Recommendation:** Approve the exception and update all five stale claims. Do not remove the quarantine feature; it is implemented and tested.

### C-002 — The security review does not list the quarantine mover

- **Severity:** high
- **Status:** accepted
- **Decision:** Add a Duplicate quarantine extension section and allowlist the quarantine mover.
- **Affected requirements:** ML-SAFE-004, ML-SAFE-005

**Claims**

- `docs/release/security-review.md:45-56`: The read-only guard allowlist names catalog locks, thumbnails, HEIC previews, video proxies, cache deletion, and databases/logs/backups. It does not name the quarantine mover.

**Contradicted by**

- `docs/contracts/health.md:83-84`: Scans exclude .memorylane_quarantine; the read-only guard allows only the quarantine mover to rename source files.
- `docs/product/scope-and-implementation.md:273-275`: check-read-only.mjs fails the quality gate if direct filesystem write APIs appear outside the reviewed cache/lock/backup/quarantine allowlist.

**Proposed resolution:** Add a 'Duplicate quarantine extension' section to the security review. Name the quarantine mover in the allowlist, state the re-hash/restore guardrail, and confirm the source is read-only outside that adapter.

**Recommendation:** Approve and update the security review before the next release sign-off.

### C-003 — The quarantine feature is implemented but not indexed or accepted

- **Severity:** medium
- **Status:** accepted
- **Decision:** Add ADR-0010, docs index entries, the README docs table, roadmap state, and a post-v0.1 acceptance section.
- **Affected requirements:** ML-QUAR-001, ML-QUAR-015

**Claims**

- `docs/product/duplicate-quarantine-plan.md:3`: Status: implemented (MVP).

**Contradicted by**

- `docs/README.md`: The docs index does not list duplicate-quarantine-plan.md.
- `README.md:328-349`: The README documentation table does not list the quarantine plan.
- `docs/adr/README.md`: There is no ADR-0010 for the quarantine exception.
- `docs/product/roadmap.md`: The roadmap does not mention duplicate quarantine.
- `docs/release/acceptance.md`: The acceptance criteria do not include quarantine.

**Proposed resolution:** Add the plan to docs/README.md and the README docs table; add it to the roadmap's delivered state; add ADR-0010; add quarantine acceptance rows; link the plan from the health contract.

**Recommendation:** Approve the documentation set before calling the feature implemented in the release record.

### C-004 — Catalog schema version references disagree

- **Severity:** medium
- **Status:** accepted
- **Decision:** Update scan.md and settings.md to schema 12; add a docs check that reads the migration folder.
- **Affected requirements:** _none_

**Claims**

- `docs/contracts/health.md:178`: Catalog schema version: 12.
- `docs/contracts/scan.md:162`: The current catalog schema version is 9.
- `docs/contracts/settings.md:63`: catalog schema is version 6 after the video-frame-rate and ...

**Contradicted by**

- `src/main/db/migrations/catalog`: The latest migration is 0012-cleanup-coverage.sql.

**Proposed resolution:** Update scan.md and settings.md to the current schema version (12). Add a docs check that reads the migration folder and fails on a stale reference.

**Recommendation:** Fix the two stale references now; add the automated check in the traceability script.

### C-005 — Published test counts disagree with the tree

- **Severity:** low
- **Status:** accepted
- **Decision:** Remove exact counts from prose; link to the generated traceability matrix.
- **Affected requirements:** _none_

**Claims**

- `README.md, docs/product/scope-and-implementation.md, docs/product/roadmap.md`: 545 tests across 137 files.

**Contradicted by**

- `committed tree`: 551 test declarations across 138 unit/integration files.
- `current working tree`: 579 test declarations across 144 files.

**Proposed resolution:** Generate the counts from the test run and update the docs, or remove the exact counts from prose and link to the test report.

**Recommendation:** Remove hand-written counts from prose; publish a generated count in the traceability matrix.

## Approval

This batch is approved. For future batches, either:

1. change `status` to `accepted` and keep the proposed text;
2. edit `proposedText` in the JSON and keep `needs-review`; or
3. change `status` to `non-goal` if the item is out of scope.

Do not mark a requirement `verified` until at least one test carries its ID and the test result is green.
