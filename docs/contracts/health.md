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
| `health:get-missing` | `getHealthMissing` | `{ offset?, limit? }` | `MissingFilesPage` |
| `health:get-missing-duplicates` | `getHealthMissingDuplicates` | `{ offset?, limit? }` | `MissingDuplicatesPage` |
| `health:purge-missing-duplicates` | `purgeHealthMissingDuplicates` | `{ fileIds, includePendingMoves? }` | `{ removed, skipped, dismissedMovedCandidates }` |
| `health:get-moved` | `getHealthMoved` | `{ offset?, limit? }` | `MovedCandidatesPage` |
| `health:confirm-moved` | `confirmHealthMoved` | `{ candidateIds }` | `{ updated, skipped }` |
| `health:dismiss-moved` | `dismissHealthMoved` | `{ candidateIds }` | `{ updated, skipped }` |
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
  missing state, and duplicate state.
- Duplicate detection is informational only.

## Missing and moved

- Missing files are rows in `missing_files` joined to their preserved `files`
  row.
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

Catalog schema version: 9.

## Tests

Repository, handler, service, renderer, and E2E tests cover duplicate rebuild,
missing/moved actions, missing-duplicate cleanup, validation progress, hash
update, metadata refresh, and the health UI.
