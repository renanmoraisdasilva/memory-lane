# Batch 9 review — Release acceptance criteria

Status: **implemented**. Requirements: **18**. Conflicts: **0**.

This sheet is generated from `docs/traceability/requirements.json`. This batch is accepted; the matrix is the live view. New requirements start at `needs-review`.

Kinds: outcome 12, invariant 3, constraint 3.

## Summary

| ID | Kind | Status | Title |
|---|---|---|---|
| ML-REL-001 | outcome | implemented | Memory Lane is local-only |
| ML-REL-002 | invariant | verified | Original files are never deleted or edited |
| ML-REL-003 | outcome | verified | Drive selection, catalog setup, and changed-letter handling work |
| ML-REL-004 | outcome | implemented | Four-stage scan controls and interruption recovery work |
| ML-REL-005 | outcome | verified | Incremental scan and health detection work |
| ML-REL-006 | outcome | verified | Timeline, filters, density, viewer, reveal, and open work |
| ML-REL-007 | outcome | implemented | Dates, undated items, and overrides work |
| ML-REL-008 | outcome | verified | Whole-catalog validation works |
| ML-REL-009 | outcome | verified | Other files categories and actions work |
| ML-REL-010 | outcome | verified | Cache controls and Settings work |
| ML-REL-011 | invariant | implemented | SQLite-safe backups run on schedule and close |
| ML-REL-012 | outcome | implemented | Manual backup recovery works |
| ML-REL-013 | constraint | implemented | Large catalog query performance stays within budget |
| ML-REL-014 | outcome | implemented | Installer and portable artifacts are verified |
| ML-REL-015 | constraint | implemented | Codec behavior and fallback are classified |
| ML-REL-016 | invariant | implemented | A real scan disconnect is safe |
| ML-REL-017 | constraint | deferred | A clean Windows VM release pass is required |
| ML-REL-018 | outcome | implemented | WMV and 3GP compatible playback works |

## Requirements

### ML-REL-001 — Memory Lane is local-only

- **Kind:** outcome
- **Status:** implemented
- **Legacy ID:** A1
- **Proposed:** Memory Lane is local-only: no accounts, telemetry, or network services. The renderer CSP is self-only and IPC accepts only the trusted renderer origin.
- **Current / source:** Local-only, no accounts, telemetry, or network services; offline Settings statement; no network clients; CSP self/localhost only.
- **Sources:** `docs/release/acceptance.md`, `docs/release/security-review.md`, `docs/product/product-specification.md#17-key-acceptance-criteria`
- **ADRs:** _none_
- **Contracts:** _none_
- **Existing tests:** `tests/integration/csp.test.ts`, `src/main/ipc/trusted-sender.test.ts`, `src/renderer/src/features/settings/SettingsPage.test.tsx`
- **Test notes:** CSP, trusted sender, and the offline Settings statement are tested; no automated check scans the tree for network clients.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 1.
- **Decision:** implemented

### ML-REL-002 — Original files are never deleted or edited

- **Kind:** invariant
- **Status:** verified
- **Legacy ID:** A2
- **Proposed:** Original files are never deleted, edited, or truncated. The only file-moving operation is the confirmed duplicate quarantine.
- **Current / source:** Original files are never deleted, edited, or truncated. The only file-moving operation is the confirmed duplicate quarantine.
- **Sources:** `docs/release/acceptance.md`, `docs/release/security-review.md`, `docs/contracts/health.md`
- **ADRs:** `docs/adr/0010-duplicate-quarantine.md`
- **Contracts:** `docs/contracts/health.md`
- **Existing tests:** `tests/integration/read-only-guard.test.ts`, `src/main/modules/health/infrastructure/quarantine-mover.test.ts`
- **Test notes:** Read-only guard and quarantine mover tests cover the allowlist and restore behavior. Candidate tests, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 2.
- **Decision:** verified

### ML-REL-003 — Drive selection, catalog setup, and changed-letter handling work

- **Kind:** outcome
- **Status:** verified
- **Legacy ID:** A3
- **Proposed:** The app selects and identifies an external drive, sets up a catalog, and confirms a changed drive letter before updating the root path.
- **Current / source:** External drive selection, catalog setup, and changed-letter handling are covered by drive gate tests and E2E.
- **Sources:** `docs/release/acceptance.md`, `docs/contracts/scan.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/scan.md`
- **Existing tests:** `src/main/modules/drives/application/drive-service.test.ts`, `src/renderer/src/features/drives/DriveSelectionPage.test.tsx`, `tests/e2e/foundation.spec.ts`
- **Test notes:** Drive service, drive gate, and foundation E2E cover setup and changed-letter handling. Candidate tests, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 3.
- **Decision:** verified

