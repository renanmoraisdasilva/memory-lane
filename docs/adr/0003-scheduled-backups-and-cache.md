# 0003 - Scheduled SQLite backups and all-or-nothing cache clearing

- Status: Accepted
- Date: 2026-10-31

## Context

Phase 5 adds PC-side protection for the two SQLite databases and settings
controls for generated thumbnails. A file copy of a live SQLite database can be
inconsistent, and users can regenerate every thumbnail from originals.

## Decision

- Back up both `catalog.db` and `app.db` with the SQLite online backup API.
- Run backups every 15 minutes while the app is open, on manual request, and on
  graceful shutdown.
- Store the latest backup set in
  `%LOCALAPPDATA%\MemoryLane\backups\<volume-id>\`.
- Record results in `backup_history` and `registered_drives.last_backup_at`.
- Do not add a restore UI in v0.1; document manual recovery.
- Clear all generated cache files and `cache_entries` rows together. Never
  touch the catalog, overrides, or originals.
- Skip overlapping scheduled backups and ignore scheduled runs when no catalog
  is open.

## Alternatives

- **Copy database files directly.** Faster to implement, but unsafe while WAL
  or transactions are active.
- **Back up only the catalog.** Leaves app-level drive/backup history
  unprotected.
- **Keep every backup snapshot.** More storage and retention policy work than
  v0.1 needs.
- **Selective cache clearing by file or type.** More UI and query complexity;
  all-or-nothing already satisfies the product requirement.
- **Add restore UI now.** Increases the mutation surface and needs its own
  validation/rollback design.

## Consequences

Easier:

- Backups are consistent and require no app pause.
- Users can recover with documented file copies.
- Cache can always be regenerated; no user content is at risk.
- Backup failures are visible without interrupting browsing.

Harder:

- A single backup set means an external copy is needed for longer history.
- Backups only run while the app is open.
- Very large catalogs need backup-duration and disk-space monitoring.
- Cache clearing forces thumbnail regeneration, which costs CPU after a clear.
