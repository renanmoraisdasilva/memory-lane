# Memory Lane — MVP Scope & Implementation Plan

**Status:** Working scope baseline for v0.1 (interview decisions applied)  
**Implementation status:** Phase 0 foundation and Phase 1 are implemented end to end — Electron shell, secure IPC, DB worker, migrations, drive identity, drive connectivity/letter-change confirmation, scan coordinator with four persisted stages, pause/resume/intensity, interruption recovery, incremental change/missing/moved detection, completion report, drive selection and scan screens, quality gates, E2E, and Windows packaging.

**Platform:** Windows desktop  
**Date:** 2026-10-31  
**Companions:** `Memory_Lane_Product_Specification.md`, `ui-mockups/`

---

## 1. Purpose

This document turns the product specification into a buildable v0.1 scope and a
coherent screen set. It also records the design review of the original Google
Stitch mockups and the decisions made after that review.

The guiding rule is simple:

> Every control in the UI must map to a feature that is planned, testable, and
> consistent with the read-only archive promise.

Anything that does not meet that rule has been removed from the screens or
explicitly deferred to a later phase.

---

## 2. Decisions locked for v0.1

| Area | Decision |
|---|---|
| Navigation | Six flat destinations: **Memory Lane**, **Date unavailable**, **Other files**, **Library health**, **Scan & processing**, **Settings**. Drive status is a drawer from the sidebar. |
| Integrity screens | One **Library health** hub with three tabs: Missing files, Duplicates, Validation. |
| Search | No dedicated search screen in v1. Browse by year/month and local filters. Search is a phase-2 feature. |
| Personal organization | No favorites, collections, tags, or star ratings in v1. |
| Date assignment | Manual only. Year or year/month precision. No automatic inference or heuristic suggestions. |
| Media viewer | One combined viewer template for photos and videos, with type-specific controls. |
| Other files | One category-based browse screen. Metadata plus external open/reveal. No in-app document viewer. |
| Drive management | Drive selection gate plus an in-app drive drawer. No separate drive-manager page. |
| Storage sources | External volumes only, one active archive at a time. Other registered drives are visible but cannot be browsed together. |
| Validation | All four levels: existence, basic metadata, deep SHA-256 integrity, and metadata revalidation. |
| Scan changes | Completion summary on the scan screen; detailed missing/moved records in Library health. |
| Settings | Background processing, cache size/clear, database backup status/location, and About. No cache relocation or restore UI. |
| Visual direction | Keep the dark, warm amber archival identity, but unify the shell, spacing, typography, and density. |
| Prototype fidelity | Clickable static prototype with working navigation, tabs, dialogs, and realistic sample data. No real filesystem access. |
| File handling | Replace the original mockups in `ui-mockups/`; obsolete screens are removed. |
| Codebase | Single npm package with layered `src/main`, `src/preload`, `src/renderer`, and `src/shared` modules. Architecture boundaries are enforced by tooling, not convention. |
| Build and packaging | `electron-vite` for development/build and `electron-builder` for Windows packaging. Ship an NSIS per-user installer plus a portable ZIP. Stay unsigned; SmartScreen impact is documented. |
| Frontend stack | React + TypeScript, HashRouter, TanStack Query, Zustand, CSS Modules with design tokens, Radix primitives, Lucide icons, TanStack Virtual. |
| Main-process stack | Node.js + TypeScript, Piscina worker pools, ExifTool, ffmpeg/ffprobe, Sharp, Zod IPC contracts, `electron-log`. |
| Database execution | A dedicated database worker owns `better-sqlite3` and is the single writer for both the PC `app.db` and the active drive's `catalog.db`. The main process never opens SQLite directly. |
| Installation state | A separate SQLite `app.db` on the PC stores window/UI preferences, registered drives, and backup history. `electron-store` is not used. |
| Native binaries | ExifTool, ffmpeg, and ffprobe are fetched from pinned upstream releases, verified against a committed checksum manifest, cached in CI, and copied via `extraResources`. Binaries are not committed to git. |
| Code signing | Remain unsigned indefinitely. SmartScreen warnings are documented; the decision is revisited only if public distribution or user acquisition requires signing. |
| Development model | Contract-first parallel workstreams: Platform/Core and Renderer/UX from Phase 1, plus an optional Quality/Release agent. Path ownership and worktrees are defined in `docs/agent-workstreams.md`. |
| Future features | Globe/Places map for GPS-tagged items only; local AI non-memory classification with review-only behavior. Both are post-v0.1. |
| Quality gates | 400-line hard file limit, 300-line soft target, cyclomatic complexity 10, cognitive complexity 15, 80% overall coverage and 90% for critical modules. Enforced in CI. |

---

## 3. Review of the original mockups

### 3.1 Disposition by screen

| Original screen | Verdict | Disposition |
|---|---|---|
| `drive-selection.html` | Useful concept, heavily overbuilt. Contains NAS, internal folders, SMART, IOPS, worker concurrency, pipeline rules, and cache-location choices. | Rebuilt as a focused drive-selection gate. |
| `drive-manager.html` | Duplicates drive selection and adds out-of-scope operations such as unmounting, WAL flushing, and restore. | Removed. Drive identity and switching move to the gate plus the drive drawer. |
| `chronological-gallery.html` | Right primary experience, but split navigation, favorites, camera/lens overlays, technical EXIF badges, and three density modes add noise. | Rebuilt as **Memory Lane** with photos and videos together. |
| `media-viewer.html` | Core viewer is right, but RAW develop/rotate/crop, ratings, color labels, histogram, GPS map, and “Keep Only This / Clean Up” contradict scope and the read-only promise. | Rebuilt as the photo state of the combined viewer. |
| `video-playback.html` | Core playback is right, but stream-level codec details, collections, tags, and playback-speed controls are excessive. | Folded into the combined viewer as the video state. |
| `new-folder.html` | Actually a Date unavailable screen. Useful, but includes heuristic parsing, inferred dates, confidence scores, source filters, and exact-day assignment. | Rebuilt as **Date unavailable** with manual year/year-month assignment only. |
| `duplicate-management.html` | Core duplicate inspection is right, but audit CSV, hash copying, “primary copy,” and cleanup language exceed the spec. | Folded into **Library health → Duplicates**. |
| `missing-files.html` | Core missing/moved workflow is right, but mixes modified files, validation history, volume diagnostics, exports, and “mark offline.” | Folded into **Library health → Missing files**. |
| `search.html` | Advanced query builder, saved presets, FTS inspector, camera filters, favorites, and collections. | Removed for v1. Search is phase 2. |
| `scan-processing-dashboard.html` | Core staged progress is right, but adds throughput, WAL size, cache size, live event stream, volume diagnostics, and duplicate counts. | Rebuilt as **Scan & processing** with explicit idle/active/paused/interrupted/complete states. |
| `settings.html` | Useful storage/backup content buried under read-only repetition, parser settings, thermal guards, cache relocation, and SQLite maintenance. | Rebuilt with four focused sections. |

### 3.2 Cross-cutting problems found

1. **Three different navigation shells.** Some screens used a sidebar, some a
   top bar, and some a hybrid. Menu labels and groupings changed between
   screens.
2. **Duplicate navigation.** Photos, Videos, Duplicates, and Favorites appeared
   both in the sidebar and in a second top navigation bar.
3. **Photos and videos were split** into primary nav areas, contradicting the
   specification’s single memory collection.
4. **Out-of-scope product surfaces.** Favorites, collections, tags, ratings,
   advanced search, CSV audit exports, drive-unmount controls, cache relocation,
   and RAW editing all appeared as if they were planned.
5. **Read-only contradictions.** The UI promised strict read-only operation
   while offering “Keep Only This,” “Clean Up,” “Safely Unmount,” and catalog
   restore actions.
6. **Fake precision.** The screens displayed throughput, WAL sizes, SMART
   status, IOPS, and “100%” guarantees that are either not implemented or not
   knowable.
7. **Missing screen.** There was no **Other files** screen at all, despite the
   specification requiring category-based access to non-photo/video files.
8. **Missing states.** Scan, drive connection, validation, and empty/error
   states were not represented.

### 3.3 Removed from v0.1

- Favorites, collections, tags, and star ratings.
- Advanced search, saved searches, query language, and search presets.
- RAW develop, crop, rotate, color labels, ratings, and histogram tools.
- GPS maps and offline reverse geocoding.
- “Keep only this,” “Clean up,” delete, move, and rename affordances.
- Duplicate audit CSV/JSON export and hash-copy controls.
- Drive unmount, SMART, IOPS, MFT, and volume bus diagnostics.
- NAS/SMB, internal-folder, and custom-directory sources.
- Cache destination selection and cache relocation.
- Folder-name date inference, heuristic parser, confidence scoring, and suggested
  dates.
- Validation history and volume diagnostics panels.
- Thermal/battery guards, RAM cache caps, regex aggressiveness, and config
  export.
- Telemetry/privacy settings (the app has no telemetry).
- SQLite VACUUM/reindex UI.
- Playback-speed and stream-detail panels.
- Combined multi-drive browsing and the future partial-backup workflow.

---

## 4. Product scope for v0.1

### 4.1 In scope

**Archive and drive**
- Select an external drive.
- Identify it by volume ID, not drive letter.
- Detect an existing catalog on the drive.
- Set up a new catalog in an app-managed folder on the drive.
- Confirm a changed drive letter before updating the catalog root.
- Show connection state and capacity.
- Keep one active archive at a time.

**Catalog**
- Per-drive SQLite catalog.
- Catalog all file types.
- File paths, size, timestamps, extension, detected format, MIME/type class.
- Extracted photo/video metadata.
- Resolved date, precision, source, and confidence.
- Manual date overrides.
- SHA-256 hashes and duplicate groups.
- Scan sessions and stage progress.
- Validation sessions and results.
- Missing-file state and moved-file candidates.
- Cache references and backup history.

**Scanning and processing**
- Explicit **Start scan**.
- Four independent stages: catalog files, extract metadata, generate
  thumbnails, calculate hashes.
- Per-stage progress and totals.
- Pause/resume background processing.
- Processing-intensity control.
- Safe stop on app close or drive disconnect.
- Manual resume; no automatic resumption.
- Incremental scan diff and completion report.

**Browsing**
- One chronological timeline for photos and videos.
- Year/month navigation.
- Dense, virtualized grid.
- Lazy thumbnails with viewport priority.
- All/Photos/Videos filters.
- Date precision and uncertainty communicated.
- Selection for bulk date assignment.

**Viewer**
- In-app photo display.
- In-app video playback.
- Basic metadata.
- Original location and reveal-in-Explorer action.
- Duplicate indicator and all-copy detail.
- Manual date assignment.
- Previous/next navigation.

**Dates**
- Date unavailable collection.
- Individual and bulk assignment.
- Year and year/month precision only.
- Catalog-only overrides that preserve original date metadata.

**Other files**
- Category-based browse for non-photo/video files.
- Metadata and original location.
- Open externally and reveal in Explorer.

