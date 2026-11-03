# Batch 2 review — Scan and library

Status: **verified**. Requirements: **24**. Conflicts: **0**.

This sheet is generated from `docs/traceability/requirements.json`. This batch is accepted; the matrix is the live view. New requirements start at `needs-review`.

Kinds: invariant 6, outcome 16, constraint 2.

## Summary

| ID | Kind | Status | Title |
|---|---|---|---|
| ML-SCAN-001 | invariant | verified | Drive identity is stable and independent of the drive letter |
| ML-SCAN-002 | outcome | verified | A changed drive letter requires confirmation |
| ML-SCAN-003 | invariant | verified | Each archive drive owns its catalog and cache |
| ML-SCAN-004 | outcome | verified | Scan starts only on explicit user action |
| ML-SCAN-005 | outcome | verified | Scan runs four stages and browsing unlocks after catalog |
| ML-SCAN-006 | outcome | verified | Pause persists progress and resume continues |
| ML-SCAN-007 | outcome | verified | Close or disconnect interrupts safely |
| ML-SCAN-008 | outcome | verified | Incremental scan detects new, changed, missing, and moved |
| ML-SCAN-009 | outcome | verified | Scan report counts new, changed, missing, and moved |
| ML-SCAN-010 | invariant | verified | Large files use a quick fingerprint until a full hash is needed |
| ML-SCAN-011 | outcome | verified | Metadata extraction is versioned and refreshable |
| ML-SCAN-012 | invariant | verified | Dates preserve provenance and never invent a value |
| ML-SCAN-013 | outcome | verified | Manual dates use year or year-month precision |
| ML-SCAN-014 | constraint | verified | Browsing and scanning stay responsive at 100k+ items |
| ML-LIB-001 | outcome | verified | One chronological timeline for photos and videos |
| ML-LIB-002 | outcome | verified | Year/month navigation and date grouping honor precision |
| ML-LIB-003 | constraint | verified | The grid is virtualized and thumbnails are lazy |
| ML-LIB-004 | outcome | verified | The viewer supports photos, videos, and filter-aware navigation |
| ML-LIB-005 | outcome | verified | Item details and missing states retain catalog context |
| ML-LIB-006 | invariant | verified | Media URLs use catalog IDs and byte ranges |
| ML-LIB-007 | outcome | verified | Thumbnails are cached, deduplicated, and failure-safe |
| ML-LIB-008 | outcome | verified | HEIC previews are generated on demand and cached |
| ML-LIB-009 | outcome | verified | WMV/3GP and failed playback use a cached MP4 proxy |
| ML-LIB-010 | invariant | verified | The cache is disposable and never affects originals |

## Requirements

### ML-SCAN-001 — Drive identity is stable and independent of the drive letter

- **Kind:** invariant
- **Status:** verified
- **Proposed:** A drive is identified by a stable volume identity, not by its drive letter. The catalog validates the identity on open.
- **Current / source:** The app must identify a drive independently of its drive letter.
- **Sources:** `docs/product/product-specification.md#6-drive-selection-and-identity`, `docs/product/scope-and-implementation.md#51-process-model`, `docs/contracts/scan.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/scan.md`
- **Existing tests:** `src/main/modules/drives/application/drive-service.test.ts`, `src/main/modules/drives/infrastructure/volume-identity.test.ts`, `src/main/modules/drives/application/list-detected-drives.test.ts`
- **Test notes:** Candidate tests cover identity and drive listing; not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-SCAN-002 — A changed drive letter requires confirmation

- **Kind:** outcome
- **Status:** verified
- **Proposed:** A changed drive letter is recognized by identity and requires explicit confirmation before the catalog root is updated. It is never treated as a new archive silently.
- **Current / source:** If the same drive is reconnected with a different drive letter, ask the user to confirm before updating the catalog root.
- **Sources:** `docs/product/product-specification.md#6-drive-selection-and-identity`, `docs/contracts/scan.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/scan.md`
- **Existing tests:** `src/main/modules/drives/application/drive-service.test.ts`, `src/renderer/src/features/drives/DriveSelectionPage.test.tsx`, `tests/e2e/foundation.spec.ts`
- **Test notes:** Candidate tests cover changed-letter handling; not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-SCAN-003 — Each archive drive owns its catalog and cache

