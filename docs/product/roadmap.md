# Roadmap

Last updated: 2026-11-01

## Current state

Phases 0-5 and post-v0.1 replication are implemented. Phase 6 automated
hardening is complete; the physical-drive, replication, and clean-VM release
pass remains.

- Electron shell, secure preload/IPC, DB worker, migrations, drive identity,
  logging, quality gates, and Windows packaging.
- Four-stage scanning with pause/resume/intensity, interruption recovery,
  incremental changes, missing/moved detection, and a completion report.
- Chronological Memory Lane, virtualized grid, filters, density, year/month
  navigation, viewport-priority thumbnails, and a photo/video viewer.
- ExifTool dates, Date unavailable, and reversible catalog-only overrides.
- Library health with duplicates, missing/moved files, and whole-catalog
  validation.
- Other files categories, Settings, generated-cache controls, and SQLite
  backups every 15 minutes and on graceful close.
- Automated hardening: 100k/200k performance coverage, simulated disconnect and
  unclean-restart drills, backup-restore drill, tightened IPC/CSP controls, a
  read-only guard, package checksums, and an expanded packaged smoke.
- Post-v0.1 replication: adoption of existing destination copies, resumable
  partial runs, local destination libraries and media, complete full copies,
  shortfall/source-growth handling, and metadata-only promotion with rollback.
- WMV/3GP and failed direct-playback videos use a cached FFmpeg-compatible MP4
  copy, with preparation progress and external-open fallback.

Verification at the current integration point: 513 unit/component/integration
tests across 131 files, 10 Electron E2E flows, 100k and 200k in-memory query
passes, coverage above the configured floors, and a packaged smoke with SHA-256
package checksums.

## Delivered phases

| Phase | Outcome | Detail |
|---|---|---|
| 0 | Foundation | Electron shell, DB worker, migrations, drive identity, logging, quality gates, packaging |
| 1 | Drive and scan | Drive gate, catalog setup, four-stage scan, pause/resume/intensity, recovery, report |
| 2 | Memory Lane | Timeline, virtualized grid, filters, viewer, thumbnails, reveal/open |
| 3 | Dates | ExifTool extraction, date chain, Date unavailable, manual overrides |
| 4 | Integrity | Duplicates, missing/moved files, validation, Library health |
| 5 | Other files and settings | Categories, cache controls, Settings, SQLite backups |
| 6 | Hardening | Performance, recovery drills, security gates, package verification |

Phase 3-6 decisions, implementation detail, tests, and known limits are preserved
in [`../archive/phase-history.md`](../archive/phase-history.md).

## Delivered post-v0.1 replication

Adoption-first replication is implemented as a separate post-v0.1 release slice:

- Destination registration and adoption verify existing copies without moving or
  reorganizing them.
- Partial runs fill destinations oldest-first, are resumable, and report the
  exact remainder.
- Full-copy destinations receive every present source file, report shortfalls,
  and never spill into partial destinations.
- Each destination keeps a local library and source index; destination-scoped
  media uses destination IDs.
- A complete full copy can be promoted into the active source without moving
  files. Promotion preserves catalog identity, dates, overrides, duplicates, and
  coverage, and can be rolled back before the first change on the new source.

Specifications:
[`partial-backups.md`](partial-backups.md),
[`replication-implementation-plan.md`](replication-implementation-plan.md),
[`../adr/0008-replication-implementation-boundaries.md`](../adr/0008-replication-implementation-boundaries.md),
[`../adr/0007-promote-full-copy-to-source.md`](../adr/0007-promote-full-copy-to-source.md),
[`../contracts/replication.md`](../contracts/replication.md).

## Remaining work

### Phase 6 manual release pass

1. Run the 200,000-file pass on a real drive profile and record process memory.
2. Physically disconnect and reconnect a USB archive during a scan.
3. Play the codec matrix on a clean Windows VM.
4. Install, launch, uninstall, and run the portable build on a clean VM.
5. Restore from a backup made on the real archive drive.
6. Validate a real 2 TB USB 3 archive, including disconnect/reconnect and resume.
7. Complete the sign-off in
   [`../release/release-checklist.md`](../release/release-checklist.md) and
   [`../release/acceptance.md`](../release/acceptance.md).

### Additional benchmark

Benchmark ExifTool on a mixed corpus of JPEG, HEIC, MP4/MOV, and legacy camcorder
files; adjust `maxProcs` if needed.

### Replication manual release pass

1. Verify a real full copy on a physical destination drive.
2. Promote it to the source archive and inspect the new source and demoted
   destination roles.
3. Roll back before the first change, then confirm rollback is refused after a
   scan or date edit.
4. Physically disconnect and reconnect a destination during a partial run.
5. Record the results in
   [`../release/release-checklist.md`](../release/release-checklist.md).

## Post-v0.1 candidates

These are not part of v0.1 acceptance:

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