**Library health**
- Missing-file list with former locations.
- Moved-file candidates matched by SHA-256.
- Batch confirmation with individual exceptions.
- Duplicate groups with every copy listed.
- Four-level validation with a report.
- Informational-only integrity language; no cleanup actions.

**Storage and settings**
- Cache size and manual clear.
- Catalog database location.
- PC backup status, location, and last backup time.
- Background processing controls.
- About/version/offline information.

### 4.2 Out of scope for v0.1

- Moving, renaming, editing, or deleting original files.
- Reorganizing the archive into new folders.
- In-app PDF, Word, spreadsheet, or ebook viewers.
- Cloud upload, accounts, telemetry, or external APIs.
- Combining multiple source drives into one live catalog.
- Partial backups to destination drives.
- User-defined collections, tags, ratings, or favorites.
- Full-text search UI.
- Automatic date inference from filenames or folder names.
- RAW editing or non-destructive develop adjustments.
- Cache relocation to the PC.
- Restore UI for catalog backups.
- Drive formatting, unmounting, or repair operations.

### 4.3 Deferred to phase 2+

- Quick search and keyword search over filenames/paths/metadata.
- Saved filters and advanced search.
- Favorites and user collections.
- Exact-day manual date assignment.
- Recovery/restore UI from PC backups.
- Cache relocation and cache size limits.
- Multi-drive partial-backup workflow from specification §15.
- Combined multi-drive browsing.
- Additional format/preview support.
- **Globe/Places map** for GPS-tagged photos and videos; items without GPS are
  excluded, never guessed.
- **Local AI non-memory classification** for screenshots, app captures,
  receipts, bank statements, documents, and similar low-value images, with
  review-only behavior and no deletion.
- Optional offline reverse geocoding for map labels.

---

## 5. Screen inventory and navigation

### 5.1 Final screens

| # | Screen | File | Purpose |
|---|---|---|---|
| 0 | Prototype index | `index.html` | Review map for the mockups. Not part of the app. |
| 1 | Drive selection | `drive-selection.html` | Gate for existing catalog, new archive, reconnect, and drive-letter confirmation. |
| 2 | Memory Lane | `chronological-gallery.html` | Chronological photo/video timeline with year/month navigation. |
| 3 | Media viewer | `media-viewer.html` | Combined photo/video viewer with metadata, date override, duplicates, and reveal. |
| 4 | Date unavailable | `date-unavailable.html` | Manual individual/bulk date assignment for undated items. |
| 5 | Other files | `other-files.html` | Category browse for non-photo/video files. |
| 6 | Library health | `library-health.html` | Tabs for Missing files, Duplicates, and Validation. |
| 7 | Scan & processing | `scan-processing-dashboard.html` | Scan lifecycle, stage progress, controls, and completion report. |
| 8 | Settings | `settings.html` | Background processing, storage/cache, database backup, and About. |

The photo and video viewer are **one screen template** with two states, not two
navigation destinations.

### 5.2 Navigation map

```text
Drive selection
   ├─ Open existing catalog ──────────────┐
   ├─ Set up new archive → start scan ────┤
   └─ Reconnect / confirm changed letter ─┤
                                          ▼
                                    Memory Lane
                                    ├─ Media viewer (photo/video)
                                    ├─ Date unavailable
                                    ├─ Other files
                                    ├─ Library health
                                    │    ├─ Missing files
                                    │    ├─ Duplicates
                                    │    └─ Validation
                                    ├─ Scan & processing
                                    └─ Settings
```

Every app screen shares one sidebar, one top bar, and one drive drawer.
Drive selection is the only screen without the app shell.

### 5.3 Sidebar

```text
Memory Lane
Date unavailable      142
Other files
Library health         15
─────────────────────────
Scan & processing       ●
Settings
─────────────────────────
WD My Passport 2TB (E:)
Connected · 1.42 / 2.0 TB
```

- Badges are informational counts, not error counts.
- The scan item shows a small active dot while background work is running.
- The drive card opens the drive drawer.
- There is no second top navigation.
- There is no global search box in v1.

### 5.4 Top bar

Left: breadcrumb, for example `Library / Memory Lane` or
`Memory Lane / Photo`.

Right:
- Background job chip: `Cataloging · 78%` (links to Scan & processing).
- Read-only pill: `Read-only`.
- Page-specific actions live in the page header, not the top bar.

### 5.5 Dialogs and drawers

| Surface | Used by | Purpose |
|---|---|---|
| Drive drawer | All app screens | Identity, capacity, catalog path, last scan, switch drive. |
| Date assignment dialog | Viewer, Memory Lane, Date unavailable | Assign year or year/month to one or many items. |
| Duplicate detail | Viewer, Library health | Show every exact copy with reveal actions. |
| Clear cache confirmation | Settings | Confirm cache deletion; explain regeneration and original-file safety. |
| Changed drive letter confirmation | Drive selection | Confirm updating the catalog root path. |
| New archive setup | Drive selection | Confirm catalog/cache location and start the first scan. |
| Moved-file confirmation | Library health → Missing files | Batch-update catalog paths after hash matches. |
| Toast | All screens | Confirm prototype-only or catalog-only actions without implying file changes. |

---

## 6. Screen requirements

### 6.1 Drive selection

**Purpose:** Choose the archive to open, or set up a new one, without exposing
filesystem engineering details.

**Layout**
- Standalone dark page with wordmark, short read-only statement, and a
  “Rescan drives” action.
- List of external volumes:
  - Connected drive with an existing catalog.
  - Connected drive without a catalog.
  - Previously registered drive that is disconnected.
- Footer note: external drives only; identity is volume-based, not letter-based.

**Content per drive**
- Volume label and assigned letter.
- Connection state.
- Filesystem and capacity.
- Catalog status: found / not found / last seen.
- Last scan and indexed item count where known.

**Actions**
- **Open Memory Lane** for a drive with a valid catalog.
- **Set up this drive** for a connected drive without a catalog.
- **Drive details** (optional modal) for identity and catalog paths.
- **Rescan drives**.
- **Switch drive** returns here from the app drawer.

**States**
- Normal list.
- No external drives detected: instruct the user to connect a drive and rescan.
- Drive connected but catalog unreadable: offer to locate a backup or create a
  new catalog; do not silently overwrite.
- Drive letter changed: show the confirmation dialog before updating the path.
- Drive disconnected during browsing: return to this screen with a clear
  “reconnect the drive” message.

**Explicitly absent**
- NAS/SMB and internal-folder selection.
- SMART, IOPS, MFT, USB bus diagnostics.
- Worker concurrency and parser configuration.
- Cache destination selection.
- Unmount, format, repair, or delete actions.

### 6.2 Memory Lane

**Purpose:** The primary memory experience: one chronological collection of
photos and videos.

**Layout**
- Page header: title, item count, indexed size, last scan.
- Filters: All / Photos / Videos.
- Density toggle: Comfortable / Dense.
- Timeline navigator: year chips and an active month, with previous/next month.
- Day/month/year sections with a header and a visual grid.
- Undated callout at the end: “142 items still need a date.”
- Selection bar when one or more items are selected.

**Grid item**
- Thumbnail.
- Video duration and play glyph for videos.
- Duplicate badge when applicable.
- Filename and size on hover/focus.
- Selection checkbox.
- Date precision is communicated at the section level, not repeated on every
  tile.

**Section header**
- Date label, e.g. `August 18, 2024`, `July 2008`, or `1998`.
- Item count.
- Precision/source marker when not exact: `Month precision`,
  `Year precision`, `Date from file system`, `Manual date`.
- No camera/lens/location line in the grid in v1.

**Actions**
- Click item: open media viewer.
- Select items: bulk **Set date** or clear selection.
- Year chip: scroll to that year.
- Previous/next month: move the active month.
- Undated callout: open Date unavailable.

**States**
- Normal populated timeline.
- Empty filter result.
- Catalog with no media: explain that the scan is still running or that the
  drive contains no photos/videos.
- Thumbnail still generating: skeleton tile with filename.
- Missing file: show a muted tile with a “Missing” badge; clicking opens the
  viewer’s missing state.
- Drive disconnected: banner with reconnect action.

**Explicitly absent**
- Separate Photos and Videos pages.
- Favorites and collections.
- Camera/lens and exposure overlays on every tile.
- Search box.
- Rating stars, color labels, tags.

### 6.3 Media viewer

**Purpose:** View a photo or play a video, inspect its catalog metadata, and
perform catalog-only actions.

**Layout**
- Header: back to Memory Lane, filename, position (`1,482 of 3,920`),
  previous/next.
- Main stage: photo or video.
- Details panel:
  - Date and precision/source.
  - **Set date** action.
  - File facts: format, size, dimensions, duration.
  - Original location + **Reveal in Explorer** + **Open externally** where
    appropriate.
  - Duplicate section when applicable.
  - Collapsible camera/video metadata.
  - Read-only note: catalog changes only.

**Photo controls**
- Fit / 100%.
- Previous/next.
- No rotate, crop, develop, or edit.

**Video controls**
- Play/pause, seek, volume, fullscreen.
- Standard playback; no speed menu or stream inspector.
- Poster frame and duration in the grid.

**Duplicate section**
- “2 exact copies” and each path.
- Reveal each copy.
- No delete, move, rename, “keep only this,” or “clean up.”

**Date override**
- Year and optional month.
- Result preview such as `August 1998` or `1998`.
- Note that original EXIF and filesystem timestamps are untouched.

**States**
- Photo.
- Video.
- Missing file.
- Unsupported format: clear message, external-open action, no crash.
- Thumbnail unavailable: placeholder.
- Duplicate and non-duplicate.
- Drive disconnected: metadata remains visible; media unavailable with reconnect
  message.

**Explicitly absent**
- Ratings, favorites, collections, tags.
- Histogram, GPS map, reverse geocoding.
- RAW develop tools.
- Playback speed and codec tables.
- Cleanup/delete actions.

### 6.4 Date unavailable

**Purpose:** Resolve items without a reliable date, without inventing one.

**Layout**
- Header: count and explanation.
- Selection summary.
- Grid/list of undated items with checkbox, thumbnail, filename, size, folder,
  and current date status.
- Right-side batch assignment panel.

**Batch panel**
- Selected count.
- Year selector.
- Month selector with “Not specified.”
- Result preview.
- **Apply to catalog** action.
- Catalog-only note.

**Actions**
- Select one, many, or all visible.
- Assign year or year/month.
- Open an item in the viewer.
- Clear selection.

**States**
- Items waiting for dates.
- No items waiting: success empty state.
- Applied confirmation toast.
- Invalid/absent year: apply disabled.

**Explicitly absent**
- Folder-name inference, heuristic parser, suggested dates, confidence scores.
- Source filters such as WhatsApp/Camcorder/Recovered.
- Decade shortcuts and exact-day assignment.
- Undo history beyond a simple post-action toast (not required in v1).

### 6.5 Other files

**Purpose:** Make cataloged non-photo/video files discoverable without building
document viewers.