- **Kind:** invariant
- **Status:** verified
- **Proposed:** Each archive drive owns a self-contained `.memorylane/catalog.db` and app-managed cache, separate from original folders. The PC backup is a safety copy, not the owner.
- **Current / source:** Each archive drive has its own independent SQLite database stored on that drive, separate from original folders.
- **Sources:** `docs/product/product-specification.md#7-catalog-and-storage-model`, `docs/product/scope-and-implementation.md#54-data-model`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/scan.md`
- **Existing tests:** `src/main/modules/drives/application/drive-service.test.ts`, `src/main/db/catalog-registry.test.ts`, `src/main/db/connection.test.ts`
- **Test notes:** Candidate tests cover catalog creation and connections; not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-SCAN-004 — Scan starts only on explicit user action

- **Kind:** outcome
- **Status:** verified
- **Proposed:** A scan starts only on explicit user action. After interruption, resume is explicit; the app never resumes automatically.
- **Current / source:** The user explicitly starts the initial scan with a Start scan action. Do not automatically resume.
- **Sources:** `docs/product/product-specification.md#91-explicit-scan-start`, `docs/product/product-specification.md#93-interrupted-work-and-resume`, `docs/contracts/scan.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/scan.md`
- **Existing tests:** `tests/integration/scan-service.test.ts`, `tests/integration/scan-controls.test.ts`, `src/renderer/src/features/scan/ScanPage.test.tsx`
- **Test notes:** Candidate tests cover start, pause, resume, and UI state; not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-SCAN-005 — Scan runs four stages and browsing unlocks after catalog

- **Kind:** outcome
- **Status:** verified
- **Proposed:** A scan runs four ordered stages: catalog, metadata, thumbnails, hashes. Browsing unlocks after the catalog stage; later stages continue in the background.
- **Current / source:** Use a staged workflow: catalog, metadata, thumbnails, hashes. Do not require all stages to finish before browsing.
- **Sources:** `docs/product/product-specification.md#91-explicit-scan-start`, `docs/contracts/scan.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/scan.md`
- **Existing tests:** `tests/integration/scan-service.test.ts`, `src/renderer/src/features/scan/ScanPage.test.tsx`
- **Test notes:** Candidate tests assert the four stages and stage order; not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-SCAN-006 — Pause persists progress and resume continues

- **Kind:** outcome
- **Status:** verified
- **Proposed:** Pause finishes the current file or batch, persists per-stage progress, and stops scheduling new work. Resume continues from that saved progress without recopying completed work.
- **Current / source:** Pause completes the current file or batch, persists progress, and stops scheduling new work. Resume continues from saved per-stage progress.
- **Sources:** `docs/contracts/scan.md`, `docs/product/product-specification.md#133-background-processing-controls`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/scan.md`
- **Existing tests:** `tests/integration/scan-controls.test.ts`, `src/main/db/repositories/scan-session-repository.test.ts`
- **Test notes:** Candidate tests cover pause/resume and persisted session state; not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-SCAN-007 — Close or disconnect interrupts safely

- **Kind:** outcome
- **Status:** verified
- **Proposed:** App close or drive disconnect marks the scan interrupted, preserves completed work, and requires explicit resume after reconnect.
- **Current / source:** If the app closes or the drive disconnects, stop safely, persist completed work, and require explicit resume.
- **Sources:** `docs/product/product-specification.md#93-interrupted-work-and-resume`, `docs/contracts/scan.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/scan.md`
- **Existing tests:** `tests/integration/recovery.test.ts`, `tests/integration/scan-service.test.ts`
- **Test notes:** Candidate tests cover interruption and recovery; not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-SCAN-008 — Incremental scan detects new, changed, missing, and moved

- **Kind:** outcome
- **Status:** verified
- **Proposed:** An incremental scan adds new files, refreshes changed files, marks missing files, and proposes moved candidates. Missing files stay in the catalog.
- **Current / source:** A later scan detects new, modified, missing, and moved files; missing files are not removed automatically.
- **Sources:** `docs/product/product-specification.md#94-incremental-scans`, `docs/product/product-specification.md#95-detecting-files-moved-outside-the-app`, `docs/contracts/scan.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/scan.md`
- **Existing tests:** `tests/integration/scan-service.test.ts`, `src/main/db/repositories/scan-catalog-repository.test.ts`
- **Test notes:** Candidate tests cover incremental reports and moved candidates; not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-SCAN-009 — Scan report counts new, changed, missing, and moved