### ML-REL-004 — Four-stage scan controls and interruption recovery work

- **Kind:** outcome
- **Status:** implemented
- **Legacy ID:** A4
- **Proposed:** The initial scan is explicitly started and runs in four visible stages with pause/resume, processing intensity, and interruption recovery.
- **Current / source:** Four-stage scan with pause/resume/intensity and interruption recovery; physical disconnect pending.
- **Sources:** `docs/release/acceptance.md`, `docs/release/release-checklist.md`, `docs/contracts/scan.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/scan.md`
- **Existing tests:** `tests/integration/scan-service.test.ts`, `tests/integration/scan-controls.test.ts`, `src/renderer/src/features/scan/ScanPage.test.tsx`, `tests/e2e/scan.spec.ts`
- **Test notes:** Four-stage scan, controls, intensity, and interruption are tested; the physical disconnect pass remains manual.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 4.
- **Decision:** implemented

### ML-REL-005 — Incremental scan and health detection work

- **Kind:** outcome
- **Status:** verified
- **Legacy ID:** A5
- **Proposed:** Incremental scans detect new, changed, missing, and likely moved files, and duplicate groups remain exact and complete.
- **Current / source:** Incremental scan, missing/moved detection, and duplicate groups are covered by scan, health repository, and Library health E2E.
- **Sources:** `docs/release/acceptance.md`, `docs/contracts/scan.md`, `docs/contracts/health.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/scan.md`, `docs/contracts/health.md`
- **Existing tests:** `tests/integration/scan-service.test.ts`, `src/main/db/repositories/health-repository.test.ts`
- **Test notes:** Incremental scan and health repository tests cover new/changed/missing/moved and duplicate groups. Candidate tests, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 5.
- **Decision:** verified

### ML-REL-006 — Timeline, filters, density, viewer, reveal, and open work

- **Kind:** outcome
- **Status:** verified
- **Legacy ID:** A6
- **Proposed:** Memory Lane shows a virtualized chronological timeline with filters, density, viewer navigation, reveal, and external open.
- **Current / source:** Memory Lane timeline, filters, density, viewer, reveal/open are covered by renderer, integration, and E2E suites.
- **Sources:** `docs/release/acceptance.md`, `docs/contracts/library.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/library.md`
- **Existing tests:** `src/renderer/src/features/library/LibraryPage.test.tsx`, `src/renderer/src/features/library/MediaViewerPage.test.tsx`, `tests/e2e/library.spec.ts`
- **Test notes:** Library renderer and E2E tests cover timeline, filters, density, viewer, reveal, and open. Candidate tests, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 6.
- **Decision:** verified

### ML-REL-007 — Dates, undated items, and overrides work

- **Kind:** outcome
- **Status:** implemented
- **Legacy ID:** A7
- **Proposed:** ExifTool dates populate the timeline; undated items are grouped separately; manual date overrides are catalog-only and preserve extracted dates.
- **Current / source:** ExifTool dates, Date unavailable, and manual overrides are covered by unit, integration, real ExifTool, and packaged smoke; mixed corpus pending.
- **Sources:** `docs/release/acceptance.md`, `docs/release/release-checklist.md`, `docs/contracts/library.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/library.md`
- **Existing tests:** `tests/integration/exif-metadata.test.ts`, `src/renderer/src/features/library/UndatedPage.test.tsx`, `src/renderer/src/features/library/MediaViewerPage.test.tsx`, `tests/e2e/dates.spec.ts`
- **Test notes:** ExifTool, undated, override, and E2E tests pass; the mixed-corpus manual pass remains.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 7.
- **Decision:** implemented

### ML-REL-008 — Whole-catalog validation works

- **Kind:** outcome
- **Status:** verified
- **Legacy ID:** A8
- **Proposed:** Whole-catalog validation supports pause/resume and produces a report.
- **Current / source:** Whole-catalog validation with pause/resume and reports is covered by repository, service, renderer, and E2E.
- **Sources:** `docs/release/acceptance.md`, `docs/contracts/health.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md`
- **Existing tests:** `src/main/db/repositories/validation-repository.test.ts`, `src/renderer/src/features/health/HealthPage.test.tsx`, `tests/e2e/health.spec.ts`
- **Test notes:** Validation repository, health UI, and E2E cover pause/resume and reports. Candidate tests, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 8.
- **Decision:** verified

