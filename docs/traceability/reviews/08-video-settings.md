# Batch 8 review — Video playback and settings/backups

Status: **implemented**. Requirements: **26**. Conflicts: **1**.

This sheet is generated from `docs/traceability/requirements.json`. This batch is accepted; the matrix is the live view. New requirements start at `needs-review`.

Kinds: outcome 11, invariant 10, constraint 4, non-goal 1.

## Summary

| ID | Kind | Status | Title |
|---|---|---|---|
| ML-VIDEO-001 | outcome | verified | WMV and 3GP prepare immediately; other videos try direct playback first |
| ML-VIDEO-002 | invariant | implemented | One FFmpeg job runs per file and repeated prepare coalesces |
| ML-VIDEO-003 | invariant | implemented | Proxy output is renamed into place only after conversion succeeds |
| ML-VIDEO-004 | invariant | verified | Proxy cache rows store the source fingerprint and state |
| ML-VIDEO-005 | invariant | implemented | A source change invalidates the cached proxy |
| ML-VIDEO-006 | invariant | implemented | The proxy URL serves ranges and 404s until ready |
| ML-VIDEO-007 | outcome | verified | Failed conversion records failure and offers retry or external open |
| ML-VIDEO-008 | constraint | verified | The FFmpeg command produces a Chromium-compatible MP4 |
| ML-VIDEO-009 | constraint | implemented | The packaged app bundles FFmpeg with its license notice |
| ML-VIDEO-010 | outcome | implemented | Proxy files count in cache stats and are removed by clear cache |
| ML-VIDEO-011 | invariant | verified | HEIC previews run in a worker and deduplicate in-flight work |
| ML-VIDEO-012 | outcome | verified | HEIC previews cache as JPEG preview rows and fail safely |
| ML-SET-001 | outcome | verified | Settings reports cache, catalog, backup, and app information |
| ML-SET-002 | outcome | verified | Clear cache removes the directory and all cache rows |
| ML-SET-003 | invariant | implemented | Cache clearing never changes the catalog, overrides, metadata, or originals |
| ML-SET-004 | invariant | verified | Backups use the SQLite online backup API for both databases |
| ML-SET-005 | outcome | verified | Backups write both databases to the volume backup directory |
| ML-SET-006 | outcome | verified | Backups run manually, on the timer, and on shutdown |
| ML-SET-007 | constraint | implemented | The default backup interval is 15 minutes |
| ML-SET-008 | invariant | verified | Overlapping backups coalesce and scheduled runs need an open catalog |
| ML-SET-009 | outcome | verified | Backup history records the result and preserves the last success |
| ML-SET-010 | outcome | implemented | A backup failure is visible and does not stop the app |
| ML-SET-011 | constraint | implemented | Recovery is manual and the UI has no restore action |
| ML-SET-012 | outcome | verified | Settings exposes cache, catalog, backup, background, and About sections |
| ML-SET-013 | non-goal | non-goal | Automatic cache size limits are out of scope for v0.1 |
| ML-SET-014 | invariant | implemented | Backup files are renamed into place only after both databases succeed |

## Requirements

### ML-VIDEO-001 — WMV and 3GP prepare immediately; other videos try direct playback first

- **Kind:** outcome
- **Status:** verified
- **Proposed:** WMV and 3GP start preparation immediately in the viewer. Other videos try direct playback first and start preparation on error.
- **Current / source:** WMV and 3GP start preparation immediately in the viewer. Other videos try direct playback first and start preparation on error.
- **Sources:** `docs/adr/0009-bundled-ffmpeg-video-proxies.md`, `docs/contracts/library.md#compatible-video-copies`, `docs/product/product-specification.md#17-key-acceptance-criteria`
- **ADRs:** `docs/adr/0009-bundled-ffmpeg-video-proxies.md`
- **Contracts:** `docs/contracts/library.md`
- **Existing tests:** `src/renderer/src/features/library/MediaViewerPage.test.tsx`
- **Test notes:** Viewer tests cover WMV auto-preparation, native direct video controls, and the error fallback. Candidate test, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Refines ML-LIB-009; batch 2 covers the broad playback contract.
- **Decision:** verified

