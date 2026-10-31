# Roadmap

Last updated: 2026-10-31

## Current state

Phases 0-5 are implemented, and Phase 6 automated hardening is in place:

- Electron shell, secure preload/IPC, DB worker, migrations, drive identity,
  logging, quality gates, and Windows packaging.
- Drive selection and setup, four-stage scanning, pause/resume/intensity,
  interruption recovery, incremental changes, missing/moved detection, and the
  completion report.
- Memory Lane timeline, virtualized grid, filters, density, year/month
  navigation, thumbnail prioritization, combined photo/video viewer, details,
  reveal/open-external, and scan handoff.
- ExifTool-based date and video metadata extraction, a deterministic date
  priority chain, suspicious-date handling, Date unavailable, and catalog-only
  manual overrides.
- Library health with exact duplicate groups, missing/moved-file management,
  four-level whole-catalog validation, duplicate badges, and catalog-only
  actions.
- Other files categories with external open/reveal, Settings with cache
  controls and catalog details, and SQLite backups every 15 minutes and on
  graceful close.
- Hardening: 100k automated performance, simulated disconnect/resume and
  unclean-restart drills, backup-restore drill, tightened IPC/CSP controls, a
  read-only guard, package checksums, and a clean-VM release checklist.

The automated Phase 6 gates are complete. The manual clean-VM, physical USB
disconnect, codec, and 200k release pass remains. See
`docs/release-checklist.md` for the manual sign-off.

Verification at the Phase 6 automated integration point: 315
unit/component/integration tests across 69 files, 7 Electron E2E flows, 100k and
200k in-memory query passes, coverage above the configured floors, and an
expanded packaged smoke test with SHA-256 package checksums.

## Immediate follow-ups

1. Run the 200,000-file performance pass and record process memory.
2. Benchmark ExifTool on a mixed corpus of JPEG, HEIC, MP4/MOV, and legacy
   camcorder files; adjust `maxProcs` if needed.
3. Record actual image/video playback results on a clean Windows VM using
   `codec-matrix.md`.
4. Validate scan, disconnect/reconnect, backup, and restore against a real 2 TB
   USB 3 archive.
5. Install, uninstall, and run the portable build on a clean Windows VM.

## Phase 3 - Dates (delivered)

- ExifTool 13.60 via `exiftool-vendored` is the primary extractor, with the
  existing image-dimension and MP4/MOV readers as fallbacks.
- EXIF, XMP, QuickTime, RIFF/AVI, Matroska, and generic ExifTool date tags feed a
  documented priority chain.
- Resolved date, precision, source, confidence, and original value are stored.
- Suspicious dates are skipped and surfaced in Date unavailable.
- Manual overrides are year/year-month, catalog-only, reversible, and preserved
  across rescans.
- `/undated` supports selection, bulk assignment, and pagination.
- The viewer supports Set date and Clear manual date.
- ExifTool is unpacked from ASAR and verified by the packaged smoke test.

Known limits: EXIF timezone offsets are preserved but not applied to the
wall-clock date; legacy camcorder metadata depends on the container; ExifTool
does not add playback or thumbnails for unsupported video.

## Phase 4 - Integrity (delivered)

- Duplicate detection covers all catalog files and rebuilds after scans and
  validation.
- Memory Lane tiles show duplicate badges.
- Missing files retain catalog rows and former paths.
- Moved candidates are rechecked by existence and SHA-256 before a batch
  confirmation updates catalog paths.
- Validation supports existence, basic metadata, deep SHA-256, and metadata
  revalidation across the whole catalog, with pause/resume and persisted
  progress.
- Deep validation updates stale hashes; metadata revalidation preserves manual
  date overrides.
- Library health is available at `/health`.

Known limits: validation report counts are per-result checks, pause is
cooperative between files, and very large duplicate sets still need a performance
benchmark.

## Phase 5 - Other files and settings (delivered)

- `/files` browses every non-media catalog file by category, with counts,
  pagination, external open, and reveal.
- Missing files remain visible and disable open/reveal.
- `/settings` shows generated cache size/location with confirmed clearing,
  catalog path/size, backup status/location, background-controls link, and About.
- `catalog.db` and `app.db` receive SQLite online backups every 15 minutes and
  on graceful close.
- Backup results are recorded, failures are visible in Settings, and recovery is
  documented as manual.
- Cache clearing removes generated files and `cache_entries` only; originals,
  catalog rows, metadata, and overrides are preserved.

Known limits: the latest backup set is overwritten, backups only run while the
app is open, cache clearing is all-or-nothing, and no restore UI ships in v0.1.

## Phase 6 - Hardening (automated complete, manual pass pending)

Automated:

- 100,000-file catalog performance across timeline, summary, month index, and
  Other files; 200,000-file mode via `MEMORY_LANE_PERF_200K=1`.
- Simulated USB disconnect, persisted error, resume after reconnect.
- Worker-level unclean restart recovery to `interrupted`.
- Backup and restore drill for both databases.
- Exact IPC sender validation, tightened CSP, and a static read-only guard.
- Package verification of native/runtime binaries and SHA-256 checksums.
- Packaged smoke covers scan, Other files, Settings, backup, and cache clearing.
- Codec matrix and release checklist documented.

Manual:

- Clean Windows VM install, launch, uninstall, and portable run.
- Physical USB disconnect/reconnect during a real scan.
- Actual image/video playback matrix.
- Real 2 TB archive scan, browsing, backup, and recovery.
- 200,000-file run with memory measurement.
- Final acceptance sign-off.

Exit criteria: the packaged build passes E2E and smoke tests, automated gates are
green, the manual release checklist is signed, and the v0.1 acceptance criteria
are met.

## Post-v0.1 candidates

These are not part of v0.1 acceptance:

- **Partial backups to destination drives** - record and verify which source
  files are copied to each destination, with coverage by verified bytes.
- **Places map** - local-only globe for items with valid GPS metadata; items
  without GPS are excluded, never guessed.
- **Non-memory images** - local-only classification of screenshots, receipts,
  documents, and similar images with review-only, reversible suggestions.
- **Search and saved filters** - keyword search over filenames, paths, and
  metadata.
- **Favorites and collections** - user-defined organization that does not modify
  originals.

Each future feature needs its own ADR, migration, privacy review, acceptance
criteria, and tests before implementation.
