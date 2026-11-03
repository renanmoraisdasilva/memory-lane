# Batch 3 review — Health and validation

Status: **implemented**. Requirements: **25**. Conflicts: **0**.

This sheet is generated from `docs/traceability/requirements.json`. This batch is accepted; the matrix is the live view. New requirements start at `needs-review`.

Kinds: outcome 19, invariant 5, constraint 1.

Verification: automated-test 25.

## Summary

| ID | Kind | Status | Verification | Title |
|---|---|---|---|---|
| ML-HEALTH-001 | outcome | verified | automated-test | Health summary reports duplicates, missing, moved, and validation state |
| ML-HEALTH-002 | invariant | verified | automated-test | Duplicate detection uses exact full SHA-256 only |
| ML-HEALTH-003 | outcome | verified | automated-test | Duplicate groups list every copy with its context |
| ML-HEALTH-004 | outcome | verified | automated-test | Duplicate groups are ordered by total bytes |
| ML-HEALTH-005 | invariant | verified | automated-test | Duplicate groups are rebuilt after catalog changes |
| ML-HEALTH-006 | invariant | verified | automated-test | Missing files stay cataloged |
| ML-HEALTH-007 | outcome | verified | automated-test | Missing files can be disregarded and restored |
| ML-HEALTH-008 | outcome | verified | automated-test | Missing lists page and select across the full result |
| ML-HEALTH-009 | outcome | verified | automated-test | Moved candidates are paginated and batch-confirmed |
| ML-HEALTH-010 | outcome | verified | automated-test | Confirming a move rechecks and updates the catalog |
| ML-HEALTH-011 | outcome | verified | automated-test | Dismissing a move keeps the file missing |
| ML-HEALTH-012 | invariant | verified | automated-test | Missing-duplicate cleanup removes catalog rows only |
| ML-HEALTH-013 | outcome | verified | automated-test | Missing-duplicate preview reports risk and pending moves |
| ML-HEALTH-014 | outcome | verified | automated-test | Validation has independently selectable levels |
| ML-HEALTH-015 | outcome | verified | automated-test | Validation covers the whole catalog and stores per-file results |
| ML-HEALTH-016 | outcome | verified | automated-test | Hash validation records mismatches and updates the stored hash |
| ML-HEALTH-017 | outcome | verified | automated-test | Metadata refresh preserves manual date overrides |
| ML-HEALTH-018 | outcome | verified | automated-test | Validation marks missing files without deleting them |
| ML-HEALTH-019 | outcome | verified | automated-test | Validation pauses, resumes, and recovers |
| ML-HEALTH-020 | outcome | verified | automated-test | Validation reports every outcome |
| ML-HEALTH-021 | invariant | verified | automated-test | Health actions never change original files |
| ML-HEALTH-022 | outcome | verified | automated-test | Health UI exposes Missing, Duplicates, and Validation tabs |
| ML-HEALTH-023 | constraint | verified | automated-test | Validation is exclusive with scan and cleanup |
| ML-HEALTH-024 | outcome | verified | automated-test | Scan completion surfaces missing-duplicate cleanup |
| ML-HEALTH-025 | outcome | implemented | automated-test | Catalog-changing actions refresh affected views |

## Requirements