### ML-VIDEO-002 — One FFmpeg job runs per file and repeated prepare coalesces

- **Kind:** invariant
- **Status:** implemented
- **Proposed:** One background FFmpeg child process runs per file; repeated prepare requests return the active processing state.
- **Current / source:** One background FFmpeg child process runs per file; repeated prepare requests return the active processing state.
- **Sources:** `docs/adr/0009-bundled-ffmpeg-video-proxies.md`, `docs/contracts/library.md#compatible-video-copies`
- **ADRs:** `docs/adr/0009-bundled-ffmpeg-video-proxies.md`
- **Contracts:** `docs/contracts/library.md`
- **Existing tests:** `tests/integration/video-proxy.test.ts`
- **Test notes:** No test asserts duplicate prepare while processing; the integration test prepares each file once.
- **Conflicts:** _none_
- **Notes:** Refines ML-LIB-009.
- **Decision:** implemented

### ML-VIDEO-003 — Proxy output is renamed into place only after conversion succeeds

- **Kind:** invariant
- **Status:** implemented
- **Proposed:** FFmpeg writes to a temporary file under the cache proxies directory; the file is renamed into place only after FFmpeg succeeds.
- **Current / source:** FFmpeg writes to a temporary file under the cache proxies directory; the file is renamed into place only after FFmpeg succeeds.
- **Sources:** `docs/adr/0009-bundled-ffmpeg-video-proxies.md`, `docs/contracts/library.md#compatible-video-copies`
- **ADRs:** `docs/adr/0009-bundled-ffmpeg-video-proxies.md`
- **Contracts:** `docs/contracts/library.md`
- **Existing tests:** `tests/integration/video-proxy.test.ts`
- **Test notes:** No test asserts the temporary path or rename boundary; the integration test checks the final proxy.
- **Conflicts:** _none_
- **Notes:** Refines ML-LIB-009.
- **Decision:** implemented

### ML-VIDEO-004 — Proxy cache rows store the source fingerprint and state

- **Kind:** invariant
- **Status:** verified
- **Proposed:** A proxy cache row stores source size and modified time, status, byte count, and error message.
- **Current / source:** A proxy cache row stores source size and modified time, status, byte count, and error message.
- **Sources:** `docs/adr/0009-bundled-ffmpeg-video-proxies.md`, `docs/contracts/library.md#compatible-video-copies`
- **ADRs:** `docs/adr/0009-bundled-ffmpeg-video-proxies.md`
- **Contracts:** `docs/contracts/library.md`
- **Existing tests:** `src/main/db/repositories/library-item-repository.test.ts`, `src/main/db/migrations/catalog-video-proxy-migration.test.ts`
- **Test notes:** Repository and migration tests cover the proxy columns and fingerprint round-trip. Candidate tests, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Refines ML-LIB-009.
- **Decision:** verified

### ML-VIDEO-005 — A source change invalidates the cached proxy

- **Kind:** invariant
- **Status:** implemented
- **Proposed:** A source change invalidates the proxy cache row through normal scan cache invalidation; the next play regenerates the copy.
- **Current / source:** A source change invalidates the proxy cache row through normal scan cache invalidation; the next play regenerates the copy.
- **Sources:** `docs/adr/0009-bundled-ffmpeg-video-proxies.md`, `docs/contracts/library.md#compatible-video-copies`
- **ADRs:** `docs/adr/0009-bundled-ffmpeg-video-proxies.md`
- **Contracts:** `docs/contracts/library.md`
- **Existing tests:** `tests/integration/video-proxy.test.ts`, `tests/integration/scan-service.test.ts`
- **Test notes:** No test changes a source and asserts proxy cache invalidation.
- **Conflicts:** _none_
- **Notes:** Refines ML-LIB-009.
- **Decision:** implemented

### ML-VIDEO-006 — The proxy URL serves ranges and 404s until ready