**Layout**
- Header: total count and size.
- Category chips: All, Documents, Spreadsheets, Presentations, PDFs, Audio,
  Archives, Other.
- Table: type icon, name, category, size, modified date, folder, actions.
- Footer: result count and pagination.

**Actions**
- Filter by category.
- Open externally in the default Windows application.
- Reveal in Explorer.

**States**
- Populated table.
- Empty category.
- Unsupported/unreadable file: external open still offered.
- Drive disconnected: rows visible; external actions disabled with explanation.

**Explicitly absent**
- In-app document/PDF/audio preview.
- Editing.
- Search box (phase 2).
- Tags, ratings, collections.

### 6.6 Library health

**Purpose:** One place for integrity information and user-triggered validation.

#### Missing files tab

- Summary: count and media-type breakdown.
- Wording: files may have been moved or removed outside Memory Lane; the app
  did not delete them.
- Moved-file section:
  - Old path → new path.
  - SHA-256 match indicator.
  - Checkbox per match, selected by default.
  - Batch **Update catalog locations**.
  - Per-row **Keep as missing**.
- Missing-file list:
  - Filename, type, former path, last seen, size.
  - “Match found” or “No match.”
  - Pagination.
- No deletion, no "mark offline," no volume diagnostics, no modified-files tab.

#### Duplicates tab

- Summary: sets, files, total size, SHA-256 verified.
- Format filters: All / Photos / Videos / RAW.
- Group list: thumbnail, filename, copy count, per-file size, total size.
- Detail panel: filename, hash status, all copy locations, reveal actions.
- Informational note: all copies are preserved; the app cannot delete, move, or
  rename files.
- No CSV export, hash copy button, “primary copy,” or cleanup actions.

#### Validation tab

- Four independently selectable levels:
  1. Existence.
  2. Basic metadata.
  3. Deep SHA-256 integrity.
  4. Metadata revalidation.
- **Run validation** action.
- Running state with stage progress and pause/resume for deep hashing.
- Report:
  - Verified count.
  - Missing count (links to Missing files tab).
  - Metadata-changed count.
  - Hash-mismatch count.
  - Unreadable count.
  - Duration and timestamp.
- Last run summary only; no full validation history in v1.

**States**
- No issues.
- Issues present.
- Validation idle/running/paused/complete.
- Drive disconnected.
- Corrupt/unreadable catalog (read-only message with recovery guidance).

### 6.7 Scan & processing

**Purpose:** Start, monitor, pause, resume, and review catalog scanning.

**States**
- **Idle:** ready to scan; catalog summary; Start scan.
- **Active:** current stage, four stage cards, counts, progress, pause, intensity.
- **Paused:** progress held; resume; browsing still available.
- **Interrupted:** drive disconnected or app closed; progress saved; manual
  resume only.
- **Complete:** scan report with new/changed/missing/moved counts and links to
  Library health; scan again.

**Stage cards**
1. Catalog files.
2. Extract metadata.
3. Generate thumbnails.
4. Calculate hashes.

Each card shows status (complete/active/queued/paused), count, percentage, and a
short description.

**Controls**
- Start / pause / resume.
- Intensity: Eco / Balanced / Max.
- Link to Settings.
- Resume after interruption; never automatic.

**Completion report**
- New files.
- Changed files.
- Missing files.
- Likely moved files.
- Link to Library health.

**Explicitly absent**
- Throughput and MB/s widgets.
- WAL size and cache size widgets.
- Live event stream / terminal.
- Volume diagnostics.
- Duplicate counters.
- Cancel/destructive scan actions.

### 6.8 Settings

**Purpose:** A small, honest settings surface.

**Sections**
1. **Background processing**
   - Pause/resume.
   - Eco / Balanced / Max intensity.
   - “Browsing and playback always take priority.”
2. **Storage**
   - Thumbnail cache: size, on-drive location, **Clear cache**.
   - Catalog database: location, size, reveal in Explorer.
   - PC backup: status, location, last backup, automatic schedule.
3. **About**
   - Version, platform, offline/no-account statement, read-only archive note.

**Explicitly absent**
- Cache destination choice.
- Restore UI.
- Parser/regex settings.
- Thermal/battery guards.
- RAM cache caps.
- Config import/export.
- SQLite maintenance buttons.
- Telemetry/privacy settings.

---

## 7. Technical architecture

### 7.1 Process model

```text
Renderer (React + TypeScript)
   │  narrow, validated preload API
   ▼
Electron main process (trusted Node.js)
   ├─ Drive identity service
   ├─ Catalog client (typed RPC to the database worker)
   ├─ Scan coordinator
   ├─ Metadata worker pool (Piscina / ExifTool / ffprobe)
   ├─ Thumbnail worker pool (Piscina / Sharp / ffmpeg)
   ├─ Hash worker pool (Piscina / SHA-256)
   ├─ Validation coordinator
   ├─ Cache service
   └─ Backup service

Database worker (dedicated, trusted Node.js)
   ├─ better-sqlite3 connection
   ├─ app.db (PC installation state)
   ├─ catalog.db (active archive drive)
   └─ repositories and migrations
```

Rules:
- The renderer has no Node.js filesystem access.
- All source-drive access happens in the main process or trusted workers.
- The dedicated database worker is the **single SQLite writer** for both
  `app.db` and the active `catalog.db`. The Electron main process never opens
  SQLite directly. Workers do CPU/IO work and return results; they do not open
  write connections.
- Worker pools are bounded with Piscina and split by task class (metadata,
  thumbnails, hashing) so one workload cannot starve the others.
- The preload API exposes catalog IDs and validated operations, not raw
  filesystem mutation primitives.
- There is no IPC channel for delete, move, rename, or write to a source file.
- Reveal/open-external actions take a catalog file ID, resolve the path in the
  main process, and validate that it belongs to the active archive.

### 7.2 Selected stack

| Layer | Choice | Rationale |
|---|---|---|
| Desktop shell | Electron, current stable, pinned exact version | Windows desktop requirement; mature native filesystem access. |
| Build | `electron-vite` | Separate Vite builds for main, preload, and renderer; HMR and fast iteration. |
| Packaging | `electron-builder` | Mature Windows NSIS/portable targets and prebuilt native-module packaging. Signing hooks remain available but are unused in v0.1. |
| Renderer | React + TypeScript | Component model, ecosystem, strong typing. |
| Routing | React Router with `HashRouter` | Works from `file://` in packaged Electron without a custom protocol. |
| Server state | TanStack Query | Caching, loading/error states, invalidation for IPC-backed catalog data. |
| UI state | Zustand | Small stores for selection, viewport, and viewer preferences; no duplication of catalog data. |
| Virtualization | TanStack Virtual | Virtualized photo/video grid and large file tables. |
| Forms | React Hook Form + Zod | Typed date assignment, settings, and validation inputs. |
| Styling | CSS Modules + CSS custom-property tokens | Scoped styles, explicit design system, readable component files. |
| Primitives | Radix UI | Accessible dialog, tabs, tooltip, dropdown, and popover behavior. |
| Icons | Lucide React | Tree-shakeable SVG icons; no multi-megabyte icon font in production. |
| Database | `better-sqlite3` in a dedicated DB worker | Fast synchronous SQLite isolated from the Electron main thread; one writer for `app.db` and the active `catalog.db`. |
| Migrations | Handwritten SQL migrations | Full control over indexes and SQLite behavior; easy to test. |
| Worker pool | Piscina | Bounded worker pools for metadata, thumbnails, and hashing. |
| Metadata | `exiftool-vendored` client + pinned ExifTool binary | Persistent ExifTool process, broad metadata coverage, and embedded RAW previews without spawning per file. |
| Video | ffmpeg + ffprobe, pinned binaries | Metadata, poster frames, and codec inspection. |
| Images | Sharp | Fast thumbnail and preview encoding for standard formats. |
| Hashing | Node `crypto` SHA-256 | No extra dependency; chunked, resumable reads. |
| IPC validation | Zod | One schema source for channel payloads and result envelopes. |
| Logging | `electron-log` | Local, bounded logs in the main process; no telemetry. |
| Installation state | PC `app.db` SQLite | Window/UI preferences, registered drives, backup history, and schema migrations. `electron-store` is not used. |
| Unit/component tests | Vitest + Testing Library | Fast TypeScript-native tests and behavior-focused React tests. |
| E2E tests | Playwright Electron | Real Electron launch, window, IPC, and filesystem fixture flows. |
| Architecture checks | dependency-cruiser | Enforce renderer/main/preload/shared boundaries and no cycles. |
| Dead-code checks | knip | Detect unused files, exports, and dependencies. |
| Lint/format | ESLint flat config + Prettier | Type-aware rules, complexity limits, and consistent formatting. |

Versions are pinned exactly at scaffold time and committed in `package-lock.json`.
Major-version upgrades are deliberate, reviewed changes, not automatic.

#### 7.2.1 Renderer architecture

The renderer is feature-based, not type-based:

```text
src/renderer/
  app/
    bootstrap.tsx
    router.tsx
    providers.tsx
    error-boundaries/
  features/
    drives/
    library/
    viewer/
    undated/
    other-files/
    health/
    scan/
    settings/
  components/
    ui/
  styles/
    tokens.css
    global.css
  lib/
    ipc-client.ts
    query-keys.ts
    formatting.ts
```

Rules:
- Each feature owns its components, hooks, query functions, and local types.
- Catalog data lives in TanStack Query. Zustand stores only ephemeral UI state.
- IPC query keys are centralized in `lib/query-keys.ts`.
- Mutations invalidate the affected query keys explicitly.
- Route-level error boundaries and loading/empty states are mandatory.
- Reusable visual primitives live in `components/ui`, not inside features.
- No feature imports another feature's internals; cross-feature dependencies go
  through shared components or public feature entry points.
- No global `utils.ts` dumping ground. Utilities are named for their domain.
- Components target behavior and accessibility, not implementation details.

#### 7.2.2 Main-process architecture

The main process is a modular monolith:

```text
src/main/
  bootstrap/
    app-lifecycle.ts
    security.ts
    single-instance.ts
  ipc/
    register-handlers.ts
    error-mapping.ts
  modules/
    drives/
      domain/
      application/
      infrastructure/
    catalog/
    scanning/
    media/
    health/
    settings/
  workers/
    db-worker.ts
    metadata-worker.ts
    thumbnail-worker.ts
    hash-worker.ts
  platform/
    windows-paths.ts
    volume-identity.ts
    shell-actions.ts
  db/                    (imported only by db-worker.ts)
    app-db.ts
    catalog-db.ts
    migrations/
    repositories/
  clients/
    app-state-client.ts  (typed RPC to db-worker)
    catalog-client.ts    (typed RPC to db-worker)
```

Rules:
- `domain` contains pure types and rules; it imports no Electron, Node I/O, or
  SQLite.
- `application` contains use cases; it depends on client/repository interfaces,
  not on a concrete SQLite connection.
- `infrastructure` implements filesystem, ExifTool, ffmpeg, and Sharp adapters.
- IPC handlers are thin: validate input with Zod, call a use case, map the result
  to a typed envelope, and log failures without leaking internals.
