# Memory Lane - v0.1 Scope and Implementation

**Status:** Phases 0-5 implemented. Phase 6 (hardening) is next.
**Platform:** Windows desktop
**Last updated:** 2026-10-31
**Companions:** `Memory_Lane_Product_Specification.md`, `roadmap.md`,
`scan-contract.md`, `library-contract.md`

---

## 1. Purpose

This document defines the v0.1 scope and the architecture that is actually
implemented. It replaces the original planning document, which described future
phases as if they were already built.

The guiding rule remains:

> Every control in the UI must map to a planned, testable feature that preserves
> the read-only archive promise.

---

## 2. Delivered state

| Phase | Status | Delivered |
|---|---|---|
| 0 - Foundation | Complete | Electron shell, secure preload/IPC, DB worker, SQLite migrations, drive identity, logging, quality gates, packaging |
| 1 - Drive and scan | Complete | Drive gate, catalog setup, four-stage scan, pause/resume/intensity, interruption recovery, incremental changes, completion report, drive drawer |
| 2 - Memory Lane | Complete | Timeline, virtualized grid, filters, density, year/month navigation, viewport-priority thumbnails, photo/video viewer, details, reveal/open, scan handoff |
| 3 - Dates | Complete | ExifTool extraction, EXIF/XMP/video date resolution, Date unavailable, manual overrides, suspicious-date review |
| 4 - Integrity | Complete | Duplicates, missing/moved management, validation, Library health |
| 5 - Other files and settings | Complete | Category browser, cache controls, PC backup status, Settings |
| 6 - Hardening | Next | Large-archive performance, disconnect recovery, codec matrix, clean-VM release pass |

Verified at the Phase 5 integration point:

- 308 unit/component/integration tests across 66 files.
- 7 Electron E2E flows, including setup -> scan -> Memory Lane -> viewer,
  Date unavailable, Library health, and Other files/Settings backups.
- Coverage above the configured floors, including the critical database branch
  threshold.
- Windows NSIS installer and portable build produced, verified, and smoke-tested.
- The packaged smoke resolves an EXIF date through the packaged ExifTool binary.

Known gaps:

- The automated performance suite covers 10,000 items; the manual 100,000-item
  check and an ExifTool mixed-corpus benchmark are still outstanding.
- Backups run only while Memory Lane is open and overwrite the latest snapshot;
  recovery is manual and there is no restore UI in v0.1.
- ffmpeg/ffprobe and Sharp are not dependencies of the current build. ExifTool
  does not add playback or thumbnails for unsupported video.

---

## 3. v0.1 scope

### 3.1 In scope

**Archive and drives**

- External volumes only, one active archive at a time.
- Stable volume identity, not drive-letter identity.
- Existing-catalog open, new-catalog setup, and changed-letter confirmation.
- Connection state, capacity, last scan, and indexed item count.
- Per-drive SQLite catalog stored in `.memorylane` on the drive.

**Catalog and scanning**

- Catalog every file type; browse photos and videos first.
- Four independent stages: catalog, metadata, thumbnails, hashes.
- Explicit start, pause, resume, and intensity control.
- Safe stop on app close or disconnect; resume is always explicit.
- Incremental scans, missing-file marking, moved-candidate hashes, and a
  completion report.
- Original folders are never reorganized and original files are never written.

**Memory Lane**

- One chronological timeline for photos and videos.
- All / Photos / Videos filters and Comfortable / Dense density.
- Year chips and previous/next month navigation.
- Date-grouped sections that honor stored precision.
- Virtualized grid with lazy thumbnails and missing/pending/failed states.
- Viewport-priority thumbnail requests that preempt bulk scan work.

**Viewer**

- Combined photo/video route with filter-aware previous/next navigation.
- Photo fit/100%; native HTML5 video playback with external-open fallback.
- Date, format, size, dimensions, duration, and technical metadata.
- Original path, Reveal in Explorer, and Open externally.
- Missing and unsupported states that retain catalog metadata.

**Dates (Phase 3)**

- Resolved date, precision, source, confidence, and original value.
- Date unavailable collection.
- Individual and bulk year/year-month assignment.
- Catalog-only overrides that never modify originals.
- Suspicious-date flags instead of confident placement.

**Integrity (Phase 4)**

- SHA-256 duplicate groups with every copy listed.
- Missing-file list with former locations.
- Hash-matched moved-file candidates with batch confirmation.
- Four validation levels and a last-run report.
- Informational language only; no cleanup actions.

**Other files and settings (Phase 5)**

