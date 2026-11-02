# Memory Lane --- Product Specification

**Status:** Product baseline; Phases 0-5 implemented, Phase 6 automated hardening complete; post-v0.1 replication and video compatibility implemented\
**Platform:** Windows desktop\
**Version:** 0.9\
**Date:** 2026-11-01\
**Scope companion:** `scope-and-implementation.md`

## 1. Product vision

Memory Lane is a local-first, catalog-first archive manager designed to help
people rediscover personal memories stored across large, messy external
hard drives.

Its primary experience is a chronological visual library of photos and
videos. It should feel like revisiting memories, not managing a
conventional file system.

The app indexes files in place. It does not reorganize the archive or modify
original files. The single exception is the explicit duplicate quarantine
action: one keeper per exact group stays in place and the other copies move to
`X:\.memorylane_quarantine\`. Nothing is deleted or edited.

## 2. Goals

-   Catalog all file types on an external drive.
-   Make photos and videos easy to browse together chronologically.
-   Support large archives (the current archive is approximately 2 TB).
-   Preserve original files and folder structures without modification.
-   Keep the catalog and generated cache on the external drive.
-   Provide reliable scanning, validation, duplicate detection, and
    progress reporting.
-   Remain responsive while scanning and generating thumbnails over USB
    3.
-   Keep each archive drive's catalog independent.
-   Plan the architecture for a future multi-drive, partial-backup
    workflow.

## 3. Non-goals

-   Moving, renaming, editing, or deleting original files.
-   Physically organizing files into new folders.
-   Opening or editing every document format inside the app.
-   Uploading archive contents to cloud services.
-   Requiring an online account or cloud dependency.
-   Combining multiple archive drives into one live catalog in the
    initial release.

## 4. Platform and technology

Initial technology choice:

-   Windows desktop application.
-   React + TypeScript for the UI.
-   Electron for the desktop shell.
-   Node.js for filesystem and application services.
-   SQLite for the per-drive catalog.

The current build uses ExifTool 13.60 for image/video metadata, Electron native
thumbnails, dependency-free image and MP4/MOV readers as fallbacks, Node
SHA-256, and `better-sqlite3` in a dedicated worker. ffmpeg/ffprobe, Sharp, and
SQLite FTS5 remain candidates for later phases.

The app must work offline. No cloud service, account, telemetry, or external
API is required.

### 4.1 Electron security boundary

-   Filesystem access belongs in the Electron main process or trusted
    Node services.
-   The renderer must not have unrestricted Node.js access.
-   Expose a narrow, validated preload/IPC API.
-   Keep source-drive operations read-only except for the reviewed duplicate
    quarantine mover.

## 5. Source safety guarantee

The original archive is read-only from the app's perspective, with one explicit
and audited exception: confirmed exact duplicates may be moved to the
root-level `.memorylane_quarantine` folder.

The app must never provide or invoke functionality to:

-   Delete source files or folders.
-   Move source files or folders except into `.memorylane_quarantine`.
-   Rename source files or folders outside the quarantine mover.
-   Edit source file contents.
-   Create folders or sidecar files inside original archive folders outside
    `.memorylane_quarantine`.

The quarantine mover must re-hash every source file immediately before the
same-volume rename, preserve relative paths, write a journal entry for every
move, and keep one verified keeper per group.

Allowed operations include:

-   Enumerating directories and reading file metadata.
-   Reading source files to extract metadata, calculate hashes, generate
    thumbnails, and play media.
-   Opening an original file's containing folder in Windows Explorer.
-   Opening a file externally through the operating system, where
    appropriate.
-   Moving eligible duplicate copies to the quarantine folder after an explicit
    confirmation.

The app may write its own catalog database, cache, logs, and backup
files in designated application-managed locations. These must remain
outside the original archive folder structure.

Implementation must consider Windows filesystem behavior such as
access-time updates. If strict preservation of all source filesystem
metadata is required, validate whether reads can update access
timestamps and configure/document the behavior appropriately.

## 6. Drive selection and identity

The user selects a drive before entering the archive experience.

The app must identify a drive independently of its drive letter. Drive
identity should use stable available identifiers, such as:

-   Volume serial number or another stable volume identifier.
-   Volume label.
-   Filesystem information where useful.
-   Original root path.
-   Last known drive letter.
-   Last successful scan and connection status.

The app should validate that a reconnected drive is the expected drive.

If the same drive is reconnected with a different drive letter:

1.  Recognize the likely drive using its identity.
2.  Ask the user to confirm before updating the catalog's root path.
3.  Do not silently treat it as a new archive.

The UI should show the selected drive, its identity, validation status,
and relevant scan information.

## 7. Catalog and storage model

Each archive drive has its own independent SQLite database stored on
that same external drive. The PC backup of the database is an additional
safety copy, not a central catalog or a dependency.

The database must not be stored inside the original archive folders. Use
an application-managed location on the drive.

The exact folder layout is an implementation decision, but it should
clearly separate:

-   SQLite catalog.
-   Generated media cache.
-   Other app-managed state, if needed.

### 7.1 Suggested catalog data

The schema should support at least:

-   Registered drive identity and root information.
-   Scanned roots and directory/file paths.
-   File size, timestamps, extension, detected format, and MIME/type
    classification.
-   Extracted metadata and metadata provenance.
-   Photo and video metadata.
-   Resolved date, date precision, source, and confidence.
-   User-assigned date overrides.
-   SHA-256 hashes.
-   Duplicate groups or equivalent hash-based relationships.
-   Scan sessions and stage progress.
-   Validation sessions and results.
-   Missing-file state.
-   Proposed moved-file matches and user decisions.
-   Cache references and generation status.
-   Backup history and database backup status.

Use indexes for common browsing operations, especially date, media type,
path, hash, and status. Use transactions and safe SQLite backup
mechanisms. WAL mode may be appropriate, subject to testing with
removable drives and safe shutdown behavior.

## 8. Database backup to the PC

The SQLite catalog should be backed up automatically to the PC's
internal drive.

Schedule:

-   Periodically every 15 minutes while the app is open.
-   Again when the app closes.

Use a SQLite-safe backup mechanism rather than copying a live database
file in a way that could produce an inconsistent backup.

The media thumbnail/cache folder is not included in the PC database
backup.

The PC backup is an additional copy of the catalog only. The external
drive remains the owner of its independent catalog.

## 9. Initial scan and incremental scanning

### 9.1 Explicit scan start

The user explicitly starts the initial scan with a **Start scan**
action.

Use a staged workflow:

1.  **Catalog files:** Enumerate directories and files, recording paths
    and basic filesystem metadata.
2.  **Extract metadata:** Extract supported metadata, with particular
    attention to photos and videos.
3.  **Generate thumbnails:** Generate photo and video thumbnails in the
    background.
4.  **Calculate hashes:** Calculate SHA-256 hashes as a separate
    background stage. Large files without a same-size peer use a sampled
    fingerprint instead; they are fully hashed when a duplicate/move candidate
    or replication/validation needs a full source hash.

Do not require all stages to finish before the user can browse the
catalog. The catalog should become useful as early as possible.

### 9.2 Progress reporting

Show distinct progress for each stage, not just one overall percentage.
For example:

-   Files cataloged: `42,000 / 85,000`
-   Metadata processed: `31,200 / 85,000`
-   Thumbnails generated: `12,450 / 60,000`
-   Hashes calculated: `8,000 / 85,000`

Where totals are not yet known, communicate that the total is being
discovered rather than showing misleading percentages.

### 9.3 Interrupted work and resume

If the app closes or the drive disconnects:

-   Stop the active scan/processing task safely.
-   Persist completed work and progress.
-   Do not automatically resume on next launch.
-   Require the user to explicitly click Resume.

If the drive disconnects during a scan, stop the scan and preserve
progress. After reconnecting and confirming the drive identity/path, the
user can manually resume.

### 9.4 Incremental scans

A later scan should detect changes and update the catalog automatically:

-   New files are added.
-   Modified files have relevant extracted metadata refreshed.
-   Existing manual date overrides are preserved unless the user
    explicitly changes them.
-   Files no longer present at their recorded paths are marked as
    missing.

Missing files must not be removed from the catalog automatically.

Show a clear report, for example:

> 12 pictures and 3 videos were removed since the last scan.

Provide a list of missing files, including their former locations. The
wording should avoid implying the app deleted them; they may have been
moved or removed externally.

### 9.5 Detecting files moved outside the app

Use SHA-256 to find files that disappeared from their previous paths but
appear elsewhere on the drive.

Present likely moved-file matches as a batch, not one prompt per file.
For example, if 12 files have been matched:

-   Show the 12 old and new locations together.
-   Offer batch confirmation.
-   Allow individual exceptions to be reviewed.
-   Update catalog locations only after user confirmation.

Do not modify the actual files or folders.

## 10. Duplicate detection

Use SHA-256 to identify exact duplicate files.

The UI should:

-   Display a **Has duplicates** flag on matching files.
-   Open a popup or detail view listing every matching copy.
-   Show the location of each copy.
-   Mark one copy `KEEP` and the others `MOVE` when the group is eligible.
-   Report skipped groups and the reason instead of silently dropping them.

Duplicate cleanup is an explicit, confirmed action. Keep one copy per exact
group and move the rest to `X:\.memorylane_quarantine\<run>\`. Never delete,
rename, or edit an original. Re-hash every file immediately before the
same-volume rename, write a journal entry for every move, and delete only the
moved catalog rows after a successful batch. Groups are skipped when the keeper
does not have verified backup coverage, a copy has a conflicting date override,
a file is a hard link, or files are empty or under 1 KB.

Hashing should be a separate, resumable background stage because hashing
a large archive can take substantial time.

## 11. Memory Lane browsing experience

### 11.1 Primary experience

The primary view is category-based, not a reproduction of Windows
Explorer's folder tree.

Photos and videos are grouped together in a chronological Memory Lane
experience.

Provide:

-   One continuous chronological timeline.
-   Navigation by year and month.
-   A dense visual grid for browsing.
-   A larger viewing experience when opening an item.
-   Photos displayed directly in the app.
-   Videos playable directly in the app.
-   A way to open the original file's containing folder in Windows
    Explorer.

Photos and videos should be treated as one memory collection rather than
separate primary browsing areas.

### 11.2 Other file types

The app catalogs all file types, not only photos and videos.

It should classify and expose useful metadata for other files, but does
not need built-in PDF, Word, spreadsheet, or ebook viewers. Users can
open those files externally through Windows when appropriate.

Support broad format identification. WMV, 3GP, and other videos that fail
direct Chromium playback use an on-demand cached MP4 compatible copy generated
with the bundled FFmpeg binary. The original stays read-only. Unsupported
formats should still be identified clearly and offer external open rather than
crashing the viewer.

### 11.3 Date organization and uncertainty

Determine the best available date using a defined priority order across
embedded metadata and filesystem dates. Preserve:

-   Resolved browsing date.
-   Date precision (year, year/month, or exact date/time).
-   Original extracted value.
-   Source/provenance.
-   Confidence or reliability indicators.

Do not silently invent a date.

Examples:

-   If no reliable date exists, place the item in a **Date unavailable**
    collection.
-   If a date is clearly suspicious, such as a photo dated in the year
    2099, flag it for review instead of confidently placing it in the
    timeline.
-   If a date is uncertain, communicate that uncertainty in the UI.

The precise date-priority rules and suspicious-date heuristics need to
be specified and tested during implementation.

### 11.4 Manual date assignment

Users can assign dates to items in the Date unavailable collection and
in normal timeline collections.

Support both:

-   Individual assignment.
-   Bulk assignment to multiple selected files.

Use a selector that allows assignment at year or year/month precision.
Do not invent a day when the user only supplies a year or month.

A manually assigned date becomes the date used for browsing. Preserve
the originally extracted date and provenance in the catalog so the
override is reversible and auditable.

All manual corrections affect catalog metadata only. Never write them
into original files.

## 12. Thumbnail cache and media previews

Generated thumbnails and previews must be stored in a dedicated
app-managed cache folder on the external drive, separate from original
folders and separate from the SQLite database.

Requirements:

-   Cache stays on the external drive.
-   Cache is not part of the PC database backup.
-   Cache has no automatic size limit in the initial design.
-   UI displays current cache size.
-   Provide a manual **Clear cache** action.
-   Cache is disposable and regenerable.
-   Clearing the cache must never affect original files or catalog
    entries.
-   Do not cache entire videos as a browsing strategy.

Use small thumbnails for grid browsing and generate larger previews only
when useful or requested.

A rough early estimate for a 2 TB archive was discussed as 3--15 GB, but
this is highly dependent on the number of photos/videos, thumbnail
dimensions, and encoding. Treat it as a planning estimate only; measure
actual cache growth during prototyping.

## 13. Performance requirements

Performance is a core requirement. The app will run against an external
drive over USB 3, and the archive is approximately 2 TB. The PC is
relatively powerful, but responsiveness is more important than
maximizing raw background throughput.

### 13.1 Browsing performance

-   Use a virtualized grid so only visible items are rendered.
-   Load thumbnails lazily.
-   Use pagination or indexed queries rather than loading the entire
    archive into memory.
-   Avoid repeated full-drive scans for normal browsing.
-   Load video previews without opening or decoding full videos in the
    grid.
-   Read the original video only when the user opens it for playback.
-   Keep database access efficient and indexed.

### 13.2 Priority scheduling

Thumbnail generation should run in the background, but browsing demand
takes priority.

If the user navigates to a year/month whose items do not yet have
thumbnails:

1.  Prioritize items visible in the current view.
2.  Then prioritize nearby/next likely visible items.
3.  Continue general background generation with remaining capacity.

This work should be concurrent where beneficial, while avoiding
excessive random I/O or CPU contention on the external drive.

### 13.3 Background processing controls

Default behavior: automatically use available resources while keeping
the UI responsive.

Provide controls to:

-   Pause background processing.
-   Resume background processing.
-   Limit processing intensity.

Interactive thumbnail requests should take priority over bulk thumbnail
generation and hashing. Browsing and video playback should take priority
over background work.

## 14. Validation

Provide a user-triggered **Validate files** operation to compare the
catalog with the actual drive contents.

Validation should support independently selectable levels:

1.  **Existence check:** Confirm cataloged paths still exist.
2.  **Basic metadata check:** Compare values such as file size and
    modification time.
3.  **Deep integrity check:** Calculate/compare SHA-256 hashes.
4.  **Metadata revalidation:** Re-extract metadata where needed.

Routine validation should be relatively fast. Deep hashing can be a
separate, resumable operation.

Show a validation report in the UI. Do not modify original files.
Missing files remain cataloged and marked as missing.

## 15. Archive replication and source promotion

**Status:** implemented in the post-v0.1 replication release. The v0.1
single-drive workflow remains unchanged.

Detailed design, formulas, failure behavior, and resolved decisions:
[`partial-backups.md`](partial-backups.md).

The user expects to connect smaller destination drives and back up the archive
because no single destination can hold it. The feature must record which exact
source files were copied to which destination, verify copies, and report
cumulative coverage.

**Adoption-first requirement:** the user already has manual partial backups.
A 4 TB source archive is split across two 1 TB destination drives, and both
drives already contain subsets copied outside Memory Lane. The feature must
adopt that existing state rather than require a fresh backup or a new folder
layout.

**Confirmed direction:** support partial destinations, explicit full-copy
destinations, and a guided promotion of a verified full copy into the new source
archive. Plan the entire source archive, fill partial destinations in priority
order from oldest files to newest, copy what fits, and report the remainder. The
user does not select files in the first version.

**First-release scope:** destinations must be dedicated drives, not active
source archives. Scan, validation, and replication are mutually exclusive heavy
workloads, and switching the source archive is blocked while a run is running or
paused. Dual-role destinations and promotion from a dual-role drive are deferred.

Requirements:

-   Use **source archive** for the truth copy and **backup destination** for a
    drive that holds a copy. These are archive relationships, not permanent
    drive types.
-   Support partial backups that fit on smaller destination drives.
-   **Scan and adopt existing destination contents before copying anything
    new.** Do not require the user to re-copy, move, or reorganize files that
    are already on a destination.
-   Match existing destination files by source-relative path and size, then by
    unique name and size, then by content hash. Verify SHA-256.
-   Record source-to-destination file relationships and verification status.
-   Allow a source file to live on zero, one, or multiple destinations.
    Coverage is the **union** of verified copies and must not double-count a
    file that exists on two destinations.
-   Partial destinations fill gaps only. A full-copy destination may
    intentionally receive every source file, including files already verified
    on partial destinations. Plan the two groups separately.
-   After adoption, copy only files that are missing, unverified, stale, or not
    covered by any active partial destination.
-   Plan the entire present source archive in chronological order, oldest
    first. Files with no reliable date come last, ordered by path.
-   Fill partial destinations in user-defined priority order. The first
    destination in fill order receives the oldest **uncovered** files until its
    allocation is reached; the next destination continues from there. Existing
    destination files are never moved to make date ranges cleaner.
-   Let the user choose a safe allocation per destination, including **Use all
    safe space**. Default reserve: 2% of capacity with a 5 GiB minimum.
-   Support a per-destination goal: **extend coverage** or **full copy**. A
    full-copy destination receives every present source file, even when partial
    destinations already cover it. Full copy is optional: partial-only archives
    must work, and a completed full copy can be excluded from later runs.
-   A full-copy destination must fit the entire source plus the reserve. If it
    does not, show the shortfall and do not label it full.
-   If the source later grows beyond a full-copy destination, automatically mark
    it partial with a warning. Keep its existing files and show what is missing.
-   When partial capacity runs out, copy what fits and report the exact
    remainder. Do not ask the user to choose a subset.
-   The app copies files after plan confirmation, with pause and resume. It
    must never imply a file is backed up because a copy was attempted.
-   A running backup has a persistent status on every screen and a run banner on
    the overview, so the progress screen is always one click away. Reopening the
    app during a run resumes the run screen or shows a resume card; it never
    starts a second run.
-   Allow at most one active run per source archive. Lock plan and destination
    changes while the run is active; pause, confirm the change, and resume.
    Changes apply only to remaining work and never recopy or move verified
    files.
-   Adding a destination during a run is queued for the next plan. Promotion is
    blocked while a run is running or paused.
-   Preserve the existing destination layout. New copies use a dedicated
    `Memory Lane\<archive>` folder by default so they do not mix with manual
    files. A mirror layout is available for drives that should keep the source
    structure at their root.
-   Store both destination-relative and source-relative paths for each replica.
    The source-relative path is the stable coverage key when a source root moves
    or a destination is promoted.
-   Each destination keeps its own local library catalog and cache for its own
    files, plus a compact read-only source index. The source catalog remains the
    authority for coverage. Catalog files carry
    `source_membership = source | local_only`; source coverage and planning use
    only `source` files, while the local library shows both.
-   A destination that was already initialized in Memory Lane reuses its
    existing catalog instead of creating a second one.
-   Identify destinations by stable volume identity, not drive letter. Use a
    destination marker as a second identity factor when two drives look
    identical.
-   Hard-reject a destination on the same volume as the source archive, or with
    overlapping source/destination roots. A drive may be a source for its own
    local library and a destination for a different archive.
-   Show per-destination coverage, cumulative coverage, free space, overlaps,
    full-copy status, stale/missing copies, and the remainder. Coverage is by
    verified bytes and file count.
-   Show each destination’s actual date coverage as a map, not a single range
    when the years are mixed or non-contiguous. Do not imply that the first
    destination is the “older” drive.
-   Detect source files that changed after backup and mark the copy stale.
    Replace stale copies only after a once-per-run approval, on their existing
    destination first. A stale replacement may temporarily use the reserve but
    must keep at least 1 GiB free and show a warning. New copies never use the
    reserve.
-   A different hash at the expected path on first adoption is a conflict, not a
    stale copy. Never overwrite it automatically.
-   Detect files that exist only on a backup destination and show them under
    **Only on this drive**. They are visible in the destination’s local
    library, but are never counted as source coverage, copied to the source or
    other destinations automatically, or deleted automatically. If a file was
    once present in the source index but is no longer in the source catalog,
    label it **Previously in source**.
-   Distinguish a destination-only extra from a source-missing replica. A
    verified replica whose source file is missing is shown as “Source missing;
    backup copy exists.” Restoring it is an explicit recovery action, never
    automatic.
-   Fill gaps only for partial destinations. Full-copy destinations are the
    explicit intentional-overlap exception.
-   Allow a verified full-copy destination to be promoted to the new source
    archive without moving files or re-hashing. Preserve the archive identity,
    dates, overrides, duplicates, and coverage history.
-   After promotion, keep the old source as a full-copy destination when it
    still fits, or as a partial destination when the new source outgrows it.
    The user chooses whether to keep or retire the existing 1 TB destinations.
-   Allow only one active source catalog per archive identity. Rollback is
    guaranteed only before the first change on the new source; after that it is
    disabled unless a merge-back feature exists.
-   Leave destination-only files out of the new source archive. Keep them
    visible in the local library; never import or delete them automatically.
-   Report source-missing replicas as an attention count. Restoring a file into
    the source archive and destination reveal/open are deferred so the first
    release keeps the source read-only.
-   If a full-copy destination runs out of space, mark it incomplete and do not
    spill its files to partial destinations.
-   Preserve the source archive files unchanged.

First-run adoption flow:

1.  Connect one of the existing destination drives. A destination is required;
    a full-copy destination is not.
2.  Register its stable volume identity, choose the destination root (the drive
    root is recommended for reorganized drives), and scan its current contents.
3.  Reuse its existing local catalog if it has one; otherwise create one.
4.  Match files by relative path and size, then name and size, then content
    hash. Verify SHA-256.
5.  Record each existing file as verified, unverified, stale, missing, or
    conflicting without modifying or moving it.
6.  Show what this destination already covers, its actual date coverage map,
    including overlapping or non-contiguous years, and any files that are only
    on this drive.
7.  Choose the destination goal: extend coverage or full copy.
8.  Repeat for the other destination drives.
9.  Review the plan: full-copy destinations, partial destinations, adopted
    bytes, new files, planned date range, and the remainder.
10. Start the backup, verify each copy, update local libraries, and report the
    final coverage.

An initial adoption pass may need to hash existing destination files to prove
coverage. That is a read-only verification cost, not a re-copy.

Full-copy and promotion flow:

1.  Add the new large drive as a **full-copy destination**.
2.  Copy and verify every present source file. If the drive cannot fit the
    source, show the shortfall and do not call it a full copy.
3.  If the drive should become the new source, run the guided promotion flow.
4.  Preserve the archive identity, dates, overrides, duplicates, and coverage.
    Demote the old source and choose whether it becomes a full or partial
    destination.
5.  Keep or retire the existing 1 TB destinations.
6.  If the source later grows beyond the old 4 TB drive, automatically mark it
    partial and show what no longer fits.

Architecture implications: the initial data model already reserves
`backup_destinations` and `backup_history`. Do not merge independent source
catalogs to support this feature. Implement it after v0.1 with its own ADR,
migration, verification workflow, and tests. The authoritative coverage map
belongs in the source archive’s `catalog.db`; the PC `app.db` is only a cache.
Full-copy destinations and source promotion are recorded in
[`../adr/0007-promote-full-copy-to-source.md`](../adr/0007-promote-full-copy-to-source.md).

## 16. Initial UI areas

The exact design will be refined separately, but the product likely
needs:

1.  **Drive selection / identity**
    -   Registered drive details.
    -   Identity validation.
    -   Connection state.
    -   Confirm changed drive letter.
2.  **Scan and processing status**
    -   Start scan / Resume scan.
    -   Per-stage progress.
    -   Pause/resume background processing.
    -   Processing intensity control.
    -   Validation action and report.
3.  **Memory Lane**
    -   Chronological grid.
    -   Year/month navigation.
    -   Photo viewer and video player.
    -   Duplicate indicator.
    -   Original location and open-in-Explorer action.
4.  **Date unavailable**
    -   Items without reliable dates.
    -   Individual and bulk date assignment.
5.  **Missing files / scan changes**
    -   Missing-file summary and list.
    -   Suggested moved-file matches.
    -   Batch confirmation and individual review.
6.  **Other files**
    -   Category-based catalog of non-photo/video files.
    -   Metadata and original location.
    -   External open action where appropriate.
7.  **Storage and settings**
    -   Cache size.
    -   Clear cache.
    -   Database backup status/location.
    -   Background processing controls.

## 17. Key acceptance criteria

The initial release should not be considered complete unless:

-   The app can select and identify an external drive beyond its drive
    letter.
-   A drive-letter change triggers confirmation before updating the root
    path.
-   The app never deletes or edits original files. It only moves confirmed
    duplicate copies into `.memorylane_quarantine` after a full re-hash.
-   The catalog database and media cache live in app-managed locations
    on the external drive.
-   The SQLite catalog is backed up to the PC every 15 minutes while
    open and on close.
-   The initial scan is explicitly started by the user and runs in
    stages.
-   Progress is visible separately for cataloging, metadata extraction,
    thumbnails, and hashing.
-   Interrupted work is preserved and requires manual resume.
-   Photos and videos appear together in a chronological timeline with
    year/month navigation.
-   Grid browsing is virtualized and thumbnail generation prioritizes
    the current view.
-   Photos can be viewed and videos played in-app.
-   Manual dates can be assigned individually or in bulk at year or
    year/month precision.
-   Manual date overrides do not modify original files and preserve
    extracted date information.
-   Duplicate files are detected by SHA-256 and shown with all
    locations.
-   Missing files are reported and retained in the catalog.
-   Moved-file suggestions are grouped for batch confirmation.
-   Cache size is visible and cache cleanup is available without
    affecting originals.
-   A user-triggered validation workflow produces a report.
-   The architecture leaves room for the future partial multi-drive
    backup feature without merging independent source catalogs.

## 18. Open implementation decisions

These items remain open and should be resolved before or during the owning
phase:

-   Timezone conversion policy when EXIF wall-clock dates are displayed outside
    the capture timezone.
-   ExifTool concurrency and performance on a 100,000-item mixed corpus.
-   Supported image/video formats, codec strategy, and whether ffmpeg/ffprobe or
    Sharp are needed for unsupported playback or thumbnails.
-   Whether filesystem access-time updates must be prevented.
-   Behavior for unreadable, encrypted, corrupt, or permission-restricted files.
-   Search design and whether SQLite FTS5 is required (post-v0.1).

Replication-specific decisions, including conflict handling, destination
capacity, and one destination relationship per drive, are resolved in
[`partial-backups.md`](partial-backups.md) §16.

Resolved during Phases 4-5: validation outcomes and wording; all-generated-assets
cache clearing; latest-snapshot backup retention with manual recovery.

## 19. Product name

Working name: **Memory Lane**.

This is a descriptive working title, not a completed trademark or domain
availability check.