- **Kind:** outcome
- **Status:** verified
- **Proposed:** A completed scan reports newFiles, changedFiles, missingFiles, and movedCandidates. The report is null until the scan completes.
- **Current / source:** ScanReport has newFiles, changedFiles, missingFiles, movedCandidates; report is non-null only when complete.
- **Sources:** `docs/contracts/scan.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/scan.md`
- **Existing tests:** `tests/integration/scan-service.test.ts`, `src/renderer/src/features/scan/ScanPage.test.tsx`
- **Test notes:** Candidate tests assert report shape and completion state; not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-SCAN-010 — Large files use a quick fingerprint until a full hash is needed

- **Kind:** invariant
- **Status:** verified
- **Proposed:** Files over the quick-hash threshold use a sampled fingerprint only until a full SHA-256 is required by a duplicate, move, replication, or validation decision. Existing full hashes are reused.
- **Current / source:** Large files without a same-size peer use a sampled fingerprint; full SHA-256 is computed when a duplicate/move candidate or replication/validation needs it.
- **Sources:** `docs/contracts/scan.md`, `docs/product/product-specification.md#91-explicit-scan-start`
- **ADRs:** `docs/adr/0002-whole-catalog-integrity.md`
- **Contracts:** `docs/contracts/scan.md`
- **Existing tests:** `src/main/modules/scanning/infrastructure/quick-file-hasher.test.ts`, `src/main/modules/scanning/infrastructure/file-hasher.test.ts`, `tests/integration/scan-service.test.ts`
- **Test notes:** Candidate tests cover quick hashing and full hashes; not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-SCAN-011 — Metadata extraction is versioned and refreshable

- **Kind:** outcome
- **Status:** verified
- **Proposed:** Metadata extraction uses ExifTool as the primary extractor with dependency-free fallbacks. Each success records the extractor version; stale metadata is reported and refreshed by an incremental scan.
- **Current / source:** ExifTool is primary with dependency-free fallbacks; successful extraction records the extractor version.
- **Sources:** `docs/adr/0001-exiftool-metadata-extraction.md`, `docs/adr/0005-versioned-metadata-extraction.md`, `docs/contracts/scan.md`, `docs/contracts/library.md`
- **ADRs:** `docs/adr/0001-exiftool-metadata-extraction.md`, `docs/adr/0005-versioned-metadata-extraction.md`
- **Contracts:** `docs/contracts/scan.md`, `docs/contracts/library.md`
- **Existing tests:** `src/main/modules/scanning/infrastructure/exif-metadata.test.ts`, `src/main/modules/scanning/infrastructure/file-metadata.test.ts`, `src/main/modules/library/application/library-service.test.ts`
- **Test notes:** Candidate tests cover extraction and metadata refresh; not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-SCAN-012 — Dates preserve provenance and never invent a value

- **Kind:** invariant
- **Status:** verified
- **Proposed:** Every resolved date preserves precision, the original extracted value, provenance, and confidence. A missing or suspicious date is shown as unavailable or flagged, never invented.
- **Current / source:** Resolve the best date, preserve precision, original value, source, and confidence; do not silently invent a date.
- **Sources:** `docs/product/product-specification.md#113-date-organization-and-uncertainty`, `docs/contracts/library.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/library.md`
- **Existing tests:** `src/main/modules/scanning/domain/date-resolution.test.ts`, `src/main/db/repositories/library-date-repository.test.ts`
- **Test notes:** Candidate tests cover date priority and precision; not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-SCAN-013 — Manual dates use year or year-month precision

- **Kind:** outcome
- **Status:** verified
- **Proposed:** Manual date assignment supports individual and bulk edits at year or year-month precision. It never invents a day, updates catalog metadata only, and preserves the extracted date for reversal.
- **Current / source:** Manual assignment accepts year or year/month; never invent a day; preserve the extracted date.
- **Sources:** `docs/product/product-specification.md#114-manual-date-assignment`, `docs/contracts/library.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/library.md`
- **Existing tests:** `src/main/modules/library/application/library-service.test.ts`, `src/main/db/repositories/library-date-repository.test.ts`, `src/renderer/src/features/library/UndatedPage.test.tsx`
- **Test notes:** Candidate tests cover manual date precision and clearing; not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-SCAN-014 — Browsing and scanning stay responsive at 100k+ items