- **Kind:** invariant
- **Status:** implemented
- **Proposed:** `ml-media://proxy/<fileId>` serves the cached MP4 with byte-range support and returns 404 until the copy is ready.
- **Current / source:** `ml-media://proxy/<fileId>` serves the cached MP4 with byte-range support and returns 404 until the copy is ready.
- **Sources:** `docs/adr/0009-bundled-ffmpeg-video-proxies.md`, `docs/contracts/library.md#compatible-video-copies`, `docs/contracts/library.md#media-protocol`
- **ADRs:** `docs/adr/0009-bundled-ffmpeg-video-proxies.md`
- **Contracts:** `docs/contracts/library.md`
- **Existing tests:** `src/main/modules/media/media-request-handler.test.ts`, `src/main/modules/media/media-response.test.ts`
- **Test notes:** Range serving is tested; the 404-until-ready path is not explicitly asserted.
- **Conflicts:** _none_
- **Notes:** Refines ML-LIB-009.
- **Decision:** implemented

### ML-VIDEO-007 — Failed conversion records failure and offers retry or external open

- **Kind:** outcome
- **Status:** verified
- **Proposed:** A failed conversion records a failed state with no proxy URL; the viewer offers retry and external open.
- **Current / source:** A failed conversion records a failed state with no proxy URL; the viewer offers retry and external open.
- **Sources:** `docs/adr/0009-bundled-ffmpeg-video-proxies.md`, `docs/contracts/library.md#compatible-video-copies`
- **ADRs:** `docs/adr/0009-bundled-ffmpeg-video-proxies.md`
- **Contracts:** `docs/contracts/library.md`
- **Existing tests:** `tests/integration/video-proxy.test.ts`, `src/renderer/src/features/library/MediaViewerPage.test.tsx`
- **Test notes:** Integration and viewer tests cover the failed state, retry, and external open. Candidate tests, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Refines ML-LIB-009.
- **Decision:** verified

### ML-VIDEO-008 — The FFmpeg command produces a Chromium-compatible MP4

- **Kind:** constraint
- **Status:** verified
- **Proposed:** The proxy command targets H.264/AAC MP4 with yuv420p, faststart, and optional audio for Chromium playback.
- **Current / source:** The proxy command targets H.264/AAC MP4 with yuv420p, faststart, and optional audio for Chromium playback.
- **Sources:** `docs/adr/0009-bundled-ffmpeg-video-proxies.md`, `docs/contracts/library.md#compatible-video-copies`
- **ADRs:** `docs/adr/0009-bundled-ffmpeg-video-proxies.md`
- **Contracts:** `docs/contracts/library.md`
- **Existing tests:** `src/main/modules/media/video-proxy-command.test.ts`
- **Test notes:** The command test asserts libx264, AAC, yuv420p, faststart, and optional audio. Candidate test, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Refines ML-LIB-009.
- **Decision:** verified

### ML-VIDEO-009 — The packaged app bundles FFmpeg with its license notice

- **Kind:** constraint
- **Status:** implemented
- **Proposed:** The packaged app resolves FFmpeg from `resources/bin` and ships the FFmpeg license and source notice beside the executable.
- **Current / source:** The packaged app resolves FFmpeg from `resources/bin` and ships the FFmpeg license and source notice beside the executable.
- **Sources:** `docs/adr/0009-bundled-ffmpeg-video-proxies.md`, `docs/release/third-party-notices.md`
- **ADRs:** `docs/adr/0009-bundled-ffmpeg-video-proxies.md`
- **Contracts:** `docs/contracts/library.md`
- **Existing tests:** `src/main/modules/media/ffmpeg-path.test.ts`
- **Test notes:** Packaged path resolution is tested; no test asserts the license/notice files are packaged.
- **Conflicts:** _none_
- **Notes:** Refines ML-LIB-009.
- **Decision:** implemented

### ML-VIDEO-010 — Proxy files count in cache stats and are removed by clear cache

