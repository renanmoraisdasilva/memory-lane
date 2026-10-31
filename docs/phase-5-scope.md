# Phase 5 scope - Other files and settings

Status: implemented and verified.

Phase 5 completes the remaining v0.1 screens: a browsable Other files
catalog, cache controls, catalog details, scheduled SQLite backups, and app
information.

## Decisions

- Other files cover **every cataloged non-media file**, including missing files.
- Categories are All, Documents, Spreadsheets, Presentations, PDFs, Audio,
  Archives, and Other.
- Results use offset pagination with 50 rows per page.
- Open and reveal stay **external**; there is no in-app document viewer.
- Cache clearing removes **all generated thumbnails and previews** and their
  database rows. The catalog, overrides, and originals are untouched.
- Backups use the SQLite online backup API for **both** `catalog.db` and
  `app.db`.
- Backups run every **15 minutes** while the app is open and once during a
  graceful close.
- The latest backup set is overwritten in
  `%LOCALAPPDATA%\MemoryLane\backups\<volume-id>\`.
- Recovery is **manual**; no restore UI ships in v0.1.
- Background scan controls are not duplicated. Settings links to the existing
  Scan & processing screen.

## Other files

Route `/files`, sidebar destination.

- Category chips show counts for every category plus All.
- The table shows name, type, category, folder, size, modified date, and
  present/missing state.
- Present files can be opened with the default application or revealed in
  Explorer.
- Missing files stay visible and disable both actions.
- No delete, move, rename, or edit action exists.

Category mapping by extension:

| Category | Extensions |
|---|---|
| PDFs | `pdf` |
| Documents | `doc`, `docx`, `odt`, `rtf`, `txt`, `md` |
| Spreadsheets | `xls`, `xlsx`, `ods`, `csv` |
| Presentations | `ppt`, `pptx`, `odp` |
| Audio | `mp3`, `wav`, `flac`, `aac`, `ogg`, `m4a`, `wma`, `opus` |
| Archives | `zip`, `rar`, `7z`, `tar`, `gz`, `bz2`, `xz` |
| Other | Everything else |

## Settings

Route `/settings`, sidebar destination.

- **Generated cache** - location, size, file count, and a confirmed clear.
- **Catalog** - database path and size.
- **Catalog backups** - location, last backup time, status, size, and
  "Back up now".
- **Background processing** - link to the existing scan controls.
- **About** - app version, Electron version, platform, packaged state, and the
  offline/no-telemetry statement.

A failed scheduled backup is logged and appears as a failed last status; it
does not interrupt the app.

## Backups

- Backup directory: `%LOCALAPPDATA%\MemoryLane\backups\<volume-id>\`.
- Files: `catalog.db` and `app.db`.
- Triggered manually, every 15 minutes, and on graceful shutdown.
- `backup_history` records success or failure; `registered_drives.last_backup_at`
  records the last successful backup.
- Overlapping scheduled runs are skipped while one backup is in flight.
- If no catalog is open, scheduled runs are ignored.
- Manual recovery: close Memory Lane, copy the backup files next to the
  original database paths, and reopen the app.

## Tests

- Repository tests for category mapping, counts, filters, pagination, and null
  modified dates.
- Settings DB handler tests for successful and failed backups, backup state,
  and cache row clearing.
- Settings service tests for cache statistics, clearing, timer backups,
  shutdown backups, and the no-catalog case.
- Renderer tests for Other files, open/reveal, filtering, paging, Settings,
  cache confirmation, backup, and failure display.
- Integration test for Other files and backups through the DB worker.
- E2E: scan, browse Other files, filter categories, run a backup, clear the
  cache, and confirm originals still exist.

## Known limits

- Each backup overwrites the previous snapshot; there is no retention policy.
- Backups only run while the app is open (plus graceful close); there is no
  Windows service or scheduled task.
- Cache clearing is all-or-nothing.
- Other files filtering uses the catalog schema as-is; large-catalog index
  tuning belongs to Phase 6.
- No restore UI and no in-app document/PDF/audio viewer are included in v0.1.
