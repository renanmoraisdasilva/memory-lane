# Phase history

Status: archived record.

This file preserves the delivered Phase 3-6 scope, decisions, test coverage, and
known limits. Current product behavior lives in
[`scope-and-implementation.md`](../product/scope-and-implementation.md), with
the current status in [`roadmap.md`](../product/roadmap.md).

## Phase 3 - Dates

Status: implemented and verified.

Phase 3 makes dates honest. It adds ExifTool-based extraction, a deterministic
date-priority chain, suspicious-date handling, a Date unavailable workflow, and
catalog-only manual overrides.

### Exit criteria

- ExifTool reads image and video metadata in development and packaged builds.
- Dates resolve from EXIF/XMP/video metadata with filesystem fallback.
- Date precision, source, confidence, and original value are stored.
- Suspicious dates are not confidently placed in the timeline.
- Undated items appear in Date unavailable.
- A year or year/month can be assigned individually or in bulk.
- Manual overrides are catalog-only, reversible, and preserve the extracted date.
- The viewer can set and clear a manual date.
- Quality gates, E2E, packaging, and packaged smoke pass.

### Metadata extraction

**Primary:** `exiftool-vendored` 39.1.0 with ExifTool 13.60.

- Runs as a persistent child process with at most two processes.
- Uses group-prefixed reads so EXIF, XMP, QuickTime, RIFF, and Matroska dates are
  distinguishable.
- Reads with ExifTool's `-fast` default; metadata is normally at the start of
  the file.
- Extracts selected fields only:
  - date tags and provenance;
  - image dimensions and video duration;
  - video frame rate where available;
  - camera make/model/lens;
  - GPS latitude/longitude/altitude;
  - video codec where available.
- Writes `metadata.exiftool = ok` or `failed` to `file_metadata`.
- Shuts down with `ScanService.shutdown()`.

**Fallbacks:** the existing dependency-free image-dimension reader and MP4/MOV
duration reader fill missing values. Filesystem timestamps remain the final
date fallback.

**Packaging:** `electron-builder.yml` unpacks
`node_modules/exiftool-vendored.*/**/*`. The packaged smoke writes EXIF to a
fixture JPEG and asserts that the packaged app resolves the EXIF date and records
`metadata.exiftool = ok`.

### Date priority

1. Manual catalog override.
2. EXIF `DateTimeOriginal`.
3. EXIF `CreateDate`.
4. EXIF `DateTimeDigitized`.
5. QuickTime creation/create dates.
6. RIFF/AVI dates.
7. Matroska dates.
8. XMP `CreateDate` / `DateCreated`.
9. Other ExifTool date tags from recognized video groups.
10. Filesystem creation date.
11. Filesystem modification date.

If a non-filesystem date is suspicious, it is not used and the item becomes
undated rather than falling back to a misleading filesystem date.

### Date storage

`file_dates` stores:

- `resolved_date` - sortable ISO-like wall-clock string, or UTC `Z` for
  filesystem dates;
- `precision` - `year`, `month`, or `exact`;
- `source`, `confidence`, `original_value`;
- `is_override`, `override_id`;
- `extracted_*` copies of the last non-manual resolution.

The extracted fields make overrides reversible. A rescan updates
`extracted_*` but does not overwrite an active manual override.

**Timezone policy:** EXIF wall-clock time is preserved. The app does not invent a
timezone when metadata has no offset. Original values are retained for audit.

### Suspicious dates

A date is flagged and skipped when:

- the year is before 1900;
- the year is more than one year in the future;
- the exact time is a known placeholder such as `1970-01-01 00:00:00` or
  `1980-01-01 00:00:00`.

Flagged values are stored as `date.suspicious` metadata. They are reviewed in
Date unavailable rather than placed confidently in the timeline.

### Contracts

New channels:

| Channel | Method | Params | Result |
|---|---|---|---|
| `library:get-undated` | `getLibraryUndated` | `{ cursor?, limit? }` | `LibraryUndatedPage` |
| `library:set-date` | `setLibraryDate` | `{ fileIds, year, month? }` | `{ updated }` |
| `library:clear-date` | `clearLibraryDate` | `{ fileIds }` | `{ updated }` |

`LibraryDate` now includes `isOverride`. Date assignment accepts year 1800-2200
and an optional month. Month assignment stores month precision; year assignment
stores year precision. No day is invented.

### UI

- New `/undated` route and sidebar destination with a count badge.
- Memory Lane summary links to Date unavailable when items need dates.
- Date unavailable lists undated media with selection, select-all-visible, and
  pagination.