- Category-based browser for every non-media catalog file.
- Metadata, external open, reveal, and missing-file visibility.
- Cache size and confirmed manual clear.
- Catalog location and PC backup status.
- Manual, scheduled (15-minute), and graceful-close SQLite backups.
- Background-controls link and About.

### 3.2 Out of scope for v0.1

- Moving, renaming, editing, deleting, or reorganizing originals.
- In-app document, PDF, or ebook viewers.
- Cloud upload, accounts, telemetry, or external APIs.
- Combining multiple source drives into one live catalog.
- Partial backups to destination drives.
- User collections, favorites, tags, ratings, or star ratings.
- Advanced search and saved queries.
- Automatic date inference from filenames or folder names.
- RAW editing or non-destructive develop adjustments.
- Cache relocation to the PC.
- Catalog restore UI, drive formatting, or drive repair.
- Auto-update.

### 3.3 Post-v0.1 candidates

- Partial multi-drive backups with verified coverage.
- Places map for valid GPS metadata only.
- Local AI non-memory classification with review-only, reversible suggestions.
- Search and saved filters.
- Favorites and collections.

---

## 4. Screens

### 4.1 Implemented

| Route | Screen | Notes |
|---|---|---|
| `/` | Drive selection | Open existing catalog, set up a new archive, review a changed letter, inspect offline drives |
| `/scan` | Scan & processing | Idle, active, paused, interrupted, error, and complete states; four stage cards; intensity control |
| `/library` | Memory Lane | Timeline, filters, density, year/month navigation, virtualized grid |
| `/library/item/:fileId` | Media viewer | Photo/video stage, details, previous/next, reveal/open |

The app shell provides the sidebar, top bar, drive drawer, and breadcrumbs.
Drive selection is the only route without the app shell.

### 4.2 Planned

| Screen | Phase | Purpose |
|---|---|---|
| Date unavailable | 3 | Review undated items and assign year/year-month in bulk |
| Library health | 4 | Missing files, duplicates, and validation tabs |
| Other files | 5 | Category browser for non-photo/video files |
| Settings | 5 | Background controls, cache, catalog, backup, About |

No planned screen may add a mutation path to original files.

---

## 5. Architecture

### 5.1 Process model

```text
Renderer (React + TypeScript)
   | narrow, validated preload API
   v
Electron main process (trusted Node.js)
   |-- App, drive, scan, library, media, and shell services
   |-- Typed RPC client to the database worker
   v
Database worker (dedicated worker_threads)
   |-- better-sqlite3
   |-- app.db on the PC
   |-- active catalog.db on the archive drive
   |-- repositories and migrations
```

Rules:

- The renderer has no Node.js or filesystem access.
- The preload exposes only typed, Zod-validated operations.
- The DB worker is the single SQLite writer for both databases.
- The main process never opens SQLite directly.
- Source files are opened read-only.
- Reveal/open actions resolve a catalog file ID to a path in the main process.
- There is no IPC channel for delete, move, rename, or source mutation.

### 5.2 Repository layout

```text
src/
  main/
    bootstrap/        app paths, security handlers
    clients/          typed DB-worker RPC client
    db/               worker-only SQLite access
      migrations/
      repositories/
    ipc/              validated IPC handlers
    modules/
      app/            app info and health
      drives/         drive identity, registration, open/setup
      library/        library queries, reveal/open
      media/          ml-media protocol, scheduler, range responses
      scanning/       scan coordinator, metadata, hashing
    platform/         paths, path guard, catalog lock
  preload/            contextBridge API
  renderer/           React app and feature modules
  shared/             contracts, errors, platform-neutral types
tests/
  integration/        real SQLite and temp-filesystem flows
  e2e/                Playwright Electron flows
```

Main-process modules follow `domain` / `application` / `infrastructure` where a
module has enough behavior to justify the split. The renderer is feature-based
under `src/renderer/src/features`.

### 5.3 Read-only enforcement

- Source files are opened with read access only.
- Writable roots are limited to app-managed locations:
  - `<drive>\.memorylane`;
  - `%LOCALAPPDATA%\MemoryLane` or `MemoryLane-dev`;
  - application logs and backups.
- No UI verb implies source modification.
- Path guards validate catalog-owned roots and catalog IDs.
- Tests cover the read-only IPC surface and path boundaries.

Windows access-time updates are not currently suppressed. Whether to suppress
them remains an open decision; the current app does not write file contents or
filesystem metadata.

### 5.4 Data model

Both databases are owned by the DB worker.

**`app.db` - PC installation state**