- **Kind:** outcome
- **Status:** implemented
- **Proposed:** Proxy files are included in Settings cache size and are removed by Clear generated cache.
- **Current / source:** Proxy files are included in Settings cache size and are removed by Clear generated cache.
- **Sources:** `docs/adr/0009-bundled-ffmpeg-video-proxies.md`, `docs/contracts/library.md#compatible-video-copies`, `docs/contracts/settings.md#cache`
- **ADRs:** `docs/adr/0009-bundled-ffmpeg-video-proxies.md`
- **Contracts:** `docs/contracts/library.md`, `docs/contracts/settings.md`
- **Existing tests:** `src/main/modules/settings/application/settings-service.test.ts`, `src/main/db/settings-db-handlers.test.ts`
- **Test notes:** Cache stats and clear tests use generic cache rows; no test asserts a proxy row specifically.
- **Conflicts:** _none_
- **Notes:** Refines ML-LIB-010.
- **Decision:** implemented

### ML-VIDEO-011 — HEIC previews run in a worker and deduplicate in-flight work

- **Kind:** invariant
- **Status:** verified
- **Proposed:** HEIC/HEIF conversion runs in a dedicated worker thread; in-flight requests for the same output are deduplicated.
- **Current / source:** HEIC/HEIF conversion runs in a dedicated worker thread; in-flight requests for the same output are deduplicated.
- **Sources:** `docs/adr/0004-heic-preview-conversion.md`, `docs/contracts/library.md#media-protocol`
- **ADRs:** `docs/adr/0004-heic-preview-conversion.md`
- **Contracts:** `docs/contracts/library.md`
- **Existing tests:** `src/main/modules/media/heic-preview.test.ts`
- **Test notes:** The worker test asserts one worker message for two concurrent conversions. Candidate test, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Refines ML-LIB-008.
- **Decision:** verified

### ML-VIDEO-012 — HEIC previews cache as JPEG preview rows and fail safely

- **Kind:** outcome
- **Status:** verified
- **Proposed:** HEIC/HEIF previews cache at `previews/<fileId>.jpg` with a `preview` row; failures record a failed row and return 404.
- **Current / source:** HEIC/HEIF previews cache at `previews/<fileId>.jpg` with a `preview` row; failures record a failed row and return 404.
- **Sources:** `docs/adr/0004-heic-preview-conversion.md`, `docs/contracts/library.md#media-protocol`
- **ADRs:** `docs/adr/0004-heic-preview-conversion.md`
- **Contracts:** `docs/contracts/library.md`
- **Existing tests:** `src/main/modules/media/media-request-handler.test.ts`
- **Test notes:** The handler test covers cached JPEG reuse, the preview row, and failed conversion returning 404. Candidate test, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Refines ML-LIB-008.
- **Decision:** verified

### ML-SET-001 — Settings reports cache, catalog, backup, and app information

- **Kind:** outcome
- **Status:** verified
- **Proposed:** Settings returns cache path/size/count, catalog path/size, backup path/status, and app version/Electron/platform information.
- **Current / source:** Settings returns cache path/size/count, catalog path/size, backup path/status, and app version/Electron/platform information.
- **Sources:** `docs/contracts/settings.md#ipc-contract`, `docs/product/product-specification.md#16-initial-ui-areas`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/settings.md`
- **Existing tests:** `src/main/modules/settings/application/settings-service.test.ts`, `src/renderer/src/features/settings/SettingsPage.test.tsx`
- **Test notes:** Service and page tests cover the settings payload and visible sections. Candidate tests, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-SET-002 — Clear cache removes the directory and all cache rows

- **Kind:** outcome
- **Status:** verified
- **Proposed:** Clear cache removes `<catalog-dir>/cache` and every `cache_entries` row, returning removed file count and freed bytes.
- **Current / source:** Clear cache removes `<catalog-dir>/cache` and every `cache_entries` row, returning removed file count and freed bytes.
- **Sources:** `docs/contracts/settings.md#cache`, `docs/product/product-specification.md#12-thumbnail-cache-and-media-previews`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/settings.md`
- **Existing tests:** `src/main/modules/settings/application/settings-service.test.ts`, `src/main/db/settings-db-handlers.test.ts`, `src/renderer/src/features/settings/SettingsPage.test.tsx`
- **Test notes:** Service, DB handler, and UI tests cover clearing and the confirmation result. Candidate tests, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Refines ML-LIB-010.
- **Decision:** verified

### ML-SET-003 — Cache clearing never changes the catalog, overrides, metadata, or originals