- **Kind:** constraint
- **Status:** verified
- **Proposed:** Browsing uses a virtualized grid, lazy thumbnails, and indexed queries. Visible thumbnails preempt bulk work. The 100k and 200k query budgets remain green.
- **Current / source:** Use a virtualized grid, lazy thumbnails, indexed queries, and viewport-priority thumbnails; 100k/200k query passes.
- **Sources:** `docs/product/product-specification.md#13-performance-requirements`, `docs/product/scope-and-implementation.md#63-test-layers`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/library.md`
- **Existing tests:** `tests/integration/library-performance.test.ts`, `src/main/modules/media/thumbnail-scheduler.test.ts`, `src/renderer/src/features/library/LibraryPage.test.tsx`
- **Test notes:** Candidate tests cover query budgets and thumbnail priority; not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-LIB-001 — One chronological timeline for photos and videos

- **Kind:** outcome
- **Status:** verified
- **Proposed:** Photos and videos share one chronological timeline with all/photos/videos filters. Ordering is resolved_date DESC, then file_id DESC; undated items sort last.
- **Current / source:** Photos and videos are grouped together in one chronological timeline; filters all/photos/videos; ordering resolved_date DESC, file_id DESC; undated last.
- **Sources:** `docs/product/product-specification.md#111-primary-experience`, `docs/contracts/library.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/library.md`
- **Existing tests:** `src/main/db/repositories/library-repository.test.ts`, `src/renderer/src/features/library/LibraryPage.test.tsx`, `src/renderer/src/features/library/timeline-model.test.ts`
- **Test notes:** Candidate tests cover ordering and filters; not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-LIB-002 — Year/month navigation and date grouping honor precision

- **Kind:** outcome
- **Status:** verified
- **Proposed:** Year and month navigation anchor the timeline, and date-grouped sections use the stored precision: day, month, year, then Date unavailable.
- **Current / source:** Navigation by year and month; date grouping uses stored precision; Date unavailable is a trailing section.
- **Sources:** `docs/product/product-specification.md#113-date-organization-and-uncertainty`, `docs/contracts/library.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/library.md`
- **Existing tests:** `src/main/db/repositories/library-repository.test.ts`, `src/renderer/src/features/library/LibraryPage.test.tsx`, `src/renderer/src/features/library/timeline-model.test.ts`
- **Test notes:** Candidate tests cover anchors and grouping; not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-LIB-003 — The grid is virtualized and thumbnails are lazy

- **Kind:** constraint
- **Status:** verified
- **Proposed:** The grid renders only visible rows and loads thumbnails lazily. Visible items preempt nearby and bulk thumbnail work.
- **Current / source:** Use a virtualized grid; load thumbnails lazily; prioritize visible items.
- **Sources:** `docs/product/product-specification.md#131-browsing-performance`, `docs/product/product-specification.md#132-priority-scheduling`, `docs/contracts/library.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/library.md`
- **Existing tests:** `src/renderer/src/features/library/LibraryPage.test.tsx`, `src/main/modules/media/thumbnail-scheduler.test.ts`
- **Test notes:** Candidate tests cover virtualization and thumbnail priority; not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-LIB-004 — The viewer supports photos, videos, and filter-aware navigation

- **Kind:** outcome
- **Status:** verified
- **Proposed:** The viewer displays photos at fit/100% and plays videos natively. Previous/next carries the active filter and density, and Escape returns to the same filtered grid.
- **Current / source:** Photos display in-app; videos play in-app; previous/next carries the active filter and density; Escape returns to the filtered grid.
- **Sources:** `docs/product/product-specification.md#111-primary-experience`, `docs/contracts/library.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/library.md`
- **Existing tests:** `src/renderer/src/features/library/MediaViewerPage.test.tsx`, `tests/e2e/library.spec.ts`
- **Test notes:** Candidate tests cover viewer navigation and playback states; not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-LIB-005 — Item details and missing states retain catalog context

- **Kind:** outcome
- **Status:** verified
- **Proposed:** The viewer shows path, folder, timestamps, extracted metadata, position, previous/next, and the media URL. Missing or failed media keeps the catalog details and shows a clear unavailable state.
- **Current / source:** Details include path, folder, timestamps, metadata, position, previous/next, media URL; missing files keep details with mediaUrl null.
- **Sources:** `docs/contracts/library.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/library.md`
- **Existing tests:** `src/main/modules/library/application/library-service.test.ts`, `src/renderer/src/features/library/MediaViewerPage.test.tsx`
- **Test notes:** Candidate tests cover details and missing states; not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-LIB-006 — Media URLs use catalog IDs and byte ranges

