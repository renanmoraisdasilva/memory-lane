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
| `health:get-moved` | `getHealthMoved` | none | `MovedCandidatesPage` |
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
- Confirm flow rechecks the new path and hash in the main process before calling
  the DB worker.
- Confirming deletes the newly discovered duplicate row, updates the original
  catalog row to the new path, clears missing state, and confirms the candidate.
- Dismissing keeps the file missing and marks the candidate dismissed.
- No source file is moved, renamed, edited, or deleted.

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

Catalog schema version: 5.

## Tests

Repository, handler, service, renderer, and E2E tests cover duplicate rebuild,
missing/moved actions, validation progress, hash update, metadata refresh, and
the health UI.