- **Kind:** invariant
- **Status:** implemented
- **Proposed:** Cache clearing never changes `catalog.db`, date overrides, metadata, or any original file; thumbnails and previews regenerate lazily.
- **Current / source:** Cache clearing never changes `catalog.db`, date overrides, metadata, or any original file; thumbnails and previews regenerate lazily.
- **Sources:** `docs/contracts/settings.md#cache`, `docs/product/product-specification.md#12-thumbnail-cache-and-media-previews`, `docs/adr/0003-scheduled-backups-and-cache.md`
- **ADRs:** `docs/adr/0003-scheduled-backups-and-cache.md`
- **Contracts:** `docs/contracts/settings.md`
- **Existing tests:** `src/main/modules/settings/application/settings-service.test.ts`, `tests/e2e/phase-5.spec.ts`, `src/main/modules/media/media-request-handler.test.ts`
- **Test notes:** The E2E test checks originals survive a clear; no Vitest test asserts date overrides or metadata are unchanged.
- **Conflicts:** _none_
- **Notes:** Refines ML-LIB-010.
- **Decision:** implemented

### ML-SET-004 — Backups use the SQLite online backup API for both databases

- **Kind:** invariant
- **Status:** verified
- **Proposed:** Backups use `better-sqlite3`'s online backup API and back up both `catalog.db` and `app.db`.
- **Current / source:** Backups use `better-sqlite3`'s online backup API and back up both `catalog.db` and `app.db`.
- **Sources:** `docs/contracts/settings.md#backups`, `docs/adr/0003-scheduled-backups-and-cache.md`, `docs/product/product-specification.md#8-database-backup-to-the-pc`
- **ADRs:** `docs/adr/0003-scheduled-backups-and-cache.md`
- **Contracts:** `docs/contracts/settings.md`
- **Existing tests:** `src/main/db/backup-runner.test.ts`, `tests/integration/recovery.test.ts`
- **Test notes:** The backup runner and recovery drill cover both databases. Candidate tests, not yet ID-tagged.
- **Conflicts:** C-007
- **Notes:** _none_
- **Decision:** verified

### ML-SET-005 — Backups write both databases to the volume backup directory

- **Kind:** outcome
- **Status:** verified
- **Proposed:** Backups write `catalog.db` and `app.db` to `<user-data>/backups/<volume-id>/`; the latest set replaces the previous copy.
- **Current / source:** Backups write `catalog.db` and `app.db` to `<user-data>/backups/<volume-id>/`; the latest set replaces the previous copy.
- **Sources:** `docs/contracts/settings.md#backups`, `docs/adr/0003-scheduled-backups-and-cache.md`
- **ADRs:** `docs/adr/0003-scheduled-backups-and-cache.md`
- **Contracts:** `docs/contracts/settings.md`
- **Existing tests:** `src/main/db/backup-runner.test.ts`, `src/main/modules/settings/application/settings-service.test.ts`, `src/main/platform/app-paths.test.ts`
- **Test notes:** Tests cover the backup directory, filenames, and replacement of the previous set. Candidate tests, not yet ID-tagged.
- **Conflicts:** C-007
- **Notes:** _none_
- **Decision:** verified

### ML-SET-006 — Backups run manually, on the timer, and on shutdown

- **Kind:** outcome
- **Status:** verified
- **Proposed:** Backups run on manual request, on the timer while the app is open, and during graceful shutdown.
- **Current / source:** Backups run on manual request, on the timer while the app is open, and during graceful shutdown.
- **Sources:** `docs/contracts/settings.md#backups`, `docs/adr/0003-scheduled-backups-and-cache.md`, `docs/product/product-specification.md#8-database-backup-to-the-pc`
- **ADRs:** `docs/adr/0003-scheduled-backups-and-cache.md`
- **Contracts:** `docs/contracts/settings.md`
- **Existing tests:** `src/main/modules/settings/application/settings-service.test.ts`, `tests/e2e/phase-5.spec.ts`
- **Test notes:** Service tests cover manual, timer, and shutdown runs; the E2E test covers manual backup. Candidate tests, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-SET-007 — The default backup interval is 15 minutes