- The dedicated `db-worker.ts` is the **single SQLite writer**. It owns both
  `app.db` on the PC and the active `catalog.db` on the drive. It is a dedicated
  `worker_threads` worker, not a Piscina pool, because it must preserve a single
  connection and write order.
- The main process imports `better-sqlite3` nowhere. Modules use
  `AppStateClient`/`CatalogClient` RPC interfaces; dependency-cruiser enforces
  this.
- Repositories are interfaces with a `better-sqlite3` implementation inside the
  DB worker and a fake/in-process implementation for unit tests. Integration
  tests can instantiate the real repositories directly against a temporary DB.
- One catalog lock prevents two app instances from writing the same archive.
- Native binaries are resolved from `resourcesPath` in packaged builds and from
  `resources/` in development.

#### 7.2.3 Shared contracts

`src/shared` is platform-neutral and importable by main, preload, and renderer:

```text
src/shared/
  contracts/
    ipc.ts
    drives.ts
    catalog.ts
    scanning.ts
    health.ts
    settings.ts
  domain/
    ids.ts
    partial-date.ts
    errors.ts
  utils/
```

Rules:
- No Electron, Node built-ins, React, or database imports in `shared`.
- Zod schemas define IPC payloads and result envelopes.
- Branded ID types (`FileId`, `VolumeId`, `ScanId`) prevent accidental mixing.
- Errors use stable codes and user-safe messages; raw infrastructure errors never
  cross IPC.
- IPC results use one envelope shape:
  `{ ok: true, data } | { ok: false, error: { code, message, details? } }`.

#### 7.2.4 Test and tooling stack

- **Vitest** for unit and integration tests.
- **Testing Library + jsdom** for renderer component tests.
- **Playwright Electron** for end-to-end tests against a real app launch.
- **`@axe-core/playwright`** for automated accessibility checks in key flows.
- **ESLint**, **Prettier**, **dependency-cruiser**, **knip**, and a file-size
  check script for static quality gates.
- **GitHub Actions on `windows-latest`** for CI.

### 7.3 On-drive layout

```text
<drive>\.memorylane\
   catalog.db
   catalog.db-wal
   catalog.db-shm
   catalog.lock
   cache\
      thumbs\
      previews\
   logs\            (optional, bounded)
```