| Table | Purpose |
|---|---|
| `app_settings` | Installation preferences |
| `registered_drives` | Known volumes, last path/letter, catalog schema, scan stats, last backup |
| `backup_history` | PC catalog backup records |
| `backup_destinations` | Reserved for the future partial-backup workflow |
| `schema_migrations` | Applied migrations |

**`catalog.db` - per archive drive**

| Table | Purpose |
|---|---|
| `drive_identity` | Self-recorded volume identity and catalog schema |
| `catalog_settings` | Archive-scoped settings |
| `scan_roots` | Explicit scan roots |
| `scan_sessions` | Scan runs, intensity, progress, report counters |
| `scan_stages` | Per-stage progress |
| `files` | Paths, size, timestamps, media class, format, MIME, dimensions, duration, state |
| `file_metadata` | Extracted metadata with provenance |
| `file_dates` | Resolved and extracted date, precision, source, confidence, original value, override flag |
| `date_overrides` | Manual year/year-month assignments with revert history |
| `hashes` | SHA-256 records |
| `duplicate_groups`, `duplicate_members` | Hash-based duplicate structure |
| `missing_files` | Current missing state |
| `moved_candidates` | Hash-matched relocations |
| `validation_sessions`, `validation_results` | Validation structure |
| `cache_entries` | Thumbnail and preview cache records |
| `schema_migrations` | Applied catalog migrations |

Catalog migration 3 added media dimensions, video duration, and the timeline
index. Migration 4 added extracted-date fields for reversible overrides and
undated lookup indexes. Migration 5 added validation progress, current level,
error state, and per-result levels. Phase 5 reuses the existing
`backup_history` and `registered_drives.last_backup_at` fields and adds no
catalog migration.

### 5.5 Scan pipeline

1. **Catalog files** - enumerate paths and basic filesystem metadata, compare
   with the previous scan, and mark missing files.
2. **Extract metadata** - classify media, read selected ExifTool tags for dates,
   dimensions, duration, camera, codec, and GPS; fill gaps with the
   dependency-free readers; resolve the final date through the priority chain.
3. **Generate thumbnails** - Electron `nativeImage` thumbnails into
   `.memorylane/cache/thumbs`.
4. **Calculate hashes** - streamed SHA-256 with file-level resume.

Browsing becomes available after the catalog stage. Interactive thumbnail
requests use the same scheduler as bulk scan work and take priority. See
`scan-contract.md` for the full contract.

### 5.6 Library and media

- Keyset cursor pagination over indexed date queries; no offset paging.
- A 10,000-item integration test verifies timeline, summary, and month index
  queries.
- `ml-media:` serves on-demand thumbnails and ranged media from catalog IDs.
- Range responses return `206` with `Content-Range` for video seeking.
- Failed thumbnails and missing originals return explicit 404 or null states.
- The renderer uses TanStack Virtual for the grouped grid.

See `library-contract.md` for channels, ordering, and presentation rules.

### 5.7 Other files and PC backups

- `/files` filters `media_class = 'other'` rows into Documents, Spreadsheets,
  Presentations, PDFs, Audio, Archives, and Other.
- Results use offset pagination at 50 rows per page and show category counts
  across the whole catalog.
- Present files open externally or reveal in Explorer; missing files remain
  visible and disable both actions.
- `/settings` reports generated-cache size, catalog path/size, backup location
  and last result, plus app/offline information.
- Clearing generated cache removes `<catalog-dir>/cache` and `cache_entries`
  rows. Catalog rows, metadata, date overrides, and originals are untouched.