### ML-HEALTH-001 — Health summary reports duplicates, missing, moved, and validation state

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Text:** The health summary reports duplicate groups, missing files, moved candidates, missing duplicates, and the current validation state in one place.
- **Source text:** HealthSummary covers duplicate groups, missing files, moved candidates, and validation state.
- **Sources:** `docs/contracts/health.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/health-db-handlers.test.ts`, `src/main/db/repositories/health-repository.test.ts`, `src/main/modules/health/application/health-service.test.ts`
- **Test notes:** Tests cover the summary and handlers.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-HEALTH-002 — Duplicate detection uses exact full SHA-256 only

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Text:** Duplicate groups contain only files with the same full SHA-256. A sampled quick fingerprint is never duplicate evidence; a large file is fully hashed when another present or fully hashed missing file shares its size.
- **Source text:** Exact SHA-256 duplicates across all present catalog files; sampled quick fingerprints are never duplicate evidence.
- **Sources:** `docs/product/product-specification.md#10-duplicate-detection`, `docs/contracts/health.md`
- **ADRs:** `docs/adr/0002-whole-catalog-integrity.md`
- **Contracts:** `docs/contracts/health.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/repositories/health-repository.test.ts`, `src/main/db/repositories/scan-stage-repository.test.ts`
- **Test notes:** Tests cover exact grouping and full-hash promotion.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-HEALTH-003 — Duplicate groups list every copy with its context

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Text:** Every duplicate group lists each present copy with path, folder, media metadata, date, thumbnail, missing state, filesystem timestamps, verified-backup state, and active date-override state.
- **Source text:** Each HealthFile includes path, folder, media metadata, date, thumbnail URL, missing state, duplicate state, filesystem timestamps, verified-backup state, and active date-override state.
- **Sources:** `docs/contracts/health.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/repositories/health-repository.test.ts`
- **Test notes:** Tests cover group members and UI badges.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-HEALTH-004 — Duplicate groups are ordered by total bytes

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Text:** Duplicate groups are ordered by total bytes descending, then group id. Page totals include the excess bytes for every eligible group.
- **Source text:** Group ordering is total bytes descending, then group id; page totals include excess bytes for eligible groups.
- **Sources:** `docs/contracts/health.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/repositories/health-repository.test.ts`
- **Test notes:** Tests cover ordering and excess totals.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-HEALTH-005 — Duplicate groups are rebuilt after catalog changes

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Text:** Duplicate groups are rebuilt after scan finalize, after validation completes, and after catalog changes that can affect duplicates. Quick fingerprints never enter the group.
- **Source text:** duplicate_groups and duplicate_members are rebuilt after scan finalize, on duplicate query, and after validation completes.
- **Sources:** `docs/contracts/health.md`
- **ADRs:** `docs/adr/0002-whole-catalog-integrity.md`
- **Contracts:** `docs/contracts/health.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/repositories/health-repository.test.ts`
- **Test notes:** Tests cover rebuild points.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-HEALTH-006 — Missing files stay cataloged

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Text:** A file missing from its recorded path is marked missing and stays in the catalog. It is never removed automatically.
- **Source text:** Files no longer present are marked missing and are never removed from the catalog automatically.
- **Sources:** `docs/product/product-specification.md#94-incremental-scans`, `docs/contracts/health.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/repositories/health-repository.test.ts`, `src/main/db/repositories/scan-catalog-repository.test.ts`, `tests/integration/scan-service.test.ts`
- **Test notes:** Tests cover missing marking and preservation.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-HEALTH-007 — Missing files can be disregarded and restored

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Text:** A missing file can be disregarded, which records `dismissed_at`, dismisses its pending move suggestions, and keeps the catalog row. Restore clears the dismissal. Neither action changes a source or backup file.
- **Source text:** Disregarding records dismissed_at, dismisses pending move suggestions, keeps the catalog row, and never changes source or backup files. Restore clears dismissed_at.
- **Sources:** `docs/contracts/health.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/health-db-handlers.test.ts`, `src/main/db/repositories/health-repository.test.ts`, `src/main/modules/health/application/health-service.test.ts`, `src/renderer/src/features/health/HealthPage.test.tsx`
- **Test notes:** Tests cover dismiss and restore.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-HEALTH-008 — Missing lists page and select across the full result

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Text:** The missing and disregarded lists are offset-paged in the UI and return the IDs of every matching file so Select all covers more than the visible page. The disregarded list is newest-first. Dismiss and restore accept up to 50,000 IDs per request.
- **Source text:** The missing list is offset-paged in the UI, includes fileIds for every matching file, and dismiss/restore accept up to 50,000 ids. The disregarded list is ordered by dismissed_at descending.
- **Sources:** `docs/contracts/health.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md`
- **Implementation:** `src/main/db/repositories/health-missing-repository.ts`
- **Proving tests:** `src/main/db/health-db-handlers.test.ts`, `src/main/db/repositories/health-repository.test.ts`, `src/renderer/src/features/health/HealthPage.test.tsx`
- **Test notes:** Tests cover offset paging, newest-first disregarded order, and bulk selection across pages.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-HEALTH-009 — Moved candidates are paginated and batch-confirmed

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Text:** A moved candidate records old path, new path, size, and SHA-256. The list is paginated, confirm accepts at most 500 candidates per request, and dismiss accepts up to 50,000.
- **Source text:** A pending moved candidate contains old path, new path, size, and SHA-256. The list is paginated; confirm is capped at 500, dismiss at 50,000.
- **Sources:** `docs/contracts/health.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/repositories/health-repository.test.ts`, `src/renderer/src/features/health/HealthPage.test.tsx`
- **Test notes:** Tests cover candidate shape and paging.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-HEALTH-010 — Confirming a move rechecks and updates the catalog

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Text:** Confirming a move rechecks the new path and hash in the main process, deletes the newly discovered duplicate row, updates the original catalog row to the new path, clears missing state, and confirms the candidate.
- **Source text:** Confirm flow rechecks the new path and hash in the main process, deletes the newly discovered duplicate row, updates the original row, clears missing state, and confirms the candidate.
- **Sources:** `docs/contracts/health.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/repositories/health-repository.test.ts`, `src/main/modules/health/application/health-service.test.ts`
- **Test notes:** Tests cover recheck and catalog update.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-HEALTH-011 — Dismissing a move keeps the file missing

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Text:** Dismissing a moved candidate keeps the file missing and marks the candidate dismissed without changing the catalog path.
- **Source text:** Dismissing keeps the file missing and marks the candidate dismissed.
- **Sources:** `docs/contracts/health.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/repositories/health-repository.test.ts`
- **Test notes:** Tests cover dismissal state.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-HEALTH-012 — Missing-duplicate cleanup removes catalog rows only

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Text:** Missing-duplicate cleanup removes only eligible missing catalog rows that have a complete full SHA-256 and a present file with the same hash and size. Source and destination files are never touched, and adoption counters are refreshed.
- **Source text:** Cleanup removes only eligible missing catalog rows with a full hash and a present same-hash/size peer; source and destination files are never touched.
- **Sources:** `docs/contracts/health.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md`
- **Implementation:** `src/main/db/repositories/health-cleanup-repository.ts`
- **Proving tests:** `src/main/db/health-db-handlers.test.ts`, `src/main/db/repositories/health-missing-duplicates-repository.test.ts`, `src/main/modules/health/application/health-service.test.ts`, `tests/e2e/health.spec.ts`
- **Test notes:** Tests cover eligibility and catalog-only removal.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-HEALTH-013 — Missing-duplicate preview reports risk and pending moves

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Text:** The missing-duplicate preview reports how many candidates have pending move suggestions, verified backup replicas, and active date overrides before cleanup.
- **Source text:** The preview reports pending move suggestions, verified backup replicas, and active date overrides.
- **Sources:** `docs/contracts/health.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/health-db-handlers.test.ts`, `src/main/db/repositories/health-missing-duplicates-repository.test.ts`, `src/renderer/src/features/health/MissingDuplicates.test.tsx`, `tests/e2e/health.spec.ts`
- **Test notes:** Tests cover preview counts and warnings.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-HEALTH-014 — Validation has independently selectable levels

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Text:** Validation offers four independently selectable levels: existence, metadata, hash, and metadataRefresh.
- **Source text:** Validation supports existence, metadata, hash, and metadataRefresh levels, independently selectable.
- **Sources:** `docs/product/product-specification.md#14-validation`, `docs/contracts/health.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/repositories/validation-repository.test.ts`, `src/main/modules/health/application/health-service.test.ts`, `src/renderer/src/features/health/HealthPage.test.tsx`, `tests/e2e/health.spec.ts`
- **Test notes:** Tests cover level selection and state.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-HEALTH-015 — Validation covers the whole catalog and stores per-file results

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Text:** Validation covers the whole catalog. Total checks equal the file count multiplied by the selected levels, and every result is stored per session, level, and file.
- **Source text:** Scope is the whole catalog; total checks = file count × selected levels; results are stored per session/level/file.
- **Sources:** `docs/contracts/health.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/health-db-handlers.test.ts`, `src/main/db/repositories/validation-repository.test.ts`, `src/main/modules/health/application/health-service.test.ts`
- **Test notes:** Tests cover totals and result storage.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-HEALTH-016 — Hash validation records mismatches and updates the stored hash

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Text:** Hash validation recomputes SHA-256, records a mismatch, and updates the stored hash to the actual value.
- **Source text:** hash recomputes SHA-256; mismatch is recorded and the stored hash is updated to the actual value.
- **Sources:** `docs/contracts/health.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/repositories/validation-repository.test.ts`
- **Test notes:** Tests cover mismatch and hash update.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-HEALTH-017 — Metadata refresh preserves manual date overrides

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Text:** Metadata refresh re-extracts metadata through ExifTool, writes metadata and extracted dates, and preserves every active manual date override.
- **Source text:** metadataRefresh re-extracts metadata through ExifTool, writes metadata and extracted dates, and preserves manual date overrides.
- **Sources:** `docs/contracts/health.md`
- **ADRs:** `docs/adr/0005-versioned-metadata-extraction.md`
- **Contracts:** `docs/contracts/health.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/repositories/validation-repository.test.ts`
- **Test notes:** The scan-stage metadata test proves an active manual override survives a metadata save; the validation metadataRefresh path calls the same saveMetadata handler.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-HEALTH-018 — Validation marks missing files without deleting them

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Text:** A missing validation result marks the file state as missing and inserts a `missing_files` row without deleting the catalog row.
- **Source text:** missing results mark files.state = 'missing' and insert missing_files.
- **Sources:** `docs/contracts/health.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/repositories/validation-repository.test.ts`
- **Test notes:** Tests cover missing result persistence.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-HEALTH-019 — Validation pauses, resumes, and recovers

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Text:** Validation supports pause, resume, shutdown-pause, stale-session recovery, and explicit failure states.
- **Source text:** Pause, resume, shutdown-pause, stale-session recovery, and failure states are supported.
- **Sources:** `docs/contracts/health.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/repositories/validation-repository.test.ts`, `src/main/modules/health/application/health-service.test.ts`
- **Test notes:** Tests cover pause/resume and recovery.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-HEALTH-020 — Validation reports every outcome

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Text:** The validation report counts verified, missing, metadata changed, hash mismatch, metadata updated, and unreadable results, with start and finish times.
- **Source text:** Report counts verified, missing, metadata changed, hash mismatch, metadata updated, unreadable, start and finish time.
- **Sources:** `docs/contracts/health.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/repositories/validation-repository.test.ts`, `src/main/modules/health/application/health-service.test.ts`, `src/renderer/src/features/health/HealthPage.test.tsx`
- **Test notes:** Tests cover report counts.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-HEALTH-021 — Health actions never change original files

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Text:** Missing, moved, duplicate, missing-duplicate, and validation actions change catalog metadata only. They never move, rename, edit, or delete a source file.
- **Source text:** No source file is moved, renamed, edited, or deleted by health actions.
- **Sources:** `docs/product/product-specification.md#14-validation`, `docs/contracts/health.md`
- **ADRs:** `docs/adr/0010-duplicate-quarantine.md`
- **Contracts:** `docs/contracts/health.md`
- **Implementation:** `scripts/check-read-only.mjs`
- **Proving tests:** `tests/integration/read-only-guard.test.ts`
- **Test notes:** The read-only guard test covers the source-write boundary.
- **Conflicts:** _none_
- **Notes:** The quarantine mover is the one source-moving exception; see ML-SAFE-002.
- **Decision:** verified