Rules:
- The catalog and cache are outside original archive folders.
- The cache is on the external drive and is excluded from PC backups.
- The PC backup lives under `%LOCALAPPDATA%\MemoryLane\backups\<volume-id>\`.
- No sidecar files are created inside original folders.

### 7.4 Read-only enforcement

- Open source files with read-only access.
- Never call write, truncate, rename, move, or delete APIs on source paths.
- Do not offer UI verbs that imply source modification.
- Keep an explicit allowlist of writable roots: the app-managed folder on the
  archive drive, `%LOCALAPPDATA%\MemoryLane`, and the app's own logs.
- Add tests that assert no mutation IPC channel exists and that source paths are
  opened read-only.
- Document Windows access-time behavior; decide whether to suppress updates or
  accept them.

### 7.5 Data model

There are two SQLite databases. Both are owned by the dedicated database worker.

**`app.db` — PC installation state**

Stored under `%LOCALAPPDATA%\MemoryLane\app.db`. It never contains archive file
records and is safe to recreate if lost; the archive catalogs remain authoritative
for their drives. The app sets Electron's `userData` path to
`%LOCALAPPDATA%\MemoryLane` before `app.whenReady()`.

| Table | Purpose | Key columns |
|---|---|---|
| `app_settings` | Installation preferences | `key`, `value`, `updated_at` |
| `registered_drives` | Known archive volumes | `id`, `volume_guid`, `volume_serial`, `label`, `filesystem`, `last_root_path`, `last_letter`, `last_seen_at`, `catalog_schema`, `last_backup_at` |
| `backup_history` | PC catalog backups | `id`, `drive_id`, `path`, `bytes`, `created_at`, `status` |
| `backup_destinations` | Future partial-backup placeholder | `id`, `volume_guid`, `label`, `last_seen_at` |
| `schema_migrations` | App schema version | `version`, `applied_at` |

**`catalog.db` — per archive drive**

Stored inside `<drive>\.memorylane\catalog.db`. It is independent and portable
with its drive.

| Table | Purpose | Key columns |
|---|---|---|
| `drive_identity` | Self-recorded volume identity | `id`, `volume_guid`, `volume_serial`, `label`, `filesystem`, `catalog_schema`, `created_at` |
| `catalog_settings` | Archive-scoped settings | `key`, `value`, `updated_at` |
| `scan_roots` | Explicit scan roots | `id`, `path`, `enabled`, `created_at` |
| `scan_sessions` | Scan runs | `id`, `started_at`, `finished_at`, `state`, `mode`, `last_stage` |
| `scan_stages` | Per-stage progress | `id`, `scan_id`, `stage`, `state`, `processed`, `total`, `started_at`, `finished_at` |
| `files` | Cataloged files | `id`, `path`, `name`, `extension`, `size`, `created_at_fs`, `modified_at_fs`, `media_class`, `format`, `mime`, `state`, `missing_since`, `last_seen_at` |
| `file_metadata` | Extracted metadata | `file_id`, `key`, `value`, `source`, `extracted_at` |
| `file_dates` | Resolved dates | `file_id`, `resolved_date`, `precision`, `source`, `confidence`, `original_value`, `is_override`, `override_id` |
| `date_overrides` | Manual dates | `id`, `file_id`, `year`, `month`, `created_at`, `reverted_at` |
| `hashes` | SHA-256 records | `file_id`, `sha256`, `hashed_at`, `status` |
| `duplicate_groups` | Hash groups | `id`, `sha256`, `file_count`, `total_bytes` |
| `duplicate_members` | Group membership | `group_id`, `file_id` |
| `missing_files` | Current missing state | `file_id`, `last_path`, `last_seen_at`, `reason` |
| `moved_candidates` | Hash-based relocations | `id`, `file_id`, `old_path`, `new_path`, `sha256`, `state`, `confirmed_at` |
| `validation_sessions` | Validation runs | `id`, `levels`, `state`, `started_at`, `finished_at` |
| `validation_results` | Per-file outcomes | `session_id`, `file_id`, `result`, `detail` |
| `cache_entries` | Generated assets | `file_id`, `kind`, `path`, `bytes`, `generated_at`, `status` |
| `schema_migrations` | Catalog schema version | `version`, `applied_at` |

Add indexes for date browsing, media class, path, hash, missing state, and
duplicate membership. Enable WAL, `busy_timeout`, and controlled checkpoints on
both databases.

`app_settings` owns installation preferences only. `catalog_settings` owns
archive-specific settings that must travel with the drive. A setting must have
one owner; do not duplicate it across the two databases. `electron-store` is not
used.

### 7.6 Date resolution

Priority order for v1:

1. Manual catalog override.
2. EXIF `DateTimeOriginal`.
3. EXIF `CreateDate` / `DateTimeDigitized`.
4. Video creation/recording timestamp from container metadata.
5. XMP date.
6. Filesystem creation date.
7. Filesystem modified date.

Store:
- Resolved browsing date.
- Precision: `year`, `month`, or `exact`.
- Source/provenance.
- Original extracted value.
- Confidence: high/medium/low.

Rules:
- Never invent a day. A year-only input stays year-only; a year/month input
  stays month-only.
- No filename/folder inference in v1.
- Items with no reliable date go to **Date unavailable**.
- Flag suspicious dates for review instead of confidently placing them:
  - Before 1900.
  - After the current year.
  - Known sentinel values such as 1970-01-01 or 1980-01-01 when other evidence
    is absent.
  - Dates that conflict sharply with filesystem evidence.
- Keep original values even after an override so the decision is reversible and
  auditable.

### 7.7 Scan pipeline

Stages:
1. **Catalog files** — enumerate directories, record paths and basic filesystem
   metadata.
2. **Extract metadata** — ExifTool/ffprobe, resolved dates, media classification.
3. **Generate thumbnails** — photos and video posters; viewport priority.
4. **Calculate hashes** — SHA-256; separate resumable queue.

Behavior:
- The user explicitly starts the first scan.
- Stages run independently; browsing becomes available after stage 1.
- Per-stage totals are shown; unknown totals are labeled as “discovering.”
- Pause stops new work but preserves current progress.
- App close and drive disconnect stop work safely and persist progress.
- Resume is always explicit.
- Incremental scans compare paths, size, and modified time; missing files are
  marked, not deleted.
- Completion report counts new, changed, missing, and likely moved files.

Concurrency:
- Separate queues for interactive thumbnail requests, bulk thumbnails, metadata,
  and hashing.
- Interactive/viewport work preempts bulk work.
- Configurable worker counts: Eco (2), Balanced (4), Max (8), subject to I/O
  testing.
- Avoid excessive random reads on USB 3 drives.

### 7.8 Hashing and duplicates

- Hash in 64 KiB–1 MiB chunks, with backpressure.
- Store partial progress so hashing can resume.
- Duplicate group = identical SHA-256 plus identical size.
- Duplicate detection is informational only.
- No deletion, move, rename, or cleanup operations.
- Duplicate detail always lists every known copy with its path.

### 7.9 Missing and moved files

- Incremental scan marks files missing when the recorded path no longer exists.
- Missing files stay in the catalog and remain visible in Library health.
- Moved detection compares SHA-256 of missing files with newly discovered files
  on the same drive.
- Candidates are presented as a batch with old and new paths.
- The user can confirm all, confirm selected, or keep individual files missing.
- Catalog paths update only after confirmation.
- No source files are moved or modified.

### 7.10 Validation

Independent levels:
1. Existence.
2. Basic metadata (size, modified time).
3. Deep SHA-256 integrity.
4. Metadata revalidation.

Behavior:
- User-triggered.
- Deep hashing is resumable and low priority.
- Results are stored and shown as a report.
- Missing files remain cataloged.
- No source modification.
- No full history UI in v1; keep the last run plus counts.

### 7.11 Thumbnail cache

- Stored on the archive drive under `.memorylane\cache`.
- Two tiers: grid thumbnail and larger preview.
- Generated lazily and regenerable.
- No automatic size limit in v1.
- Cache size shown in Settings.
- Manual **Clear cache** with confirmation.
- Clearing cache never touches originals or catalog rows.
- Do not cache full videos.

### 7.12 Database backup

- Use SQLite's online backup API, not a live file copy.
- Every 15 minutes while the app is open.
- Again on graceful close.
- Destination: `%LOCALAPPDATA%\MemoryLane\backups\<volume-id>\`.
- Exclude the thumbnail cache.
- Record backup history in `app.db`; show status/location/last backup in Settings.
- On graceful close, also write a small `app.db.bak` copy. It is not an archive
  catalog backup.
- No restore UI in v1; document the manual recovery path for both databases.

### 7.13 Drive identity

- Identify by volume GUID or stable volume serial, plus label/filesystem.
- Store last known letter and root path.
- Validate the identity when a drive reconnects.
- If the letter changed:
  1. Recognize the likely drive.
  2. Ask for confirmation.
  3. Update the catalog root only after confirmation.
- Never silently treat a reconnected drive as a new archive.

### 7.14 Performance

- Virtualized grid; render only visible items.
- Lazy thumbnail loading with placeholders.
- Indexed queries; no full-drive scans for normal browsing.
- Do not load the entire archive into memory.
- Use pagination/incremental fetches.
- Prioritize thumbnails for the current viewport.
- Keep database work off the renderer thread.
- Target responsive scrolling and playback while scanning.

### 7.15 Repository layout

The application is a single npm package with enforced internal boundaries:

```text
.
├─ src/
│  ├─ main/                 Electron main process and trusted services
│  ├─ preload/              Narrow contextBridge API
│  ├─ renderer/             React application
│  └─ shared/               Platform-neutral contracts and domain types
├─ tests/
│  ├─ integration/          Real SQLite/temp-filesystem service tests
│  ├─ e2e/                  Playwright Electron flows
│  └─ fixtures/             Synthetic media, catalog, and drive fixtures
├─ resources/
│  └─ bin/                  Fetched/pinned ExifTool, ffmpeg, ffprobe binaries
├─ scripts/
│  ├─ fetch-binaries.mjs
│  ├─ rebuild-electron.mjs
│  ├─ check-file-size.mjs
│  ├─ smoke-packaged.mjs
│  └─ verify-package.mjs
├─ docs/
│  ├─ adr/                  Architecture decision records
│  └─ quality-exceptions.md
├─ build/
│  └─ icon.ico
├─ ui-mockups/              Static design reference (not shipped)
├─ native-binaries.lock.json  Pinned versions and SHA-256 checksums
├─ THIRD_PARTY_NOTICES.md     Binary licenses and attribution
├─ electron.vite.config.ts
├─ electron-builder.yml
├─ vitest.config.ts
├─ playwright.config.ts
├─ eslint.config.js
├─ tsconfig.json
└─ package.json
```

Naming conventions:
- React components: `PascalCase.tsx`.
- Other source modules: `kebab-case.ts`.
- Unit/component tests: co-located `*.test.ts` / `*.test.tsx`.
- Integration tests: `tests/integration/*.test.ts`.
- E2E tests: `tests/e2e/*.spec.ts`.
- Database migrations: `NNNN-description.sql`.
- One named export per module where practical; avoid default exports except
  route-level modules if required by the router.

Unit and component tests are co-located for fast feedback. Integration and E2E
tests are centralized because they require fixtures, temporary drives, or an
Electron launch.

### 7.16 Packaging and distribution

#### Build pipeline

```text
npm run dev          electron-vite dev server + Electron
npm run build        electron-vite production build
npm run package      build + electron-builder
npm run package:win  Windows NSIS installer + portable ZIP
```

`electron-vite` produces:

```text
out/
  main/index.js
  preload/index.js
  renderer/index.html
  renderer/assets/*
```

`electron-builder` packs `out/` into:

```text
release/
  Memory-Lane-Setup-0.1.0-x64.exe
  Memory-Lane-0.1.0-x64.zip
  win-unpacked/
```

#### ASAR and native resources

- Application JavaScript is packed into `app.asar`.
- Native modules and sidecar binaries cannot run from inside ASAR. They are
  unpacked or copied into resources:
  - `better-sqlite3` `.node` addon: `asarUnpack`.
  - `sharp` platform binaries: `asarUnpack`.
  - ExifTool, ffmpeg, and ffprobe: `extraResources` to `resources/bin`.
- If a dependency ships its own binary (for example a vendored ExifTool build),
  it must also be listed in `asarUnpack` or configured to use the pinned binary
  in `resources/bin`. The packaged smoke test verifies the resolved path.
- Production path resolution uses `process.resourcesPath`; development uses the
  repository `resources/` directory.
- Native modules are selected with `prebuild-install` for the pinned Electron
  version (ABI-specific), and `electron-builder` runs with `npmRebuild: false`
  because the correct binary is already in `node_modules`. The packaged smoke
  test verifies the ABI at runtime.
- Binary versions and SHA-256 checksums live in `native-binaries.lock.json`.
  `scripts/fetch-binaries.mjs` downloads and verifies them during development and
  CI; binaries are not committed to git. Licenses and attribution are recorded
  in `THIRD_PARTY_NOTICES.md`.

#### `electron-builder` targets

- **NSIS per-user installer**:
  - No administrator rights.
  - Start Menu shortcut and optional desktop shortcut.
  - User-selectable install directory.
  - Installs under `%LOCALAPPDATA%\Programs\Memory Lane`.
- **Portable ZIP**:
  - For testing and users who do not want an installer.
  - Application preferences and `app.db` still live in
    `%LOCALAPPDATA%\MemoryLane` for consistency with the installed build.
- **Architecture**: x64 first. ARM64 is deferred until tested.
- **Icon**: `build/icon.ico`.
- **Publish**: disabled in the first release; GitHub Releases can be added later.

Example `electron-builder.yml` shape:

```yaml
appId: com.memorylane.app
productName: Memory Lane
directories:
  output: release
  buildResources: build
files:
  - out/**
  - package.json
extraResources:
  - from: resources/bin
    to: bin
asar: true
asarUnpack:
  - node_modules/better-sqlite3/**
  - node_modules/sharp/**
  - node_modules/@img/**
npmRebuild: false
win:
  target:
    - target: nsis
      arch: [x64]
    - target: portable
      arch: [x64]
  icon: build/icon.ico
nsis:
  oneClick: false
  perMachine: false
  allowElevation: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: Memory Lane
  artifactName: Memory-Lane-Setup-${version}-${arch}.${ext}
portable:
  artifactName: Memory-Lane-${version}-${arch}.${ext}
publish: null
```

The exact `asarUnpack` list is verified by a packaged-app smoke test. A build
that works in development but fails after packaging is a release blocker.

#### Distribution signing

**Decision: remain unsigned indefinitely.** This is an accepted v0.1 tradeoff,
not an oversight.

- No code-signing certificate is purchased or configured.
- No signing secrets (`CSC_LINK`, `CSC_KEY_PASSWORD`) are added to CI.
- Windows SmartScreen may warn on first launch and may require “More info” before
  running the installer.
- Release notes and the download page must state that the build is unsigned and
  show the published SHA-256 checksum.
- Revisit only if public distribution, user acquisition, or organizational
  policy makes signing necessary. If revisited, use Authenticode or a
  cloud-signing service, keep credentials in CI secrets, timestamp signatures,
  and add a new ADR.

Never commit a `.pfx`, `.p12`, password, or signing token even if signing is
added later.

#### Release checklist

1. Run typecheck, lint, architecture checks, unit, integration, and E2E tests.
2. Build the NSIS installer and portable ZIP on a clean Windows runner.
3. Install on a clean Windows VM and launch from the Start Menu.
4. Verify first-run drive selection, scan, browse, viewer, date assignment,
   health tabs, and settings.
5. Verify the app opens no network connections.
6. Verify originals are unchanged after scanning, viewing, validating, and
   clearing cache.
7. Verify the uninstaller removes application files but does not delete archive
   catalogs, thumbnails on the drive, or PC backups.
8. Compute SHA-256 checksums for release artifacts.
9. Publish release notes, checksums, and the unsigned/SmartScreen note.

Auto-update is deferred. v0.1 uses manual installer downloads.

---

## 8. Engineering standards and quality gates

### 8.1 What guarantees what

There is an important distinction:

- **Unit tests verify behavior.** They do not guarantee file length or function
  complexity.
- **Static analysis and CI enforce structural limits.** ESLint, a file-size
  check, dependency-cruiser, knip, and TypeScript enforce the standards.
- **CI is the source of truth.** A local pass is useful; a protected branch
  requires the CI quality, test, E2E, and packaging jobs to pass.

The standards below are therefore enforced by tooling, not by reviewer memory.

### 8.2 File size and complexity limits

| Rule | Limit | Enforcement |
|---|---|---|
| File length, physical lines (`.ts`, `.tsx`) | **400 lines hard** | `scripts/check-file-size.mjs` exits non-zero; CI fails |
| File length, code lines | **400 lines hard** | ESLint `max-lines` error; CI fails |
| File length soft target | **300 physical lines** | `scripts/check-file-size.mjs` reports each file over 300 in the CI summary |
| Function length | **100 lines hard** | ESLint `max-lines-per-function` error |
| Cyclomatic complexity | **10 hard** | ESLint `complexity` error |
| Cognitive complexity | **15 hard** | `eslint-plugin-sonarjs` error |
| Maximum nesting depth | **4** | ESLint `max-depth` error |
| Maximum parameters | **4** | ESLint `max-params` error |
| Nested callbacks | **3** | ESLint `max-nested-callbacks` error |

The physical-line check is the actual 400-line guarantee. ESLint's `max-lines`
is a second gate on code lines; it ignores blank lines and comments by design.
Both must pass.

Excluded from the line limits:
- Generated files.
- SQL migrations.
- Worker entrypoint files that only wire a pool.
- Test fixtures and synthetic media.
- Vendored code, if any.

No blanket file-level disables. An exception must use a narrow
`eslint-disable-next-line` with a reason and must be approved in review. An
exception that needs to persist is recorded in
`docs/quality-exceptions.md` with an owner and an expiry date.

React components follow the same function-length limit. If a component grows
past 100 lines, split it into a container, subcomponents, and hooks rather than
increasing the limit.

### 8.3 ESLint and TypeScript standards

TypeScript is strict by default:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "useUnknownInCatchVariables": true
  }
}
```

Required rules:
- No explicit `any`. Use `unknown` plus Zod or a type guard.
- No non-null assertions unless the invariant is obvious and commented.
- No floating promises or async callbacks passed where a void return is
  expected.
- Exhaustive switches for discriminated unions.
- Type-only imports where applicable.
- No `console` in application code; use the logger or a typed IPC error.
- React hooks rules and accessibility rules are errors.

Representative ESLint configuration:

```js
{
  files: ["src/**/*.{ts,tsx}"],
  rules: {
    "max-lines": ["error", { max: 400, skipBlankLines: true, skipComments: true }],
    "max-lines-per-function": ["error", { max: 100, skipBlankLines: true, skipComments: true }],
    "complexity": ["error", 10],
    "max-depth": ["error", 4],
    "max-params": ["error", 4],
    "max-nested-callbacks": ["error", 3],
    "sonarjs/cognitive-complexity": ["error", 15],
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": "error",
    "@typescript-eslint/switch-exhaustiveness-check": "error",
    "@typescript-eslint/consistent-type-imports": "error",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "error"
  }
}
```

### 8.4 Architecture boundaries

`dependency-cruiser` enforces:

- `src/renderer` cannot import `src/main`, `src/preload`, Electron, Node
  built-ins, SQLite, Sharp, or Piscina.
- `src/main` cannot import `src/renderer`.
- `src/preload` can import `src/shared` and Electron preload APIs only.
- `src/shared` cannot import Electron, Node built-ins, React, or database code.
- `domain` cannot import `infrastructure`.
- `application` cannot import Electron, SQLite, or concrete filesystem adapters.
- Only `src/main/workers/db-worker.ts` and `src/main/db/**` may import
  `better-sqlite3`.
- Other main modules must use `AppStateClient`/`CatalogClient`; they cannot
  import `src/main/db/**` or open SQLite.
- No circular dependencies.
- No orphan modules or unused exports (`knip`).

Example rules:

```js
// dependency-cruiser
{
  name: "renderer-cannot-import-main",
  severity: "error",
  from: { path: "^src/renderer" },
  to: { path: "^src/(main|preload)" }
},
{
  name: "shared-is-platform-neutral",
  severity: "error",
  from: { path: "^src/shared" },
  to: { path: "^(electron|node:)" }
},
{
  name: "domain-cannot-import-infrastructure",
  severity: "error",
  from: { path: "^src/main/modules/.+/domain" },
  to: { path: "^src/main/modules/.+/infrastructure" }
},
{
  name: "only-db-worker-imports-sqlite",
  severity: "error",
  from: { pathNot: "^src/main/(workers/db-worker|db/)" },
  to: { path: "node_modules/better-sqlite3" }
}
```

### 8.5 Testing strategy

The test pyramid is intentional:

| Level | Tool | Scope | Target |
|---|---|---|---|
| Unit | Vitest | Pure domain rules, date resolution, scan diff, path normalization, hash grouping, IPC schemas | Fast; no Electron, no real disk |
| Component | Vitest + Testing Library | React components, dialogs, tabs, selection, date assignment, error states | Behavior and accessibility |
| Contract | Vitest + Zod | IPC payload/result schemas, error envelopes, channel names | Every channel |
| Integration | Vitest + real SQLite + temp filesystem | Repositories, migrations, DB-worker RPC, scan coordinator, backup, cache, validation, moved-file matching | Main-process services without the UI |
| E2E | Playwright Electron | Drive selection → scan → browse → viewer → date → health → settings | A small number of critical user journeys |
| Smoke | Packaged app launch | Installer/unpacked build starts, opens a fixture catalog, no crash | Every release |

Coverage floor:
- **80% lines, statements, and functions**.
- **75% branches**.
- **90% lines and branches** for critical modules:
  - date resolution and overrides
  - scan diff and resume
  - hashing and duplicate grouping
  - moved-file matching
  - validation
  - SQLite backup
  - IPC validation and error mapping
  - read-only path guards

Coverage rules:
- Coverage is a floor, not a target to game.
- Critical module groups have stricter thresholds than the global floor, and
  individual critical files are reviewed for uncovered failure paths.
- Generated files, migrations, and pure wiring entrypoints may be excluded only
  with a documented reason.
- A change that lowers coverage below the floor fails CI.

E2E scenarios (minimum):
1. Select a fixture drive, open an existing catalog, browse the timeline.
2. Start an incremental scan, see staged progress, pause, resume, complete.
3. Open a photo and a video; verify metadata, duplicate copies, and reveal
   actions are catalog-only.
4. Assign a year and year/month date individually and in bulk; verify originals
   are untouched.
5. Review missing files, confirm a moved-file batch, and verify the catalog
   pointer changes.
6. Open Library health, inspect duplicates, run validation, and view the report.
7. Clear the cache and verify catalog/original state is unchanged.
8. Verify a packaged build launches and reads a pre-seeded catalog.

E2E rules:
- Launch with a temporary `userData` directory and a fixture drive.
- Never point tests at a real archive.
- No fixed sleeps; wait for UI state or IPC events.
- Capture trace/screenshot on failure.
- Retries: 0 locally, 1 in CI; flaky tests are fixed, not quarantined
  indefinitely.

### 8.6 CI pipeline

GitHub Actions on `windows-latest`, triggered by pull requests and `main`:

```text
npm ci
npm run typecheck
npm run lint
npm run format:check
npm run check:file-size
npm run depcruise
npm run knip
npm run test:unit -- --coverage
npm run test:integration
npm run fetch:binaries
npm run build
npm run test:e2e
npm run package:win
upload installer + portable ZIP + coverage + Playwright report + checksums
```

Notes:
- The CI Node version matches the project's `.nvmrc` and the Electron native
  rebuild target.
- `npm ci` uses the committed lockfile.
- Playwright browser/runtime caches are used where safe.
- A separate nightly job runs the 100k–200k file benchmark suite.
- Branch protection requires the quality, test, E2E, and package jobs.
- Packaging is part of CI because a build that only works in development is not
  a working Electron release.
- The pipeline has no signing step. It publishes unsigned artifacts with a
  SHA-256 checksum and a SmartScreen note.

### 8.7 Local workflow

Fast feedback:

```text
npm run fix          Prettier + ESLint autofix
npm run check        typecheck + lint + format + architecture + file size
npm run test:watch   unit/component watch mode
```

Full verification before opening a pull request:

```text
npm run check:full   all static checks + unit + integration + E2E
```

Pre-commit hooks are optional convenience. CI remains authoritative; a local
hook can be bypassed, a protected branch check cannot.

### 8.8 Definition of done for a change

A change is done when:

- The behavior has a test at the right level.
- New IPC channels have Zod schemas and contract tests.
- New domain rules have unit tests.
- New screens or dialogs have component tests for their key states.
- New user journeys are covered by E2E when they cross process boundaries.
- Typecheck, lint, architecture, file-size, and coverage gates pass.
- The read-only guarantee is preserved.
- Logs and user-facing errors are appropriate.
- Documentation or an ADR is updated for a significant decision.

### 8.9 Architecture decision records

Significant decisions are recorded in `docs/adr/`:

- `0001-electron-process-and-security-model.md`
- `0002-single-sqlite-writer-and-repositories.md`
- `0003-ipc-contracts-and-error-envelope.md`
- `0004-renderer-state-and-data-flow.md`
- `0005-styling-and-component-primitives.md`
- `0006-testing-and-quality-gates.md`
- `0007-packaging-and-distribution.md`

An ADR is short: context, decision, alternatives considered, consequences, and
status. It is not a design essay.

---

## 9. Build sequence

### Phase 0 - Foundation

- Scaffold the single-package `electron-vite` project with React and strict
  TypeScript.
- Configure `electron-builder` for the NSIS per-user installer and portable ZIP.
- Add ESLint and Prettier with the file-size and complexity rules in section 8.
- Add `scripts/check-file-size.mjs`, dependency-cruiser, and knip.
- Add Vitest, Testing Library, and Playwright configuration plus the initial CI
  workflow and coverage thresholds.
- Add the `scripts/fetch-binaries.mjs` flow, `native-binaries.lock.json`,
  checksum verification, and `THIRD_PARTY_NOTICES.md`.
- Enforce the preload/IPC boundary, CSP, `contextIsolation`, `sandbox`, and
  single-instance/catalog locks.
- Implement the dedicated DB worker as the single SQLite writer for `app.db` and
  `catalog.db`.
- Implement both schemas and migration runners.
- Implement drive identity and app-managed folder layout.
- Add logging, error taxonomy, and crash-safe shutdown.
- Sign off this scope, the architecture decisions, and the revised screens.

**Exit:** app opens in development and packaged form, detects a drive, creates an
empty catalog, safely closes, and all quality gates run in CI.

### Phase 1 — Drive selection and scanning

- Drive selection gate.
- Existing/new/reconnect flows.
- Changed-letter confirmation.
- Scan coordinator and four stages.
- Per-stage progress, pause/resume, intensity.
- Interruption handling and manual resume.
- Scan completion report.

**Exit:** a real drive can be cataloged in stages, interrupted, resumed, and
reported without modifying source files.

### Phase 2 — Memory Lane and viewer

- Timeline queries and year/month navigation.
- Virtualized grid and lazy thumbnails.
- Photo/video filters and density.
- Combined viewer with photo and video states.
- Basic metadata, reveal, and previous/next.
- Viewport-priority thumbnail scheduling.

**Exit:** photos and videos browse together smoothly while thumbnails generate.

### Phase 3 — Dates

- Date resolution service and provenance.
- Date unavailable collection.
- Individual and bulk year/year-month assignment.
- Catalog-only overrides and viewer integration.
- Suspicious-date flags.

**Exit:** undated items can be resolved without touching originals, and date
precision is always honest.

### Phase 4 — Integrity

- SHA-256 hashing and resumable queue.
- Duplicate groups and detail.
- Missing-file state.
- Moved-file candidates and batch confirmation.
- Four-level validation and report.
- Library health tabs.

**Exit:** duplicates, missing files, moved files, and validation all work from
one hub with no destructive actions.

### Phase 5 — Other files and settings

- Category browse and external open/reveal.
- Cache size and clear.
- Database backup status and schedule.
- Background controls and About.
- Drive drawer.
- Empty/error/disconnect states.

**Exit:** every v0.1 screen is functional and every visible control is backed by
an implemented feature.

### Phase 6 — Hardening

- 100k–200k file performance tests.
- USB disconnect and unclean shutdown tests.
- SQLite backup/restore drill.
- Codec/format matrix.
- IPC/security review.
- Full E2E suite against a packaged build on a clean Windows VM.
- Installer, portable ZIP, uninstaller, and checksum verification.
- Coverage and quality-gate pass.
- Acceptance-criteria pass.

**Exit:** specification §17 acceptance criteria are met, the packaged build
passes E2E and smoke tests, and all quality gates are green.

### Phase 7 — Post-v0.1 future features

These are explicitly outside v0.1 acceptance:

- **Globe/Places map** for GPS-tagged photos and videos.
- **Local AI non-memory classification** with human review and no deletion.

Each feature gets its own ADR, schema migration, UI route, evaluation set, and
acceptance criteria before implementation. See §16.

**Exit:** the feature-specific acceptance criteria in §16 are met, the feature is
local-only, and no original file is modified.

---

## 10. Test strategy

Section 8.5 defines the test pyramid, tools, coverage floors, and CI gates. This
section maps the strategy to product areas.

| Product area | Unit | Component | Integration | E2E |
|---|---|---|---|---|
| Drive identity and selection | Path/ID rules, letter-change decisions | Gate cards, confirmation dialog | Volume fixture and catalog lookup | Select/open/reconnect flows |
| Scanning | Stage transitions, resume rules, diff logic | Progress cards, pause/resume states | Scan coordinator with temp drive | Start, pause, resume, interrupt, complete |
| Memory Lane | Date grouping, pagination keys | Filters, density, selection, empty states | Query/repository paging | Browse, filter, select |
| Viewer | Date precision, duplicate labels | Photo/video details, date dialog | Metadata read and duplicate lookup | Open photo/video, assign date |
| Date unavailable | Year/month validation, override rules | Grid selection, batch panel | Apply overrides to catalog | Bulk assign and verify |
| Other files | Category mapping | Table filtering, empty category | Catalog queries and external-open guard | Filter and open action |
| Library health | Hash grouping, moved matching, validation rules | Tabs, moved-file batch, duplicate detail, validation states | Missing/moved/duplicates/validation services | Review, confirm, validate |
| Settings | Preference schema | Toggles, cache dialog | Cache clear and backup status | Change settings, clear cache |
| Read-only boundary | Path guard rules | No destructive verbs | Open handles and writable-root allowlist | Attempted mutation has no path |

Additional non-functional checks:

**Contract**
- Every IPC channel has a Zod request schema and result schema.
- Envelope and error-code tests for all failure paths.
- Channel names are centralized and checked for duplicates.

**Integration**
- Temporary directory simulating an external drive.
- Real `better-sqlite3` database with migrations applied.
- Scan stage independence, resume, and interruption.
- Drive letter change confirmation.
- SQLite backup consistency.
- Cache clear without catalog damage.
- Validation levels independently and together.
- Unreadable, permission-denied, and corrupt file fixtures.

**Performance**
- 100k–200k synthetic files.
- 2 TB-scale metadata and thumbnail workload.
- Scroll FPS and query latency during active scanning.
- Thumbnail viewport prioritization.
- Hashing throughput without UI stalls.
- Run nightly, not as a blocking PR check.

**Security and read-only**
- Assert no mutation IPC exists.
- Assert source files are opened read-only.
- Path traversal and crafted catalog-ID tests.
- Reveal/open-external only for catalog-owned paths.
- No arbitrary shell execution from the renderer.
- CSP and navigation-blocking tests in the packaged renderer.

**Manual acceptance**
- Walk the specification §17 criteria screen by screen.
- Verify every visible control maps to this document.
- Verify the packaged installer, portable build, and uninstaller on a clean
  Windows VM.

**Test data rules**
- Use synthetic media, fake metadata, and fixture catalogs.
- Never commit personal photos or real archive paths.
- E2E tests use a temporary `userData` directory and fixture drive.
- A test must not depend on a developer's real drive letter or local catalog.

**Future-feature evaluation**
- The Places map needs GPS/no-GPS fixtures, cluster correctness, and a
  no-network assertion.
- The non-memory classifier needs a labeled evaluation set and per-category
  precision/recall targets; it is not judged by code coverage alone.
- Both future features get their own E2E and privacy checks before release.
- See §16 for acceptance criteria.

---

## 11. Acceptance-criteria mapping

| Specification criterion | Where satisfied |
|---|---|
| Select and identify drive beyond letter | Drive selection; drive drawer; drive identity service. |
| Letter change requires confirmation | Drive selection confirmation dialog. |
| Never move/rename/edit/delete originals | Architecture, IPC boundary, UI language, tests. |
| Catalog and cache in app-managed locations | On-drive layout; Settings storage section. |
| SQLite backup every 15 min and on close | Backup service; Settings status. |
| Initial scan explicitly started | Scan & processing idle state. |
| Separate progress for four stages | Scan & processing stage cards. |
| Interrupted work preserved, manual resume | Scan interrupted/paused states. |
| Photos and videos together chronologically | Memory Lane. |
| Virtualized grid and viewport priority | Memory Lane + thumbnail scheduler. |
| In-app photo viewing and video playback | Media viewer. |
| Manual dates individually and in bulk at year/year-month | Date unavailable + viewer + Memory Lane selection. |
| Overrides preserve originals | Date service and catalog-only note. |
| SHA-256 duplicates with all locations | Library health → Duplicates; viewer duplicate section. |
| Missing files reported and retained | Library health → Missing files. |
| Moved suggestions grouped for batch confirmation | Library health → Missing files moved section. |
| Cache size visible and clear without affecting originals | Settings storage section. |
| Validation workflow produces a report | Library health → Validation. |
| Architecture leaves room for future partial backups | Data-model placeholders; no combined catalog. |
| Delivery quality (not a product criterion) | Section 8 static limits, coverage floors, E2E suite, and CI gates. |

---

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| USB disconnect corrupts SQLite or scan state | WAL with controlled checkpoints, staged transactions, explicit interruption state, backup, integrity check. |
| 2 TB hashing takes too long | Separate low-priority resumable queue; partial progress; never blocks browsing. |
| Thumbnail generation saturates the drive | Viewport priority, bounded concurrency, interactive queue preemption, intensity control. |
| RAW/video codecs vary widely | ExifTool embedded previews, ffmpeg/ffprobe, clear unsupported-format state. |
| Date inference is wrong | No inference in v1; precision/source/confidence stored; suspicious-date review. |
| Drive letter changes | Volume-ID identity and explicit confirmation. |
| Cache grows large | Size visible, manual clear, no automatic limit, cache excluded from backup. |
| Read-only promise is violated by a future change | No mutation IPC, allowlisted writable roots, automated tests, UI copy review. |
| SQLite on removable media behaves differently | Prototype WAL/checkpoint behavior on real USB drives; document safe-shutdown behavior. |
| App-managed writes fail on exFAT/NTFS permissions | Detect and report a clear catalog-creation error; do not fall back to writing in archive folders. |
| Validation deep hash duplicates work | Reuse hash queue and existing hashes; only hash what is missing or requested. |
| Electron native modules fail only after packaging | Rebuild against the Electron ABI, `asarUnpack` native addons, and run a packaged-app smoke test in CI. |
| Sidecar binaries are missing in the installer | Fetch pinned binaries with checksums, copy them via `extraResources`, and resolve them from `process.resourcesPath`. |
| File-size and complexity limits cause over-fragmentation | Use the 300-line soft target for review, 400 hard limit, and allow documented exceptions for migrations/generated code. |
| Coverage becomes a vanity metric | Per-file thresholds for critical modules, behavior-focused tests, and review of uncovered failure paths. |
| E2E tests become flaky and ignored | No fixed sleeps, isolated temp userData/drive, trace on failure, retry once in CI, and fix flaky tests promptly. |
| Unsigned installer triggers SmartScreen | Accepted for v0.1: document the warning, publish checksums, and revisit signing only if distribution needs it. |
| DB worker becomes a serialization bottleneck | Keep queries indexed and paginated, batch writes, separate CPU pools, and measure queue latency under 100k–200k files. |
| `app.db` is lost or corrupted | Back it up on graceful close, keep it small/recreatable, and never treat it as the archive catalog. |
| AI false positive hides a real memory | Review-only default, high-precision threshold, reversible decisions, and per-category evaluation. |
| Map tries to load too many GPS points | Cluster in the DB worker with an R-Tree and zoom grid; never send the full point set to the renderer. |
| Map depends on online tiles or geocoding | Bundle Natural Earth geometry and keep all rendering local; no network in the map acceptance test. |
| AI model licensing or size is unsuitable | Model manifest, checksum, license review, and a model spike before committing to distribution. |

---

## 13. Open implementation decisions

These remain technical decisions, not product-scope changes:

- Exact upstream ExifTool/ffmpeg/ffprobe versions and license review.
- Auto-update mechanism and release channel after v0.1.
- Exact drive-identity API and behavior across NTFS/exFAT.
- Final SQLite WAL/checkpoint strategy on removable drives.
- Exact backup retention count.
- Final date-priority edge cases and suspicious-date thresholds.
- Supported image/video formats and codec matrix.
- Thumbnail dimensions, encoding, and preview sizes.
- Access-time preservation policy.
- Behavior for encrypted, corrupt, permission-restricted, or unreadable files.
- Exact wording and thresholds for validation outcomes.
- Future backup schema details (destinations, jobs, coverage snapshots).
- Phase-2 search design and whether FTS5 is required.
- Map renderer and offline basemap choice; cluster granularity; whether offline
  reverse geocoding is included in the first Places release.
- AI classifier choice, model size, label set, confidence thresholds, OCR use,
  and model licensing.
- Whether AI non-memory review is a standalone route or a Library health tab.
- Whether video location/telemetry extraction ships with the first map release.

---

## 14. Prototype notes

The revised `ui-mockups/` files are a **clickable static prototype**:

- Shared `assets/app.css` and `assets/app.js` provide the shell, sidebar, top bar,
  drive drawer, tabs, dialogs, and toasts.
- Sample data is consistent across screens: WD My Passport 2TB (E:), 97,902
  catalog records (85,420 photos/videos and 12,482 other files), 142 undated
  items, 15 missing files, and 84 duplicate sets.
- All images are local under `assets/images/`.
- All fonts and material icons are local under `assets/fonts/`; the prototype
  has no external network dependency.
- No real filesystem, database, or media access occurs.
- Actions that would touch the real system show a prototype toast instead.
- Screen states are reachable through links in `index.html` or query parameters:
  - Library health: `library-health.html#missing`, `#duplicates`, `#validation`.
  - Scan: `scan-processing-dashboard.html?state=idle|active|paused|interrupted|complete`.
  - Viewer: `media-viewer.html?type=photo|video`.
  - Date dialog: `media-viewer.html?type=photo&modal=date`.
  - Drive drawer: append `?drawer=1` to any app screen.
  - Changed drive letter: `drive-selection.html?case=letter-change`.

The prototype is a design and scope artifact. The production app will replace
static sample data with IPC-backed queries and real media rendering.

---

## 15. Parallel development with multiple agents

### 15.1 Goal and guardrails

Use at least two agents from Phase 1 onward, and a third agent for quality and
release work once there is enough parallel surface. The goal is faster delivery
without turning the repository into an integration experiment.

Guardrails:
- **Contract-first, not file-first.** Agree on IPC/domain contracts before
  backend and renderer work diverge.
- **Path ownership.** Each agent owns a directory tree; shared files have one
  nominated owner.
- **Short-lived branches.** Integrate vertical slices at least every two days.
- **Green main.** No agent merges while the quality gate is red.
- **Human review** for contracts, schema changes, dependencies, and architecture
  decisions.

Detailed operating rules live in `docs/agent-workstreams.md`.

### 15.2 Workstreams

| Workstream | Owns | Primary deliverables |
|---|---|---|
| **Platform/Core** | `src/main/**`, `src/preload/**`, `src/main/db/**`, `src/main/workers/**`, `electron-builder.yml`, `resources/bin`, `native-binaries.lock.json` | Electron bootstrap, DB worker, app.db/catalog.db, drive identity, scan coordinator, worker pools, media tools, packaging |
| **Renderer/UX** | `src/renderer/**`, `src/renderer/**/*.test.tsx` | App shell, design system, Memory Lane, viewer, date UI, Other files, Library health, Settings, accessibility |
| **Quality/Release** (optional third) | `.github/**`, `tests/e2e/**`, `tests/fixtures/**`, `scripts/**`, `vitest.config.ts`, `playwright.config.ts`, `docs/adr/**` | CI, E2E harness, fixtures, packaging smoke tests, performance suite, ADRs, release checks |

Shared ownership:
- `src/shared/contracts/**` and `src/shared/domain/**` are authored by
  Platform/Core, reviewed by Renderer/UX, and approved by the human/architect.
- `package.json` and the lockfile have one dependency steward at a time
  (Quality/Release if present, otherwise Platform/Core). Other agents request
  dependency changes instead of editing them directly.
- `electron.vite.config.ts`, ESLint, TypeScript, and test configuration are
  owned by Quality/Release. Platform and Renderer request changes.
- The scope document, README, and ADRs are human/architect-owned. Agents propose
  updates; they do not silently rewrite scope.

### 15.3 Phase-by-phase split

| Phase | Platform/Core | Renderer/UX | Quality/Release |
|---|---|---|---|
| 0 — Foundation | Scaffold, IPC contracts, DB worker skeleton, security, packaging config | Design tokens, app shell, and static screens against a mock IPC client after the contract freeze | CI, lint/type/test configs, file-size check, Playwright harness |
| 1 — Drive + scan | app.db/catalog.db, registered drives, scan coordinator, stage progress | Drive gate, scan screen, progress states, drive drawer | Fixture drive, first E2E flow, CI packaging smoke |
| 2 — Library + viewer | Worker pools, media metadata, thumbnail scheduling, query endpoints | Timeline, filters, density, viewer photo/video states | Timeline/viewer component and E2E coverage |
| 3 — Dates | Date resolution, override repository, suspicious-date rules | Date unavailable, batch assignment, viewer date dialog | Date precision and override E2E |
| 4 — Integrity | Hashing, duplicates, missing/moved, validation | Library health tabs and report states | Health E2E, moved-file batch tests |
| 5 — Other files + settings | Cache, backup, settings persistence | Other files, settings, cache dialog | Installer/portable smoke, release checks |
| 6 — Hardening | Performance, disconnect, security | Accessibility and empty/error states | Full E2E, coverage, release artifacts |
| 7 — Future | Map and AI backend work | Places and non-memory review UI | Model evaluation and feature E2E |

Phase 0 is mostly serial because it defines the contracts and tooling everything
else depends on. If two agents must start on day one:
- Agent A owns the scaffold and contracts.
- Agent B starts with the design system and static shell using the mockups,
  without touching `src/main` or `src/shared`.

### 15.4 Contract-first workflow

1. Platform defines the Zod schemas, DTOs, error codes, and IPC channel names in
   `src/shared/contracts`.
2. Platform adds contract tests and a typed mock adapter.
3. Renderer builds against `src/renderer/lib/ipc-client.mock.ts` with fixture
   data; it does not wait for the real backend.
4. Platform implements handlers against the same contract.
5. Contract changes require:
   - a contract test update;
   - both Platform and Renderer review;
   - human approval if the change affects a released screen or data model.
6. No process-boundary imports outside the approved contracts.

### 15.5 Worktrees, branches, and integration

- Each agent works in its own git worktree:
  - `../memory-lane-platform` on `agent/platform`
  - `../memory-lane-renderer` on `agent/renderer`
  - `../memory-lane-quality` on `agent/quality`
- Commit small, one-line messages.
- Rebase on `main` daily; do not keep a branch alive for more than two days
  without integration.
- Agents do not push to `origin`. The human reviews and pushes.
- Merge order: contracts → backend slice → renderer slice → tests/docs.
- Run the full quality gate before merge. A red `main` blocks all agents.

### 15.6 Conflict and dependency rules

- Do not edit outside your owned paths without a coordinated change request.
- Do not run drive-by refactors in another agent's area.
- If a contract or schema change is required, pause the dependent work, update
  the contract, and resume both streams from the new version.
- One agent owns `package.json` at a time; dependency additions are small,
  reviewed changes.
- Shared config changes are proposed as a small PR, not bundled into feature work.
- If two streams need the same file, the file's owner makes the change and the
  other agent consumes it.

### 15.7 Agent definition of done

An agent's change is ready for integration when:

- The owned slice builds and typechecks.
- Tests at the right level are added or updated.
- Architecture boundaries and file/complexity limits pass.
- The read-only guarantee is preserved.
- The contract is unchanged or the contract change is approved.
- Documentation/ADR is updated for a significant decision.
- The agent reports what changed, what was tested, and what remains blocked.

### 15.8 When to add a third agent

Add Quality/Release when:
- CI and E2E are becoming the bottleneck.
- Packaging or native-module work starts.
- Two feature streams are waiting on test infrastructure.

Do not add more than three agents before Phase 2. Coordination cost, shared
contracts, and merge conflicts outweigh the throughput gain.

---

## 16. Future feature designs

These features are **not part of v0.1 acceptance**. They are recorded so the v0.1
schema and architecture do not block them.

### 16.1 Globe / Places map

**Status:** post-v0.1.  
**Goal:** show where GPS-tagged photos and videos were taken on a globe. Items
without location metadata are excluded, not guessed.

**Scope**
- Extract GPS from:
  - photo EXIF GPS tags;
  - video container location metadata (QuickTime/MP4 where present);
  - supported action-camera/DJI telemetry where available.
- Ignore files with no GPS metadata.
- Validate latitude/longitude; discard invalid coordinates and treat `0,0` as
  suspicious unless the user confirms it.
- Store source and confidence so the UI can distinguish EXIF GPS from video
  telemetry.
- No filename/folder inference and no “pretend” location.

**Data**
- `gps_points` in `catalog.db`: `file_id`, `latitude`, `longitude`, `altitude`,
  `source`, `confidence`, `extracted_at`.
- `gps_rtree` SQLite R-Tree index for spatial queries.
- Optional `place_labels` cache if offline reverse geocoding is added later.

**Rendering**
- A future **Places** screen with a globe projection.
- Recommended: MapLibre GL JS globe projection with bundled Natural Earth
  country/region geometry. No online tile server and no external geocoding.
- Fallback evaluation: `react-globe.gl` / `globe.gl` with a local earth texture
  if MapLibre without tiles cannot meet the visual/performance bar.
- Cluster points in the DB worker by zoom-level grid; never send the entire
  point set to the renderer.
- Click a cluster to open a filtered grid; click an item to open the viewer.
- Date and media-type filters apply to the map.
- Show a note such as “12,480 items with location · 73,000 without location are
  not shown.”

**Performance**
- Target <100 ms for cluster queries on 100k GPS points.
- R-Tree + indexed date/media filters.
- Cache cluster results per viewport/zoom/filter.
- Lazy render; no full point set in renderer memory.

**Privacy**
- Local-only.
- No external map tiles, geocoding APIs, or telemetry.
- No location data uploaded.

**Acceptance**
- Only items with valid GPS appear.
- Items without GPS are absent, not guessed.
- No network requests are made by the map.
- Clusters are correct and clickable.
- The viewer and catalog-only actions work from the map.
- Original files and metadata remain unchanged.

**Phase:** after v0.1; likely first future feature because it is deterministic and
lower risk than AI classification.

### 16.2 Local AI non-memory classification

**Status:** post-v0.1.  
**User-facing name:** **Non-memory images** or **Smart filters**. Avoid calling a
user's files “trash” in the UI.

**Goal:** identify screenshots, app captures, food-delivery app screens, banking
or finance screens, receipts, documents, memes, and similar low-value images so
the user can hide or review them without deleting anything.

**Scope**
- Images first; videos later.
- Run on thumbnails, not original files, to keep inference fast.
- Local model only. No cloud API, no upload, no telemetry.
- Default behavior: **suggest, do not auto-hide**.
- The user can mark “This is a memory” or “Not a memory”; feedback is stored.
- A future filter can hide confirmed/suggested non-memory images from Memory
  Lane. The filter is off by default and reversible.
- Never delete, move, rename, or edit originals.

**Classification labels**
- Screenshot / app UI
- Food delivery or restaurant app
- Banking / finance / statement
- Receipt / invoice
- Document / text page
- Meme / social capture
- Photo / memory
- Other / unknown

**Pipeline**
- Optional background stage after thumbnails, or a separate “Smart filters” job.
- Low priority, pauseable, resumable; it must not block scanning or browsing.
- Use a local image encoder/classifier:
  - recommended starting point: CLIP-style zero-shot classifier via ONNX Runtime
    with precomputed label embeddings;
  - evaluate a small fine-tuned classifier if zero-shot precision is insufficient;
  - optional OCR (for example Tesseract) only on flagged text-heavy candidates
    to improve bank-statement/receipt detection.
- Batch inference on a thumbnail size suitable for classification.
- Cache by file hash + model version; reclassify after a model update or on user
  request.
- Store confidence and model version for every result.

**Data**
- `image_classifications`: `file_id`, `label`, `confidence`, `model_version`,
  `classified_at`, `source` (`auto`/`user`), `status`
  (`suggested`/`confirmed`/`rejected`).
- `classification_feedback`: `file_id`, `label`, `user_action`, `created_at`.
- `model_versions`: `id`, `name`, `version`, `path`, `checksum`, `labels`,
  `installed_at`.

**UI**
- Future **Non-memory images** review screen with category chips, thumbnails,
  and “Keep in Memory Lane” / “Hide from Memory Lane” actions.
- Memory Lane filter: **Hide non-memory images** (off by default).
- Settings → Smart filters: enable/disable, sensitivity threshold, model version,
  disk usage, reclassify action.
- A count/banner when items are hidden: “X non-memory images hidden · Review.”
- No bulk delete, move, rename, or cleanup actions.

**Model packaging**
- Models live in `resources/models` with a `model-manifest.json` and SHA-256
  checksums.
- `onnxruntime-node` and other native inference dependencies are unpacked with
  `asarUnpack`.
- Model licenses and attribution go in `THIRD_PARTY_NOTICES.md`.
- Models are fetched/verified like native binaries, not committed blindly.
- No model download at runtime unless the user explicitly requests it and the
  product decides to allow a network feature. Default is offline.

**Evaluation**
- Build a labeled fixture set covering screenshots, banking apps, food-delivery
  apps, receipts, documents, memes, and genuine photos.
- Measure precision/recall per category; prioritize **precision** because a false
  positive hides a memory.
- Record the model card, thresholds, and known failure cases.
- Classification quality is a separate evaluation suite, not just unit-test
  coverage.

**Privacy and ethics**
- Local-only; no uploads.
- User control and reversibility.
- No automatic deletion.
- Avoid judgmental UI language.
- Clear “suggested” vs “confirmed” states.

**Acceptance**
- No network calls during classification.
- No original file is modified.
- Suggestions are reversible and reviewable.
- The filter is off by default.
- Results record model version and confidence.
- False-positive review is possible for every category.
- Classification never blocks browsing or scanning.

**Phase:** after v0.1. Sequence map first, then AI classification after a model
spike and evaluation set exist.

### 16.3 Future navigation

These add to the app only when implemented:
- **Places** — 7th sidebar destination for the globe/map.
- **Non-memory images** — review route, linked from Settings → Smart filters and
  from the Memory Lane filter banner.

They are not part of the v0.1 sidebar, acceptance criteria, or mockups.

### 16.4 Future schema discipline

Future features get:
- a new ADR;
- a new SQLite migration;
- a feature flag or default-off setting;
- unit/integration/E2E coverage;
- a privacy review;
- explicit acceptance criteria.

No future feature may mutate original files or introduce an external API
dependency without a scope change.