- Assignment panel previews the catalog date before applying.
- Viewer Date section has **Set date** and, when applicable, **Clear manual
  date**.
- All mutations invalidate the library query family.

### Schema

Catalog migration 4:

- adds `file_dates.extracted_date`, `extracted_precision`, `extracted_source`,
  `extracted_confidence`, `extracted_original_value`;
- backfills them from existing non-override dates;
- adds an undated lookup index and a date-override active index.

Catalog schema version: 4.

### Testing

- Contract tests for new channels, params, and `isOverride`.
- Unit tests for date parsing, priority, fallback, and suspicious dates.
- ExifTool extraction tests with grouped tag fixtures.
- Real ExifTool integration test against a JPEG written with EXIF/GPS metadata.
- Repository tests for override set/clear, rescan preservation, and undated
  pagination.
- Renderer tests for Date unavailable assignment and viewer date dialog.
- E2E: scan a suspicious-date JPEG, assign July 2011, open the item, clear the
  override, and verify it returns to Date unavailable.
- Packaged smoke verifies ExifTool works after ASAR packaging.

### Known limits

- EXIF timezone offsets are preserved in metadata but not applied to the
  resolved wall-clock value.
- Date override history is stored in `date_overrides` but there is no history UI.
- Old camcorder metadata coverage depends on ExifTool and the container; files
  without dates remain undated.
- ExifTool does not add codec playback or thumbnails for unsupported video.
  Those need a separate ffmpeg decision.
- The manual 100,000-item performance check remains outstanding.

---

## Phase 4 - Integrity

Status: implemented and verified.

Phase 4 adds Library health: exact duplicate groups, missing files, moved-file
confirmation, and whole-catalog validation. All operations are read-only against
original files.

### Decisions

- Duplicate detection covers **all catalog files**, not only photos and videos.
- Deep validation **recomputes SHA-256** for every checked file and updates the
  catalog hash when content changed.
- Validation covers the **whole catalog** by default.
- Metadata revalidation **updates extracted metadata and dates** while preserving
  active manual date overrides.
- Moved-file confirmation **rechecks existence and SHA-256** before updating a
  catalog path.

### Duplicates

- Exact duplicates are files with the same complete SHA-256 and present state.
- `duplicate_groups` and `duplicate_members` are rebuilt:
  - after a scan finalizes;
  - when Library health loads duplicate groups;
  - after a validation run completes.
- The Duplicates tab reports group count, file count, total bytes, every copy's
  path, and media links where applicable.
- Memory Lane tiles show a **Duplicate** badge when the file is in a group.
- No delete, move, rename, or cleanup action is offered.

### Missing files and moved candidates

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

### Validation

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

### Library health UI

Route `/health`, sidebar destination with missing/moved issue count.

- Header: duplicate groups, missing files, moved candidates, last validation.
- Missing files tab: moved-candidate batch selection, confirm/dismiss, missing
  table.
- Duplicates tab: grouped copies with paths, sizes, and media links.
- Validation tab: level selection, run/pause/resume, progress, report, errors.
- All mutations invalidate health and library queries.

### Tests

- Repository tests for duplicate rebuild, missing/moved listing, confirmation,
  dismissal, validation progress, missing marking, and hash updates.
- Handler tests for every health database method.
- Health service tests for moved revalidation, stale-session recovery, and
  validation completion.
- Renderer tests for tab navigation and validation start.
- E2E: scan duplicate files, inspect the duplicate group, run validation across
  the catalog, and see the completed report.
- Coverage includes the critical `src/main/db/**` branch threshold.

### Known limits

- Validation report counts are per check result, not a deduplicated per-file
  outcome.
- Missing/moved actions are unavailable while the archive drive is offline.
- Duplicate rebuild is write work inside the DB worker; very large duplicate
  sets should be benchmarked.
- Validation pause is cooperative between files; a large in-flight hash finishes
  before pausing.
- Manual validation history UI is intentionally out of scope; the database keeps
  sessions/results.

---

## Phase 5 - Other files and settings

Status: implemented and verified.

Phase 5 completes the remaining v0.1 screens: a browsable Other files
catalog, cache controls, catalog details, scheduled SQLite backups, and app
information.

### Decisions

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

### Other files

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

### Settings

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

### Backups