- **Kind:** constraint
- **Status:** implemented
- **Proposed:** The default backup timer interval is 15 minutes while the app is open.
- **Current / source:** The default backup timer interval is 15 minutes while the app is open.
- **Sources:** `docs/contracts/settings.md#backups`, `docs/adr/0003-scheduled-backups-and-cache.md`, `docs/product/product-specification.md#8-database-backup-to-the-pc`
- **ADRs:** `docs/adr/0003-scheduled-backups-and-cache.md`
- **Contracts:** `docs/contracts/settings.md`
- **Existing tests:** `src/main/modules/settings/application/settings-service.test.ts`
- **Test notes:** The service test injects a short interval; no test asserts the 15-minute default.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** implemented

### ML-SET-008 — Overlapping backups coalesce and scheduled runs need an open catalog

- **Kind:** invariant
- **Status:** verified
- **Proposed:** Overlapping backup requests share one in-flight run; scheduled runs are ignored when no catalog is open.
- **Current / source:** Overlapping backup requests share one in-flight run; scheduled runs are ignored when no catalog is open.
- **Sources:** `docs/contracts/settings.md#backups`, `docs/adr/0003-scheduled-backups-and-cache.md`
- **ADRs:** `docs/adr/0003-scheduled-backups-and-cache.md`
- **Contracts:** `docs/contracts/settings.md`
- **Existing tests:** `src/main/modules/settings/application/settings-service.test.ts`
- **Test notes:** Tests cover coalescing and the no-catalog shutdown path. Candidate test, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-SET-009 — Backup history records the result and preserves the last success

- **Kind:** outcome
- **Status:** verified
- **Proposed:** `backup_history` records path, bytes, time, and success/failed; `last_backup_at` updates only on success, so a failure keeps the previous success time.
- **Current / source:** `backup_history` records path, bytes, time, and success/failed; `last_backup_at` updates only on success, so a failure keeps the previous success time.
- **Sources:** `docs/contracts/settings.md#backups`, `docs/adr/0003-scheduled-backups-and-cache.md`
- **ADRs:** `docs/adr/0003-scheduled-backups-and-cache.md`
- **Contracts:** `docs/contracts/settings.md`
- **Existing tests:** `src/main/db/settings-db-handlers.test.ts`, `src/main/modules/settings/application/settings-service.test.ts`
- **Test notes:** DB handler tests cover success/failure history and the preserved success timestamp. Candidate tests, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-SET-010 — A backup failure is visible and does not stop the app

- **Kind:** outcome
- **Status:** implemented
- **Proposed:** A failed backup is recorded as failed, surfaced in Settings as `lastStatus: "failed"`, and does not stop the app.
- **Current / source:** A failed backup is recorded as failed, surfaced in Settings as `lastStatus: "failed"`, and does not stop the app.
- **Sources:** `docs/contracts/settings.md#backups`, `docs/product/product-specification.md#16-initial-ui-areas`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/settings.md`
- **Existing tests:** `src/main/modules/settings/application/settings-service.test.ts`, `src/renderer/src/features/settings/SettingsPage.test.tsx`
- **Test notes:** The service records a failed backup; no test asserts the failed status is rendered in Settings.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** implemented

### ML-SET-011 — Recovery is manual and the UI has no restore action

- **Kind:** constraint
- **Status:** implemented
- **Proposed:** Recovery is manual: close the app, copy `app.db` and `catalog.db` back, and reopen; no restore action exists in the UI.
- **Current / source:** Recovery is manual: close the app, copy `app.db` and `catalog.db` back, and reopen; no restore action exists in the UI.
- **Sources:** `docs/contracts/settings.md#recovery`, `docs/adr/0003-scheduled-backups-and-cache.md`, `docs/product/product-specification.md#8-database-backup-to-the-pc`
- **ADRs:** `docs/adr/0003-scheduled-backups-and-cache.md`
- **Contracts:** `docs/contracts/settings.md`
- **Existing tests:** `tests/integration/recovery.test.ts`, `src/renderer/src/features/settings/SettingsPage.test.tsx`
- **Test notes:** The recovery drill proves the copy-back path; no test asserts the absence of a restore UI.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** implemented