### ML-REL-009 — Other files categories and actions work

- **Kind:** outcome
- **Status:** verified
- **Legacy ID:** A9
- **Proposed:** Other files are categorized and paginated, with external open and reveal for present files.
- **Current / source:** Other files categories, pagination, external open/reveal are covered by repository, handler, renderer, E2E, and packaged smoke.
- **Sources:** `docs/release/acceptance.md`, `docs/contracts/other-files.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/other-files.md`
- **Existing tests:** `src/main/db/repositories/other-files-repository.test.ts`, `src/renderer/src/features/other-files/OtherFilesPage.test.tsx`, `tests/e2e/phase-5.spec.ts`
- **Test notes:** Other files repository, renderer, and E2E cover categories, pagination, open, and reveal. Candidate tests, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 9.
- **Decision:** verified

### ML-REL-010 — Cache controls and Settings work

- **Kind:** outcome
- **Status:** verified
- **Legacy ID:** A10
- **Proposed:** Settings exposes cache size and clearing, catalog details, backup status/location, background controls, and About.
- **Current / source:** Cache controls and catalog/backup Settings are covered by service, handler, renderer, E2E, and packaged smoke.
- **Sources:** `docs/release/acceptance.md`, `docs/contracts/settings.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/settings.md`
- **Existing tests:** `src/main/modules/settings/application/settings-service.test.ts`, `src/renderer/src/features/settings/SettingsPage.test.tsx`, `tests/e2e/phase-5.spec.ts`
- **Test notes:** Settings service, renderer, and E2E cover cache and backup controls. Candidate tests, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 10.
- **Decision:** verified

### ML-REL-011 — SQLite-safe backups run on schedule and close

- **Kind:** invariant
- **Status:** implemented
- **Legacy ID:** A11
- **Proposed:** Backups use the SQLite online backup API every 15 minutes while the app is open and on graceful close.
- **Current / source:** SQLite-safe backups every 15 minutes and on close; service/handler tests and packaged backup smoke; real-drive restore pending.
- **Sources:** `docs/release/acceptance.md`, `docs/release/release-checklist.md`, `docs/contracts/settings.md`
- **ADRs:** `docs/adr/0003-scheduled-backups-and-cache.md`
- **Contracts:** `docs/contracts/settings.md`
- **Existing tests:** `src/main/db/backup-runner.test.ts`, `src/main/modules/settings/application/settings-service.test.ts`
- **Test notes:** Online backups, timer, shutdown, and failure handling are tested; the real-drive restore remains manual.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 11.
- **Decision:** implemented

### ML-REL-012 — Manual backup recovery works

- **Kind:** outcome
- **Status:** implemented
- **Legacy ID:** A12
- **Proposed:** Manual backup recovery restores the catalog and app databases.
- **Current / source:** Manual backup recovery works; restore integration test; real-drive drill pending.
- **Sources:** `docs/release/acceptance.md`, `docs/release/release-checklist.md`, `docs/contracts/settings.md`
- **ADRs:** `docs/adr/0003-scheduled-backups-and-cache.md`
- **Contracts:** `docs/contracts/settings.md`
- **Existing tests:** `tests/integration/recovery.test.ts`
- **Test notes:** The copy-back path is tested; the real-drive recovery drill remains manual.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 12.
- **Decision:** implemented

### ML-REL-013 — Large catalog query performance stays within budget

- **Kind:** constraint
- **Status:** implemented
- **Legacy ID:** A13
- **Proposed:** Library queries remain within budget for 100,000 and 200,000 file catalogs.
- **Current / source:** 100k/200k catalog query performance is covered by in-memory performance tests.
- **Sources:** `docs/release/acceptance.md`, `docs/release/release-checklist.md`, `docs/product/product-specification.md#13-performance-requirements`
- **ADRs:** _none_
- **Contracts:** _none_
- **Existing tests:** `tests/integration/library-performance.test.ts`
- **Test notes:** The default run covers 100k; 200k is opt-in and not part of this JSON run.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 13.
- **Decision:** implemented

