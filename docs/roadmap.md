# Roadmap

Last updated: 2026-10-31

## Current state

Phases 0-4 are implemented:

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

Verification at the Phase 4 integration point: 291 unit/component/integration
tests, 6 Electron E2E flows, coverage above the configured floors, and a
packaged smoke test that resolves an EXIF date through the packaged ExifTool
binary.

## Immediate follow-ups

1. Run the manual 100,000-item performance check on a real drive profile. The
   automated suite covers 10,000 items.
2. Benchmark ExifTool on a mixed corpus of JPEG, HEIC, MP4/MOV, and legacy
   camcorder files; adjust `maxProcs` if needed.
3. Record actual video codec support from Chromium and confirm the
   open-externally fallback for unsupported files.
4. Validate scan and browsing behavior against a real 2 TB USB 3 archive,
   including disconnect and reconnect.

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

## Phase 5 - Other files and settings (next)

Goal: complete the remaining v0.1 screens.

- Category-based Other files browser with external open and reveal.
- Settings: background controls, cache size and clear, catalog location, PC
  backup status/location, and About.
- Cache cleanup that never affects originals or catalog rows.
- SQLite-safe PC backup on a 15-minute schedule and on graceful close.
- Drive drawer polish and remaining empty/error/disconnect states.

Exit criteria: every visible v0.1 control maps to an implemented feature.

## Phase 6 - Hardening

- 100k-200k file performance and memory tests.
- USB disconnect, unclean shutdown, and resume tests.
- SQLite backup and manual recovery drill.
- Image/video codec matrix.
- IPC, CSP, and read-only security review.
- Full packaged-build E2E on a clean Windows VM.
- Installer, portable build, uninstaller, and checksum verification.
- Final acceptance-criteria pass.

Exit criteria: the packaged build passes E2E and smoke tests, quality gates are
green, and the v0.1 acceptance criteria are met.

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
