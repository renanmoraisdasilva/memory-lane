# Library health contract

Status: implemented in Phase 4. Types live in
`src/shared/contracts/health.ts`.

## Routes

| Route | Purpose |
|---|---|
| `/health` | Library health tabs: Missing files, Duplicates, Validation |

## IPC contract

| Channel | Method | Params | Result |
|---|---|---|---|
| `health:get-summary` | `getHealthSummary` | none | `HealthSummary` |
| `health:get-duplicates` | `getHealthDuplicates` | `{ offset?, limit? }` | `DuplicateGroupsPage` |
| `health:get-missing` | `getHealthMissing` | `{ offset?, limit?, dismissedOnly? }` | `MissingFilesPage` |
| `health:get-missing-duplicates` | `getHealthMissingDuplicates` | `{ offset?, limit? }` | `MissingDuplicatesPage` |
| `health:purge-missing-duplicates` | `purgeHealthMissingDuplicates` | `{ fileIds, includePendingMoves? }` | `{ removed, skipped, dismissedMovedCandidates }` |
| `health:dismiss-missing` | `dismissHealthMissing` | `{ fileIds }` | `MissingActionResult` |
| `health:restore-missing` | `restoreHealthMissing` | `{ fileIds }` | `MissingActionResult` |
| `health:get-moved` | `getHealthMoved` | `{ offset?, limit? }` | `MovedCandidatesPage` |
| `health:confirm-moved` | `confirmHealthMoved` | `{ candidateIds }` | `{ updated, skipped }` |
| `health:dismiss-moved` | `dismissHealthMoved` | `{ candidateIds }` | `{ updated, skipped }` |
| `cleanup:get-summary` | `getCleanupSummary` | none | `DuplicateCleanupSummary` |
| `cleanup:get-state` | `getCleanupState` | none | `DuplicateCleanupState` |
| `cleanup:start` | `startCleanup` | none | `DuplicateCleanupState` |
| `cleanup:cancel` | `cancelCleanup` | none | `DuplicateCleanupState` |
| `cleanup:reveal-quarantine` | `revealCleanupQuarantine` | none | none |
| `health:get-validation-state` | `getValidationState` | none | `ValidationState` |
| `health:start-validation` | `startValidation` | `{ levels }` | `ValidationState` |
| `health:pause-validation` | `pauseValidation` | none | `ValidationState` |
| `health:resume-validation` | `resumeValidation` | none | `ValidationState` |

## Duplicates

- Exact SHA-256 duplicates across all present catalog files.
- Sampled quick fingerprints are never duplicate evidence. A large file is fully
  hashed when another present or fully hashed missing file shares its size, so
  exact duplicate/move matching is preserved for those candidates.
- `duplicate_groups` and `duplicate_members` are rebuilt after scan finalize,
  on duplicate query, and after validation completes.
- Group ordering is total bytes descending, then group id.
- Each `HealthFile` includes path, folder, media metadata, date, thumbnail URL,
  missing state, duplicate state, filesystem timestamps, verified-backup state,
  and active date-override state.
- Each group reports its keeper, keeper reason, eligibility, skip reason, and
  excess bytes. Page totals include the excess bytes for all eligible groups.

## Duplicate quarantine

This is the only Memory Lane action that moves archive files. It never deletes
them.

- The page shows `KEEP` / `MOVE` badges for eligible groups and `SKIP` plus the
  reason for groups that fail a gate.
- The keeper is the oldest created file, then oldest modified, then shallower and
  shorter path, then shorter name, then lower file ID.
- A group is eligible only when at least two present files have the same full
  SHA-256, every file is at least 1 KB, no file is a hard link, at most one copy
  has an active date override, and the chosen keeper has verified backup
  coverage.
- The confirmation requires an explicit acknowledgement. The move button is live;
  there is no preview-only phase or settings toggle.