- `catalog.db` and `app.db` are backed up with the SQLite online backup API
  every 15 minutes and on graceful close to
  `%LOCALAPPDATA%\MemoryLane\backups\<volume-id>\`.
- Backup success/failure is recorded in `backup_history`; recovery is manual in
  v0.1 and there is no restore UI.

See `other-files-contract.md` and `settings-contract.md` for the full contracts.

### 5.8 Technology

Current runtime and build stack:

| Layer | Choice |
|---|---|
| Desktop shell | Electron 42 |
| Build | electron-vite 3 |
| Packaging | electron-builder: NSIS per-user installer + portable executable |
| Renderer | React 19 + TypeScript + React Router HashRouter |
| Server state | TanStack Query |
| Virtualization | TanStack Virtual |
| Styling | CSS Modules + design tokens + Lucide icons |
| Contracts | Zod |
| Database | better-sqlite3 in a dedicated worker |
| Metadata | ExifTool 13.60 through `exiftool-vendored` |
| Logging | electron-log |
| Tests | Vitest, Testing Library, Playwright Electron |
| Quality | ESLint, Prettier, dependency-cruiser, knip, file-size check |
| CI | GitHub Actions on Windows |

Planned additions are adopted only when the owning phase needs them. ffmpeg
and/or ffprobe may still be needed for thumbnails or playback of formats
Chromium cannot handle; that is a separate decision from metadata extraction.

### 5.8 Packaging and distribution

- Unsigned Windows x64 build, no auto-update.
- NSIS per-user installer and portable single-file executable.
- `electron-builder` uses `npmRebuild: false`; native modules are rebuilt for
  the Electron ABI before build.
- `better-sqlite3` is unpacked from ASAR.
- A packaged smoke test launches the built app, scans a fixture drive, and
  queries the resulting library.
- Artifacts:
  - `release/Memory-Lane-Setup-<version>-x64.exe`
  - `release/Memory-Lane-<version>-x64.exe`
  - `release/win-unpacked/Memory Lane.exe`

SmartScreen may warn because the build is unsigned. There is no signing
certificate, release channel, or auto-updater.

---

## 6. Quality gates

### 6.1 Structural limits

| Rule | Limit |
|---|---|
| File length, physical lines | 400 hard |
| File length, soft target | 300 |
| Function length | 100 |
| Cyclomatic complexity | 10 |
| Cognitive complexity | 15 |
| Maximum nesting | 4 |
| Maximum parameters | 4 |
| Nested callbacks | 3 |

Exceptions must be narrow, justified, reviewed, and recorded in
`quality-exceptions.md`.

### 6.2 Coverage floors

- 80% lines, statements, and functions.
- 75% branches.
- 90% lines, statements, functions, and branches for `src/shared/**` and
  `src/main/db/**`.

Coverage is a floor, not a target to game. Critical failure paths are reviewed
even when the aggregate number is green.

### 6.3 Test layers

| Level | Tool | Scope |
|---|---|---|
| Unit | Vitest | Pure rules, contracts, formatting, timeline grouping |
| Component | Vitest + Testing Library | Renderer screens, states, and interactions |
| Integration | Vitest + real SQLite + temp filesystem | Repositories, migrations, scan coordination, media protocol, library queries |
| E2E | Playwright Electron | Drive setup, scan, library browsing, viewer navigation, bridge contracts |
| Smoke | Packaged app | Launch, render, scan a fixture drive, query the library |

E2E rules: temporary userData and fixture drive, no real archive, no fixed
sleeps, trace on failure.

### 6.4 CI

GitHub Actions runs on `windows-latest`:

- `npm ci`
- typecheck, lint, format check, file-size, dependency-cruiser, knip
- unit/component/integration tests with coverage
- Electron rebuild, build, Playwright E2E
- NSIS and portable packaging
- artifact verification and packaged smoke
- artifact upload

`npm run check:full` is the local equivalent.

---

## 7. Decisions and open items

Resolved:

- Volume-based drive identity with changed-letter confirmation.
- Single DB worker as the only SQLite writer.
- Per-drive catalog in `.memorylane`.
- Contract-first typed IPC with Zod envelopes.
- Keyset cursor pagination for the timeline.
- `ml-media` protocol for thumbnails and ranged media.
- Shared interactive/bulk thumbnail scheduler.
- Unsigned Windows distribution with no auto-update.

Open:

- ExifTool concurrency and performance on a 100k mixed corpus.
- Timezone conversion policy when EXIF wall-clock dates are displayed outside
  the capture timezone.
- Supported image/video formats and codec matrix; whether ffmpeg is needed for
  playback/thumbnails.
- Access-time preservation policy.
- Behavior for encrypted, corrupt, permission-restricted, or unreadable files.
- Backup retention and manual recovery procedure.
- Exact validation outcome wording and thresholds.
- Future partial-backup schema and coverage definition.
- Search design and whether SQLite FTS5 is required.

---

## 8. Related documents

- `Memory_Lane_Product_Specification.md` - product requirements.
- `roadmap.md` - delivered phases and remaining work.
- `phase-3-scope.md` - implemented date extraction, overrides, and Date unavailable.
- `phase-4-scope.md` - implemented duplicates, missing/moved files, and validation.
- `scan-contract.md` - scan IPC and state contract.
- `library-contract.md` - library IPC and media contract.
- `health-contract.md` - Library health IPC and validation contract.
- `agent-workstreams.md` - parallel agent rules.
- `quality-exceptions.md` - approved exceptions.
- `adr/` - architecture decision records.