### ML-HEALTH-022 — Health UI exposes Missing, Duplicates, and Validation tabs

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Text:** The Health route exposes Missing files, Duplicates, and Validation tabs, including empty, loading, error, and populated states.
- **Source text:** The /health route has Missing files, Duplicates, and Validation tabs with their states.
- **Sources:** `docs/contracts/health.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md`
- **Implementation:** _none_
- **Proving tests:** `src/renderer/src/features/health/HealthPage.test.tsx`, `tests/e2e/health.spec.ts`
- **Test notes:** Tests cover tabs and states.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-HEALTH-023 — Validation is exclusive with scan and cleanup

- **Kind:** constraint
- **Status:** verified
- **Verification:** automated-test
- **Text:** Validation, scan, and duplicate cleanup are mutually exclusive heavy workloads. Starting one while another is active is blocked with a clear reason.
- **Source text:** Validation and scan/cleanup are mutually exclusive workloads; starting one while another is active is blocked.
- **Sources:** `docs/contracts/health.md`, `docs/product/scope-and-implementation.md#51-process-model`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/modules/health/application/health-service.test.ts`, `src/main/modules/workloads/application/workload-coordinator.test.ts`
- **Test notes:** Tests cover workload conflicts.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-HEALTH-024 — Scan completion surfaces missing-duplicate cleanup

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Text:** When a scan completes with missing-duplicate candidates, the scan screen surfaces the cleanup callout and the candidate count.
- **Source text:** A scan-complete callout points to missing-duplicate cleanup when candidates exist.
- **Sources:** `docs/contracts/health.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md`
- **Implementation:** _none_
- **Proving tests:** `src/renderer/src/features/scan/ScanPage.test.tsx`
- **Test notes:** Tests cover the scan callout and missing-duplicate preview.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-HEALTH-025 — Catalog-changing actions refresh affected views

- **Kind:** outcome
- **Status:** implemented
- **Verification:** automated-test
- **Text:** When a catalog-changing action finishes, closing its dialog refreshes the affected views. Dismissing the duplicate cleanup completion dialog forces the duplicates page, cleanup summary, health summary, library, and replication views to refetch.
- **Source text:** Dismissing a duplicate cleanup completion dialog leaves the duplicates page on cached data until a manual reload.
- **Sources:** `docs/contracts/health.md#duplicate-quarantine`, `docs/product/duplicate-quarantine-plan.md#ux`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md`
- **Implementation:** _none_
- **Proving tests:** `src/renderer/src/features/health/DuplicateCleanupRefresh.test.tsx`
- **Test notes:** The cleanup completion dialog test is ID-tagged and asserts a fresh duplicates query after Done.
- **Conflicts:** _none_
- **Notes:** The same refresh rule is applied to scan completion, validation completion, library date changes, cache clearing, and replication coverage changes.
- **Decision:** implemented

## Conflicts

_No conflicts in this batch._
## Approval

This batch is approved. For future batches, either:

1. change `status` to `accepted` and keep the text;
2. edit `text` in the JSON and keep `needs-review`; or
3. change `status` to `non-goal` if the item is out of scope.

Do not mark a requirement `verified` unless its `verificationMethod` is satisfied:

- `automated-test`: at least one test carries the requirement ID and passes;
- `automated-check`: an implementation or guard path is recorded;
- `manual`: a test note records the manual acceptance;
- `inspection`: an implementation or guard path is recorded.
