# Roadmap

Last updated: 2026-10-31

## Current state

Phases 0-2 are implemented and integrated on `main`:

- Electron shell, secure preload/IPC, DB worker, migrations, drive identity,
  logging, quality gates, and Windows packaging.
- Drive selection and setup, four-stage scanning, pause/resume/intensity,
  interruption recovery, incremental changes, missing/moved detection, and the
  completion report.
- Memory Lane timeline, virtualized grid, filters, density, year/month
  navigation, thumbnail prioritization, combined photo/video viewer, details,
  reveal/open-external, and scan handoff.

Verification at the Phase 2 integration point: 252 unit/integration tests,
4 Electron E2E flows, coverage above the configured floors, and a packaged scan
plus library query smoke test.

## Immediate follow-ups

1. Run the manual 100,000-item performance check on a real drive profile. The
   automated suite covers 10,000 items.
2. Record actual video codec support from Chromium and confirm the
   open-externally fallback for unsupported files.
3. Validate scan and browsing behavior against a real 2 TB USB 3 archive,
   including disconnect and reconnect.

## Phase 3 - Dates

Goal: resolve dates honestly and let the user assign dates without touching
original files.

- Add metadata extraction beyond the current filesystem fallback:
  - EXIF `DateTimeOriginal`;
  - EXIF `CreateDate` / `DateTimeDigitized`;
  - video creation/recording timestamps;
  - XMP dates;
  - filesystem creation and modification dates as fallbacks.
- Store resolved date, precision (`year`, `month`, `exact`), source, confidence,
  and original value.
- Flag suspicious dates instead of confidently placing them in the timeline.
- Add the Date unavailable screen and undated count navigation.
- Implement individual and bulk year/year-month assignment.
- Make overrides catalog-only, reversible, and auditable.
- Add the viewer Set date action.
- Add contract, repository, component, integration, and E2E coverage.

Exit criteria: undated items can be resolved without inventing a day, manual
overrides preserve the extracted value, and originals remain unchanged.

## Phase 4 - Integrity

Goal: one Library health hub with no destructive actions.

- Group exact duplicates by SHA-256 and show every copy.
- Surface missing files with former locations and preserve their catalog rows.
- Present hash-matched moved candidates as a batch, with per-file confirmation.
- Implement the four validation levels: existence, basic metadata, deep SHA-256,
  and metadata revalidation.
- Add last-run validation reporting and pause/resume for deep hashing.
- Add Library health tabs and E2E coverage.

Exit criteria: duplicates, missing files, moved files, and validation work from
one hub, and no action deletes, moves, or renames an original.

## Phase 5 - Other files and settings

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
