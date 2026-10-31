# Phase 4 scope - Integrity

Status: implemented and verified.

Phase 4 adds Library health: exact duplicate groups, missing files, moved-file
confirmation, and whole-catalog validation. All operations are read-only against
original files.

## Decisions

- Duplicate detection covers **all catalog files**, not only photos and videos.
- Deep validation **recomputes SHA-256** for every checked file and updates the
  catalog hash when content changed.
- Validation covers the **whole catalog** by default.
- Metadata revalidation **updates extracted metadata and dates** while preserving
  active manual date overrides.
- Moved-file confirmation **rechecks existence and SHA-256** before updating a
  catalog path.

## Duplicates

- Exact duplicates are files with the same complete SHA-256 and present state.
- `duplicate_groups` and `duplicate_members` are rebuilt:
  - after a scan finalizes;
  - when Library health loads duplicate groups;
  - after a validation run completes.
- The Duplicates tab reports group count, file count, total bytes, every copy's
  path, and media links where applicable.
- Memory Lane tiles show a **Duplicate** badge when the file is in a group.
- No delete, move, rename, or cleanup action is offered.

## Missing files and moved candidates

- The scan already marks missing files and stores hash-matched moved candidates.
- Missing files remain cataloged and keep their former path.
- The Missing files tab lists missing files and pending moved candidates.
- Confirming a moved candidate:
  1. verifies the new path exists;
  2. re-hashes the new file;
  3. updates the old catalog row to the new path;
  4. removes the newly discovered duplicate catalog row;
  5. clears the missing state and confirms the candidate.
- Candidates can be dismissed as **Keep as missing**.
- If revalidation fails, the candidate is skipped and reported.

## Validation

Levels, independently selectable:

1. **Existence** - confirm the cataloged path exists.
2. **Basic metadata** - compare size and modification time.
3. **Deep SHA-256** - recompute and compare; update the stored hash on mismatch.
4. **Metadata revalidation** - re-extract metadata and resolve dates through the
   Phase 3 chain; preserve overrides.

Behavior:

- Whole catalog; total checks = file count × selected level count.
- Runs in the main process with pause, resume, and app-shutdown pause.
- Progress is persisted in `validation_sessions` and `validation_results`.
- Pausing preserves completed results; resume continues with pending checks.
- A stale running session becomes paused when the app reopens.
- Missing results mark the file missing and add it to `missing_files`.
- Metadata revalidation uses the shared ExifTool extractor.
- Deep hashing updates the catalog hash only after recording the mismatch result.
- Duplicate groups are rebuilt when validation completes.

Schema migration 5 adds validation progress/error/current-level fields and
per-result levels. Catalog schema version: 5.

## Library health UI

Route `/health`, sidebar destination with missing/moved issue count.

- Header: duplicate groups, missing files, moved candidates, last validation.
- Missing files tab: moved-candidate batch selection, confirm/dismiss, missing
  table.
- Duplicates tab: grouped copies with paths, sizes, and media links.
- Validation tab: level selection, run/pause/resume, progress, report, errors.
- All mutations invalidate health and library queries.

## Tests

- Repository tests for duplicate rebuild, missing/moved listing, confirmation,
  dismissal, validation progress, missing marking, and hash updates.
- Handler tests for every health database method.
- Health service tests for moved revalidation, stale-session recovery, and
  validation completion.
- Renderer tests for tab navigation and validation start.
- E2E: scan duplicate files, inspect the duplicate group, run validation across
  the catalog, and see the completed report.
- Coverage includes the critical `src/main/db/**` branch threshold.

## Known limits

- Validation report counts are per check result, not a deduplicated per-file
  outcome.
- Missing/moved actions are unavailable while the archive drive is offline.
- Duplicate rebuild is write work inside the DB worker; very large duplicate
  sets should be benchmarked.
- Validation pause is cooperative between files; a large in-flight hash finishes
  before pausing.
- Manual validation history UI is intentionally out of scope; the database keeps
  sessions/results.