- **Kind:** invariant
- **Status:** verified
- **Proposed:** `ml-media:` resolves catalog IDs, never renderer paths. It serves only present files, supports byte ranges and the cataloged MIME type, and returns 404 for missing files.
- **Current / source:** Resolve files by ID, never accept a renderer path; serve only present files; support byte ranges and MIME; missing returns 404.
- **Sources:** `docs/contracts/library.md`, `docs/release/security-review.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/library.md`
- **Existing tests:** `src/main/modules/media/media-request-handler.test.ts`, `src/main/modules/media/media-response.test.ts`, `src/main/modules/library/application/library-service.test.ts`
- **Test notes:** Candidate tests cover ID resolution, ranges, and missing files; not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-LIB-007 — Thumbnails are cached, deduplicated, and failure-safe

- **Kind:** outcome
- **Status:** verified
- **Proposed:** Thumbnails serve from cache when ready, otherwise generate on demand with interactive priority. In-flight work is deduplicated; failures return 404 so the grid shows a placeholder.
- **Current / source:** Serve a ready cache entry; otherwise generate on demand with interactive priority; deduplicate in-flight work; failures return 404.
- **Sources:** `docs/contracts/library.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/library.md`
- **Existing tests:** `src/main/modules/media/media-request-handler.test.ts`, `src/main/modules/media/thumbnail-scheduler.test.ts`, `src/renderer/src/features/library/LibraryPage.test.tsx`
- **Test notes:** Candidate tests cover cache hits, deduplication, and failures; not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-LIB-008 — HEIC previews are generated on demand and cached

- **Kind:** outcome
- **Status:** verified
- **Proposed:** HEIC/HEIF images generate a JPEG preview on demand in a worker thread, cache it under `.memorylane/cache/previews`, and fall back to external open on failure.
- **Current / source:** HEIC/HEIF images generate a JPEG preview in a worker, cache it, and fall back to external open on failure.
- **Sources:** `docs/adr/0004-heic-preview-conversion.md`, `docs/contracts/library.md`
- **ADRs:** `docs/adr/0004-heic-preview-conversion.md`
- **Contracts:** `docs/contracts/library.md`
- **Existing tests:** `src/main/modules/media/heic-preview.test.ts`, `src/main/modules/media/media-request-handler.test.ts`
- **Test notes:** Candidate tests cover preview generation and failure fallback; not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-LIB-009 — WMV/3GP and failed playback use a cached MP4 proxy

- **Kind:** outcome
- **Status:** verified
- **Proposed:** WMV, 3GP, and failed direct video playback use a cached H.264/AAC MP4 proxy. A source change invalidates the cache; failure offers retry and external open.
- **Current / source:** WMV/3GP and failed direct playback use a cached H.264/AAC MP4; source changes invalidate; failure offers retry/external open.
- **Sources:** `docs/adr/0009-bundled-ffmpeg-video-proxies.md`, `docs/contracts/library.md`
- **ADRs:** `docs/adr/0009-bundled-ffmpeg-video-proxies.md`
- **Contracts:** `docs/contracts/library.md`
- **Existing tests:** `tests/integration/video-proxy.test.ts`, `src/main/modules/media/video-proxy-command.test.ts`, `tests/e2e/video-proxy.spec.ts`
- **Test notes:** Candidate tests cover proxy generation and failure states; not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-LIB-010 — The cache is disposable and never affects originals

- **Kind:** invariant
- **Status:** verified
- **Proposed:** The generated cache lives on the external drive, is excluded from the PC database backup, and is disposable. Clearing it never changes an original file or a catalog row.
- **Current / source:** Cache lives on the external drive, is excluded from PC DB backup, is disposable/regenerable, and clearing never affects originals or catalog entries.
- **Sources:** `docs/product/product-specification.md#12-thumbnail-cache-and-media-previews`, `docs/contracts/library.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/library.md`
- **Existing tests:** `src/main/modules/settings/application/settings-service.test.ts`, `src/renderer/src/features/settings/SettingsPage.test.tsx`, `src/main/modules/media/media-request-handler.test.ts`
- **Test notes:** Candidate tests cover cache clearing and regeneration; not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

## Conflicts

_No conflicts in this batch._
## Approval

This batch is approved. For future batches, either:

1. change `status` to `accepted` and keep the proposed text;
2. edit `proposedText` in the JSON and keep `needs-review`; or
3. change `status` to `non-goal` if the item is out of scope.

Do not mark a requirement `verified` until at least one test carries its ID and the test result is green.