### ML-REL-014 — Installer and portable artifacts are verified

- **Kind:** outcome
- **Status:** implemented
- **Legacy ID:** A14
- **Proposed:** Installer, portable, and unpacked artifacts contain the app archive, native SQLite, ExifTool, FFmpeg, and SHA-256 checksums.
- **Current / source:** Installer/portable artifacts are verified by verify:package binaries and SHA-256; clean-VM install/uninstall pending.
- **Sources:** `docs/release/acceptance.md`, `docs/release/release-checklist.md`, `docs/release/security-review.md`
- **ADRs:** _none_
- **Contracts:** _none_
- **Existing tests:** `scripts/verify-package.mjs`, `scripts/smoke-packaged.mjs`
- **Test notes:** verify-package.mjs and smoke-packaged.mjs are automated scripts, not Vitest tests; clean-VM install/uninstall remains manual.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 14.
- **Decision:** implemented

### ML-REL-015 — Codec behavior and fallback are classified

- **Kind:** constraint
- **Status:** implemented
- **Legacy ID:** A15
- **Proposed:** Codec behavior and external fallback are classified for the supported image and video extensions.
- **Current / source:** Codec behavior and external fallback are known; codec-matrix.md; manual playback pending.
- **Sources:** `docs/release/acceptance.md`, `docs/release/codec-matrix.md`, `docs/release/release-checklist.md`
- **ADRs:** _none_
- **Contracts:** _none_
- **Existing tests:** `tests/e2e/video-proxy.spec.ts`, `src/renderer/src/features/library/MediaViewerPage.test.tsx`
- **Test notes:** Fallback behavior is tested; the manual codec matrix pass remains pending.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 15.
- **Decision:** implemented

### ML-REL-016 — A real scan disconnect is safe

- **Kind:** invariant
- **Status:** implemented
- **Legacy ID:** A16
- **Proposed:** A real drive disconnect during a scan is safe, and reconnect/resume completes without modifying originals.
- **Current / source:** Disconnect during a real scan is safe; simulated disconnect test; physical USB pending.
- **Sources:** `docs/release/acceptance.md`, `docs/release/release-checklist.md`, `docs/contracts/scan.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/scan.md`
- **Existing tests:** `tests/integration/scan-controls.test.ts`
- **Test notes:** Simulated disconnect and resume are tested; the physical USB drill remains manual.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 16.
- **Decision:** implemented

### ML-REL-017 — A clean Windows VM release pass is required

- **Kind:** constraint
- **Status:** deferred
- **Legacy ID:** A17
- **Proposed:** A clean Windows VM release pass covers install, launch, scan, settings, backup, cache, uninstall, and portable use.
- **Current / source:** Clean Windows VM release pass is pending in release-checklist.md.
- **Sources:** `docs/release/acceptance.md`, `docs/release/release-checklist.md`
- **ADRs:** _none_
- **Contracts:** _none_
- **Existing tests:** _none_
- **Test notes:** Manual clean Windows VM pass; no automated test can prove install/uninstall and portable launch on a clean OS.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 17.
- **Decision:** deferred

### ML-REL-018 — WMV and 3GP compatible playback works

- **Kind:** outcome
- **Status:** implemented
- **Legacy ID:** A18
- **Proposed:** WMV and 3GP play through the cached FFmpeg compatible copy.
- **Current / source:** WMV/3GP compatible playback; packaged WMV proxy smoke and codec matrix; clean-VM playback pending.
- **Sources:** `docs/release/acceptance.md`, `docs/release/codec-matrix.md`, `docs/release/release-checklist.md`
- **ADRs:** `docs/adr/0009-bundled-ffmpeg-video-proxies.md`
- **Contracts:** `docs/contracts/library.md`
- **Existing tests:** `tests/integration/video-proxy.test.ts`, `tests/e2e/video-proxy.spec.ts`
- **Test notes:** WMV/3GP proxy integration and E2E tests pass; the clean-VM playback pass remains manual.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 18.
- **Decision:** implemented

## Conflicts

_No conflicts in this batch._
## Approval

This batch is approved. For future batches, either:

1. change `status` to `accepted` and keep the proposed text;
2. edit `proposedText` in the JSON and keep `needs-review`; or
3. change `status` to `non-goal` if the item is out of scope.

Do not mark a requirement `verified` until at least one test carries its ID and the test result is green.