- A cleanup run gets its own folder:
  `X:\.memorylane_quarantine\run-<timestamp>-<random>\` with `manifest.json` and
  `journal.jsonl`.
- The mover re-checks the keeper and every candidate with full SHA-256
  immediately before the same-volume rename. Changed, missing, hard-linked,
  outside-root, and rename-failed candidates are journaled and skipped.
- Moves are applied to the catalog in batches. The moved `files` rows are deleted,
  `cleanup_moves` keeps the audit record, duplicate groups are rebuilt, and
  destination adoption counters are refreshed. A rescan therefore does not treat
  the moved files as missing.
- Cancel stops after the current file. The run remains auditable if it is
  cancelled, fails, or is interrupted by an app restart.
- Scans exclude `.memorylane_quarantine`; the read-only guard allows only the
  quarantine mover to rename source files.

## Missing and moved

- Missing files are rows in `missing_files` joined to their preserved `files`
  row.
- A missing file can be **disregarded** from the Missing files tab. This records
  `missing_files.dismissed_at`, dismisses its pending move suggestions, and keeps
  the catalog row intact. Files on source and backup drives are never changed.
- Disregarded files are hidden from the Missing files and Missing duplicates
  views. `dismissedOnly` returns the disregarded list, and the restore action
  clears `dismissed_at`.
- The missing list is offset-paged. The response includes `fileIds` for every
  matching missing file so Select all can cover files beyond the visible page,
  plus `dismissedTotal` for the Show disregarded control.
- Dismiss and restore accept up to 50,000 file ids per request. Select all covers
  every matching missing file, not only the visible page.
- A pending moved candidate contains old path, new path, size, and SHA-256.
- The moved-candidate list is paginated. The UI requests 50 at a time.
- Confirming is capped at 500 candidates per request. Dismissing accepts up to
  50,000 candidates so a whole scan's move suggestions can be dismissed in one
  action.
- Confirm flow rechecks the new path and hash in the main process before calling
  the DB worker.
- Confirming deletes the newly discovered duplicate row, updates the original
  catalog row to the new path, clears missing state, and confirms the candidate.
- Dismissing keeps the file missing and marks the candidate dismissed.
- No source file is moved, renamed, edited, or deleted.

### Missing duplicates

A missing file can be an exact duplicate of a file still in the archive. This is
common after deleting redundant copies outside Memory Lane: the deleted file
remains cataloged as `missing` and can still participate in adoption matching.

- A cleanup candidate must have a complete full SHA-256 hash whose recorded size
  and modified time still describe the missing file, or a legacy hash whose
  timestamp is not older than the file's recorded modification time.
- A present file with the same full SHA-256 and size must still exist.
- The preview includes candidates that also have pending moved candidates. It
  reports how many such files exist and how many move suggestions they carry.
- The default cleanup removes only candidates without pending move suggestions.
  Candidates with pending move suggestions are removed only when
  `includePendingMoves` is true.
- Removing a candidate with pending move suggestions deletes the missing catalog
  row, so its move suggestions are deleted by the catalog foreign key. The file
  at the suggested path remains present and cataloged. This is appropriate only
  when the missing copy was a duplicate deleted outside Memory Lane. If the file
  was actually moved, confirm the move instead so the catalog keeps its dates,
  overrides, and backup links.
- The preview reports how many candidates have verified backup replicas and how
  many have active date overrides.
- Cleanup removes only the missing catalog rows. Hashes, dates, metadata,
  overrides, cache entries, replica links, moved candidates, and missing records
  attached to those rows are removed by the catalog foreign keys. Source and
  destination files are never touched.
- Destination adoption counters are refreshed for every affected destination.
- The action is always explicit and confirmed. It is available in Library health
  → Missing, and a scan-complete callout points to it when candidates exist.
- Re-adopt destinations after cleanup so they can match against the surviving
  files instead of the removed missing rows.

## Validation

Levels: `existence`, `metadata`, `hash`, `metadataRefresh`.

- Scope is the whole catalog.
- Total checks = file count × selected levels.
- Results are stored per session/level/file.
- `hash` recomputes SHA-256; mismatch is recorded and the stored hash is updated
  to the actual value.
- `metadataRefresh` re-extracts metadata through ExifTool, writes metadata and
  extracted dates, and preserves manual date overrides.
- `missing` results mark `files.state = 'missing'` and insert `missing_files`.
- Pause, resume, shutdown-pause, stale-session recovery, and failure states are
  supported.
- Report counts: verified, missing, metadata changed, hash mismatch, metadata
  updated, unreadable, start/finish time.

## Schema

Catalog migration 5:

- `validation_sessions`: `total`, `processed`, `current_level`,
  `error_message`, `last_saved_at`.
- `validation_results`: `level`.
- Unique `(session_id, file_id, level)` and session/level indexes.

Catalog migration 10 adds `missing_files.dismissed_at` and its index.

Catalog migration 11 adds `files.link_count`, `cleanup_runs`, `cleanup_moves`, and
their indexes.

Catalog schema version: 11.

## Tests

Repository, handler, service, and renderer tests cover duplicate rebuild,
keeper eligibility, skip reasons, quarantine moves and journaling, catalog apply
and adoption-counter refresh, missing/moved actions, missing dismissal and
restore, missing-duplicate cleanup, validation progress, hash update, metadata
refresh, and the health UI. E2E tests cover the missing-duplicate cleanup,
duplicate skip badges, disabled cleanup without verified keeper coverage, and
validation flows.
