# Settings and backup contract

Status: implemented in Phase 5. Types live in
`src/shared/contracts/settings.ts`.

## Routes

| Route | Purpose |
|---|---|
| `/settings` | Cache, catalog, backups, background controls, and About |

## IPC contract

| Channel | Method | Params | Result |
|---|---|---|---|
| `settings:get-info` | `getSettingsInfo` | none | `SettingsInfo` |
| `settings:clear-cache` | `clearCache` | none | `CacheClearResult` |
| `settings:run-backup` | `runBackup` | none | `BackupResult` |

## Cache

- Cache location comes from the open catalog context: `<catalog-dir>/cache`.
- Size and file count come from `cache_entries`; Settings never recursively walks
  the cache directory.
- Clearing removes the cache directory and all `cache_entries` rows.
- Cache clearing never changes `catalog.db`, date overrides, metadata, or any
  original file.
- Thumbnails and HEIC/HEIF previews regenerate lazily through the normal media
  request path.

## Backups

- Uses `better-sqlite3`'s online backup API.
- Backs up both `catalog.db` and `app.db`.
- Destination: `%LOCALAPPDATA%\MemoryLane\backups\<volume-id>\`.
- Files: `catalog.db` and `app.db`.
- Triggers:
  - manual "Back up now";
  - every 15 minutes while the app is open;
  - graceful application shutdown.
- A scheduled run is skipped if another backup is already in flight.
- Scheduled runs are ignored when no catalog is open.
- `backup_history` stores path, bytes, time, and `success`/`failed`.
- `registered_drives.last_backup_at` stores the last successful backup.
- A failure is surfaced in Settings as `lastStatus: "failed"` and does not stop
  the app.

## Recovery

Recovery is manual for v0.1:

1. Close Memory Lane.
2. Copy `app.db` back to the app user-data directory.
3. Copy `catalog.db` back to the archive catalog directory.
4. Reopen the app and verify the catalog.

No restore action exists in the UI.

## Schema

Phase 5 reuses the existing `backup_history` and
`registered_drives.last_backup_at` fields from app schema version 2. No catalog
migration is added; catalog schema is version 12 after the video-frame-rate and
preview work.

## Tests

DB handler, service, DB-worker integration, renderer, and Electron E2E tests
cover cache statistics/clearing, successful and failed backups, scheduled and
shutdown backups, and UI confirmation/failure states.