- Backup directory: `%LOCALAPPDATA%\MemoryLane\backups\<volume-id>\`.
- Files: `catalog.db` and `app.db`.
- Triggered manually, every 15 minutes, and on graceful shutdown.
- `backup_history` records success or failure; `registered_drives.last_backup_at`
  records the last successful backup.
- Overlapping scheduled runs are skipped while one backup is in flight.
- If no catalog is open, scheduled runs are ignored.
- Manual recovery: close Memory Lane, copy the backup files next to the
  original database paths, and reopen the app.

### Tests

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

### Known limits

- Each backup overwrites the previous snapshot; there is no retention policy.
- Backups only run while the app is open (plus graceful close); there is no
  Windows service or scheduled task.
- Cache clearing is all-or-nothing.
- Other files filtering uses the catalog schema as-is; large-catalog index
  tuning belongs to Phase 6.
- No restore UI and no in-app document/PDF/audio viewer are included in v0.1.

---

## Phase 6 - Hardening

Status: automated hardening implemented; manual release pass pending.

Phase 6 closes the gap between feature-complete v0.1 and a release candidate.
It adds larger performance coverage, disconnect and recovery drills, security
gates, stronger package verification, and a documented release checklist.

### Delivered in this phase

#### Performance

- The automated catalog test now exercises **100,000 files** by default and
  checks timeline paging, summary, month index, and Other files category
  queries.
- Set `MEMORY_LANE_PERF_200K=1` to run the same test with **200,000 files**.
  Both sizes have passed in-memory; real-drive memory measurement is still part
  of the manual release pass.
- Queries must finish within a 5-second budget.
- `npm run test:perf` runs only the large-catalog test.

#### Disconnect and unclean shutdown

- `ScanService` accepts a drive-availability checker (defaulting to a root
  `fs.access`).
- An integration test simulates a mid-scan disconnect, asserts the persisted
  `error` state and message, restores availability, and resumes to completion.
- A worker-level drill starts a scan, closes the database worker without a
  graceful scan stop, reopens the catalog, and confirms `recoverInterruptedScans`
  reports `interrupted`.

#### Recovery drill

- An integration test scans a file, creates a SQLite backup, closes the worker,
  deletes both live databases, restores `catalog.db` and `app.db` from the
  backup, reopens the catalog, and reads the file again.

#### Security

- IPC sender validation now accepts only:
  - the exact packaged renderer `file://` document (including hash routes); or
  - the exact configured development origin.
- CSP remains script-self-only and now adds `object-src 'none'`,
  `base-uri 'none'`, `form-action 'none'`, and `frame-src 'none'`; the unused
  `http://localhost:*` connection source was removed.
- A read-only guard scans main-process TypeScript for direct filesystem write
  APIs and fails unless the file is explicitly allowlisted.
- See `../release/security-review.md` for the full review and residual risks.

#### Packaging and release

- `verify:package` now checks the unpacked executable, installer, portable
  executable, blockmap, `app.asar`, the SQLite native binary, and ExifTool.
- It writes SHA-256 checksums to `release/SHA256SUMS.txt`.
- The packaged smoke now covers scan, library, Other files, Settings, backup,
  and cache clearing.
- `../release/release-checklist.md` documents clean-VM install, uninstall, codec,
  disconnect, recovery, and real-archive checks.

### Manual release pass still required

These cannot be completed inside the development environment:

- Run the 200,000-file performance pass on a real drive profile and record
  process memory.
- Physically disconnect and reconnect a USB archive during a scan.
- Play the codec matrix on a clean Windows VM.
- Install, launch, uninstall, and reinstall the NSIS package on a clean VM.
- Verify the portable executable on a clean VM without Node installed.
- Restore from a backup made on the real archive drive.
- Validate a real 2 TB USB 3 archive, including disconnect/reconnect and resume.

### Exit criteria

Phase 6 is complete when `check:full`, packaging verification, packaged smoke,
the 200,000-file run, and the manual release checklist all pass on the release
candidate.

---

## Post-Phase 6 polish

Status: implemented after Phase 6 automation, before the manual release pass.

- Catalog schema 6 adds `files.frame_rate` and backfills it from existing
  `media.frameRate` entries. ExifTool reads QuickTime, RIFF, Matroska, MPEG,
  Composite, and generic frame-rate tags; rational values such as `30000/1001`
  are converted to decimal fps.
- The viewer details panel shows a **Frame rate** row for videos when the
  catalog has a positive value.
- Settings cache statistics read from `cache_entries` instead of walking the
  cache directory, keeping the page responsive for large caches.
- App-wide dark scrollbar styling matches the rest of the UI.
- Returning from the viewer restores the library filter, density, year/month
  anchor, and scroll position instead of jumping back to the top.