### ML-SET-012 — Settings exposes cache, catalog, backup, background, and About sections

- **Kind:** outcome
- **Status:** verified
- **Proposed:** The Settings route exposes cache size and clear, catalog details, backup status/location, a background-controls link, and About.
- **Current / source:** The Settings route exposes cache size and clear, catalog details, backup status/location, a background-controls link, and About.
- **Sources:** `docs/product/product-specification.md#16-initial-ui-areas`, `docs/contracts/settings.md#routes`, `docs/product/scope-and-implementation.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/settings.md`
- **Existing tests:** `src/renderer/src/features/settings/SettingsPage.test.tsx`, `tests/e2e/phase-5.spec.ts`
- **Test notes:** The page and E2E tests cover the visible sections and actions. Candidate tests, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** verified

### ML-SET-013 — Automatic cache size limits are out of scope for v0.1

- **Kind:** non-goal
- **Status:** non-goal
- **Proposed:** Automatic cache size limits are out of scope for v0.1; users can inspect size and clear the cache manually.
- **Current / source:** Cache has no automatic size limit in the initial design.
- **Sources:** `docs/product/product-specification.md#12-thumbnail-cache-and-media-previews`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/settings.md`
- **Existing tests:** _none_
- **Test notes:** No test required; this is an explicit v0.1 non-goal.
- **Conflicts:** _none_
- **Notes:** The product spec explicitly says the initial design has no automatic cache size limit.
- **Decision:** non-goal

### ML-SET-014 — Backup files are renamed into place only after both databases succeed

- **Kind:** invariant
- **Status:** implemented
- **Proposed:** Backups write `.tmp` files and rename both databases into place only after both online backups succeed; failures remove temporary files.
- **Current / source:** Backups write `.tmp` files and rename both databases into place only after both online backups succeed; failures remove temporary files.
- **Sources:** `docs/contracts/settings.md#backups`, `docs/adr/0003-scheduled-backups-and-cache.md`
- **ADRs:** `docs/adr/0003-scheduled-backups-and-cache.md`
- **Contracts:** `docs/contracts/settings.md`
- **Existing tests:** `src/main/db/backup-runner.test.ts`
- **Test notes:** The success test asserts no temp files remain; no test forces a failure between the two backups and asserts cleanup.
- **Conflicts:** _none_
- **Notes:** _none_
- **Decision:** implemented

## Conflicts

### C-007 — The product spec calls the PC backup catalog-only, but the contract backs up app.db too

- **Severity:** medium
- **Status:** accepted
- **Decision:** Approved: update product-specification section 8 and section 17 to name both SQLite databases; keep the generated cache excluded.
- **Affected requirements:** ML-SET-004, ML-SET-005

**Claims**

- `docs/product/product-specification.md:184-198 (before C-007)`: The SQLite catalog should be backed up automatically; the PC backup is an additional copy of the catalog only.
- `docs/product/product-specification.md:728 (before C-007)`: The SQLite catalog is backed up to the PC every 15 minutes while open and on close.

**Contradicted by**

- `docs/contracts/settings.md:34`: Backs up both `catalog.db` and `app.db`.
- `docs/adr/0003-scheduled-backups-and-cache.md:14`: Back up both `catalog.db` and `app.db` with the SQLite online backup API.
- `docs/product/scope-and-implementation.md:378`: `catalog.db` and `app.db` are backed up with the SQLite online backup API.

**Proposed resolution:** Update product-specification.md section 8 and section 17 to say both SQLite databases (catalog.db and app.db) are backed up, while the generated cache remains excluded. Keep the user-facing name 'catalog backup'.

**Recommendation:** Approve the contract/ADR behavior and update the two stale product-spec sentences. Do not stop backing up app.db; it holds drive registration and backup history.

## Approval

This batch is approved. For future batches, either:

1. change `status` to `accepted` and keep the proposed text;
2. edit `proposedText` in the JSON and keep `needs-review`; or
3. change `status` to `non-goal` if the item is out of scope.

Do not mark a requirement `verified` until at least one test carries its ID and the test result is green.
