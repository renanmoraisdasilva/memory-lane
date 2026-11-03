# Batch 9 review — Release acceptance criteria

Status: **implemented**. Requirements: **18**. Conflicts: **0**.

This sheet is generated from `docs/traceability/requirements.json`. This batch is accepted; the matrix is the live view. New requirements start at `needs-review`.

Kinds: outcome 12, invariant 3, constraint 3.

Verification: manual 10, automated-test 7, automated-check 1.

## Summary

| ID | Kind | Status | Verification | Title |
|---|---|---|---|---|
| ML-REL-001 | outcome | implemented | manual | Memory Lane is local-only |
| ML-REL-002 | invariant | verified | automated-test | Original files are never deleted or edited |
| ML-REL-003 | outcome | verified | automated-test | Drive selection, catalog setup, and changed-letter handling work |
| ML-REL-004 | outcome | implemented | manual | Four-stage scan controls and interruption recovery work |
| ML-REL-005 | outcome | verified | automated-test | Incremental scan and health detection work |
| ML-REL-006 | outcome | verified | automated-test | Timeline, filters, density, viewer, reveal, and open work |
| ML-REL-007 | outcome | implemented | manual | Dates, undated items, and overrides work |
| ML-REL-008 | outcome | verified | automated-test | Whole-catalog validation works |
| ML-REL-009 | outcome | verified | automated-test | Other files categories and actions work |
| ML-REL-010 | outcome | verified | automated-test | Cache controls and Settings work |
| ML-REL-011 | invariant | implemented | manual | SQLite-safe backups run on schedule and close |
| ML-REL-012 | outcome | implemented | manual | Manual backup recovery works |
| ML-REL-013 | constraint | implemented | manual | Large catalog query performance stays within budget |
| ML-REL-014 | outcome | implemented | automated-check | Installer and portable artifacts are verified |
| ML-REL-015 | constraint | implemented | manual | Codec behavior and fallback are classified |
| ML-REL-016 | invariant | implemented | manual | A real scan disconnect is safe |
| ML-REL-017 | constraint | deferred | manual | A clean Windows VM release pass is required |
| ML-REL-018 | outcome | implemented | manual | WMV and 3GP compatible playback works |

## Requirements

### ML-REL-001 — Memory Lane is local-only

- **Kind:** outcome
- **Status:** implemented
- **Verification:** manual
- **Legacy ID:** A1
- **Text:** Memory Lane is local-only: no accounts, telemetry, or network services. The renderer CSP is self-only and IPC accepts only the trusted renderer origin.
- **Source text:** Local-only, no accounts, telemetry, or network services; offline Settings statement; no network clients; CSP self/localhost only.
- **Sources:** `docs/release/acceptance.md`, `docs/release/security-review.md`, `docs/product/product-specification.md#17-key-acceptance-criteria`
- **ADRs:** _none_
- **Contracts:** _none_
- **Implementation:** `src/main/index.ts`, `src/main/ipc/trusted-sender.ts`
- **Proving tests:** `src/main/ipc/trusted-sender.test.ts`, `src/renderer/src/features/settings/SettingsPage.test.tsx`, `tests/integration/csp.test.ts`
- **Test notes:** CSP, trusted sender, and the offline Settings statement are tested; no automated check scans the tree for network clients.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 1.
- **Decision:** implemented

### ML-REL-002 — Original files are never deleted or edited

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** A2
- **Text:** Original files are never deleted, edited, or truncated. The only file-moving operation is the confirmed duplicate quarantine.
- **Sources:** `docs/release/acceptance.md`, `docs/release/security-review.md`, `docs/contracts/health.md`
- **ADRs:** `docs/adr/0010-duplicate-quarantine.md`
- **Contracts:** `docs/contracts/health.md`
- **Implementation:** `src/main/modules/health/infrastructure/quarantine-mover.ts`, `scripts/check-read-only.mjs`
- **Proving tests:** `src/main/modules/health/infrastructure/quarantine-mover.test.ts`, `tests/integration/read-only-guard.test.ts`
- **Test notes:** Read-only guard and quarantine mover tests cover the allowlist and restore behavior. Tests carry the requirement ID.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 2.
- **Decision:** verified

### ML-REL-003 — Drive selection, catalog setup, and changed-letter handling work

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** A3
- **Text:** The app selects and identifies an external drive, sets up a catalog, and confirms a changed drive letter before updating the root path.
- **Source text:** External drive selection, catalog setup, and changed-letter handling are covered by drive gate tests and E2E.
- **Sources:** `docs/release/acceptance.md`, `docs/contracts/scan.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/scan.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/modules/drives/application/drive-service.test.ts`, `src/renderer/src/features/drives/DriveSelectionPage.test.tsx`, `tests/e2e/foundation.spec.ts`
- **Test notes:** Drive service, drive gate, and foundation E2E cover setup and changed-letter handling. Tests carry the requirement ID.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 3.
- **Decision:** verified

### ML-REL-004 — Four-stage scan controls and interruption recovery work

- **Kind:** outcome
- **Status:** implemented
- **Verification:** manual
- **Legacy ID:** A4
- **Text:** The initial scan is explicitly started and runs in four visible stages with pause/resume, processing intensity, and interruption recovery.
- **Source text:** Four-stage scan with pause/resume/intensity and interruption recovery; physical disconnect pending.
- **Sources:** `docs/release/acceptance.md`, `docs/release/release-checklist.md`, `docs/contracts/scan.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/scan.md`
- **Implementation:** _none_
- **Proving tests:** `src/renderer/src/features/scan/ScanPage.test.tsx`, `tests/e2e/scan.spec.ts`, `tests/integration/scan-controls.test.ts`, `tests/integration/scan-service.test.ts`
- **Test notes:** Four-stage scan, controls, intensity, and interruption are tested; the physical disconnect pass remains manual.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 4.
- **Decision:** implemented

### ML-REL-005 — Incremental scan and health detection work

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** A5
- **Text:** Incremental scans detect new, changed, missing, and likely moved files, and duplicate groups remain exact and complete.
- **Source text:** Incremental scan, missing/moved detection, and duplicate groups are covered by scan, health repository, and Library health E2E.
- **Sources:** `docs/release/acceptance.md`, `docs/contracts/scan.md`, `docs/contracts/health.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/scan.md`, `docs/contracts/health.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/repositories/health-repository.test.ts`, `tests/integration/scan-service.test.ts`
- **Test notes:** Incremental scan and health repository tests cover new/changed/missing/moved and duplicate groups. Tests carry the requirement ID.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 5.
- **Decision:** verified

### ML-REL-006 — Timeline, filters, density, viewer, reveal, and open work

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** A6
- **Text:** Memory Lane shows a virtualized chronological timeline with filters, density, viewer navigation, reveal, and external open.
- **Source text:** Memory Lane timeline, filters, density, viewer, reveal/open are covered by renderer, integration, and E2E suites.
- **Sources:** `docs/release/acceptance.md`, `docs/contracts/library.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/library.md`
- **Implementation:** _none_
- **Proving tests:** `src/renderer/src/features/library/LibraryPage.test.tsx`, `src/renderer/src/features/library/MediaViewerPage.test.tsx`, `tests/e2e/library.spec.ts`
- **Test notes:** Library renderer and E2E tests cover timeline, filters, density, viewer, reveal, and open. Tests carry the requirement ID.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 6.
- **Decision:** verified

### ML-REL-007 — Dates, undated items, and overrides work

- **Kind:** outcome
- **Status:** implemented
- **Verification:** manual
- **Legacy ID:** A7
- **Text:** ExifTool dates populate the timeline; undated items are grouped separately; manual date overrides are catalog-only and preserve extracted dates.
- **Source text:** ExifTool dates, Date unavailable, and manual overrides are covered by unit, integration, real ExifTool, and packaged smoke; mixed corpus pending.
- **Sources:** `docs/release/acceptance.md`, `docs/release/release-checklist.md`, `docs/contracts/library.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/library.md`
- **Implementation:** _none_
- **Proving tests:** `src/renderer/src/features/library/MediaViewerPage.test.tsx`, `src/renderer/src/features/library/UndatedPage.test.tsx`, `tests/e2e/dates.spec.ts`, `tests/integration/exif-metadata.test.ts`
- **Test notes:** ExifTool, undated, override, and E2E tests pass; the mixed-corpus manual pass remains.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 7.
- **Decision:** implemented

### ML-REL-008 — Whole-catalog validation works

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** A8
- **Text:** Whole-catalog validation supports pause/resume and produces a report.
- **Source text:** Whole-catalog validation with pause/resume and reports is covered by repository, service, renderer, and E2E.
- **Sources:** `docs/release/acceptance.md`, `docs/contracts/health.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/health.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/repositories/validation-repository.test.ts`, `src/renderer/src/features/health/HealthPage.test.tsx`, `tests/e2e/health.spec.ts`
- **Test notes:** Validation repository, health UI, and E2E cover pause/resume and reports. Tests carry the requirement ID.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 8.
- **Decision:** verified

### ML-REL-009 — Other files categories and actions work

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** A9
- **Text:** Other files are categorized and paginated, with external open and reveal for present files.
- **Source text:** Other files categories, pagination, external open/reveal are covered by repository, handler, renderer, E2E, and packaged smoke.
- **Sources:** `docs/release/acceptance.md`, `docs/contracts/other-files.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/other-files.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/repositories/other-files-repository.test.ts`, `src/renderer/src/features/other-files/OtherFilesPage.test.tsx`, `tests/e2e/phase-5.spec.ts`
- **Test notes:** Other files repository, renderer, and E2E cover categories, pagination, open, and reveal. Tests carry the requirement ID.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 9.
- **Decision:** verified

### ML-REL-010 — Cache controls and Settings work

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** A10
- **Text:** Settings exposes cache size and clearing, catalog details, backup status/location, background controls, and About.
- **Source text:** Cache controls and catalog/backup Settings are covered by service, handler, renderer, E2E, and packaged smoke.
- **Sources:** `docs/release/acceptance.md`, `docs/contracts/settings.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/settings.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/modules/settings/application/settings-service.test.ts`, `src/renderer/src/features/settings/SettingsPage.test.tsx`, `tests/e2e/phase-5.spec.ts`
- **Test notes:** Settings service, renderer, and E2E cover cache and backup controls. Tests carry the requirement ID.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 10.
- **Decision:** verified

### ML-REL-011 — SQLite-safe backups run on schedule and close

- **Kind:** invariant
- **Status:** implemented
- **Verification:** manual
- **Legacy ID:** A11
- **Text:** Backups use the SQLite online backup API every 15 minutes while the app is open and on graceful close.
- **Source text:** SQLite-safe backups every 15 minutes and on close; service/handler tests and packaged backup smoke; real-drive restore pending.
- **Sources:** `docs/release/acceptance.md`, `docs/release/release-checklist.md`, `docs/contracts/settings.md`
- **ADRs:** `docs/adr/0003-scheduled-backups-and-cache.md`
- **Contracts:** `docs/contracts/settings.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/backup-runner.test.ts`, `src/main/modules/settings/application/settings-service.test.ts`
- **Test notes:** Online backups, timer, shutdown, and failure handling are tested; the real-drive restore remains manual.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 11.
- **Decision:** implemented

### ML-REL-012 — Manual backup recovery works

- **Kind:** outcome
- **Status:** implemented
- **Verification:** manual
- **Legacy ID:** A12
- **Text:** Manual backup recovery restores the catalog and app databases.
- **Source text:** Manual backup recovery works; restore integration test; real-drive drill pending.
- **Sources:** `docs/release/acceptance.md`, `docs/release/release-checklist.md`, `docs/contracts/settings.md`
- **ADRs:** `docs/adr/0003-scheduled-backups-and-cache.md`
- **Contracts:** `docs/contracts/settings.md`
- **Implementation:** _none_
- **Proving tests:** `tests/integration/recovery.test.ts`
- **Test notes:** The copy-back path is tested; the real-drive recovery drill remains manual.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 12.
- **Decision:** implemented

### ML-REL-013 — Large catalog query performance stays within budget

- **Kind:** constraint
- **Status:** implemented
- **Verification:** manual
- **Legacy ID:** A13
- **Text:** Library queries remain within budget for 100,000 and 200,000 file catalogs.
- **Source text:** 100k/200k catalog query performance is covered by in-memory performance tests.
- **Sources:** `docs/release/acceptance.md`, `docs/release/release-checklist.md`, `docs/product/product-specification.md#13-performance-requirements`
- **ADRs:** _none_
- **Contracts:** _none_
- **Implementation:** _none_
- **Proving tests:** `tests/integration/library-performance.test.ts`
- **Test notes:** The default run covers 100k; 200k is opt-in and not part of this JSON run.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 13.
- **Decision:** implemented

### ML-REL-014 — Installer and portable artifacts are verified

- **Kind:** outcome
- **Status:** implemented
- **Verification:** automated-check
- **Legacy ID:** A14
- **Text:** Installer, portable, and unpacked artifacts contain the app archive, native SQLite, ExifTool, FFmpeg, and SHA-256 checksums.
- **Source text:** Installer/portable artifacts are verified by verify:package binaries and SHA-256; clean-VM install/uninstall pending.
- **Sources:** `docs/release/acceptance.md`, `docs/release/release-checklist.md`, `docs/release/security-review.md`
- **ADRs:** _none_
- **Contracts:** _none_
- **Implementation:** `scripts/verify-package.mjs`, `scripts/smoke-packaged.mjs`
- **Proving tests:** _none_
- **Test notes:** verify-package.mjs and smoke-packaged.mjs are automated scripts, not Vitest tests; clean-VM install/uninstall remains manual.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 14.
- **Decision:** implemented

### ML-REL-015 — Codec behavior and fallback are classified

- **Kind:** constraint
- **Status:** implemented
- **Verification:** manual
- **Legacy ID:** A15
- **Text:** Codec behavior and external fallback are classified for the supported image and video extensions.
- **Source text:** Codec behavior and external fallback are known; codec-matrix.md; manual playback pending.
- **Sources:** `docs/release/acceptance.md`, `docs/release/codec-matrix.md`, `docs/release/release-checklist.md`
- **ADRs:** _none_
- **Contracts:** _none_
- **Implementation:** _none_
- **Proving tests:** `src/renderer/src/features/library/MediaViewerPage.test.tsx`, `tests/e2e/video-proxy.spec.ts`
- **Test notes:** Fallback behavior is tested; the manual codec matrix pass remains pending.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 15.
- **Decision:** implemented

### ML-REL-016 — A real scan disconnect is safe

- **Kind:** invariant
- **Status:** implemented
- **Verification:** manual
- **Legacy ID:** A16
- **Text:** A real drive disconnect during a scan is safe, and reconnect/resume completes without modifying originals.
- **Source text:** Disconnect during a real scan is safe; simulated disconnect test; physical USB pending.
- **Sources:** `docs/release/acceptance.md`, `docs/release/release-checklist.md`, `docs/contracts/scan.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/scan.md`
- **Implementation:** _none_
- **Proving tests:** `tests/integration/scan-controls.test.ts`
- **Test notes:** Simulated disconnect and resume are tested; the physical USB drill remains manual.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 16.
- **Decision:** implemented

### ML-REL-017 — A clean Windows VM release pass is required

- **Kind:** constraint
- **Status:** deferred
- **Verification:** manual
- **Legacy ID:** A17
- **Text:** A clean Windows VM release pass covers install, launch, scan, settings, backup, cache, uninstall, and portable use.
- **Source text:** Clean Windows VM release pass is pending in release-checklist.md.
- **Sources:** `docs/release/acceptance.md`, `docs/release/release-checklist.md`
- **ADRs:** _none_
- **Contracts:** _none_
- **Implementation:** _none_
- **Proving tests:** _none_
- **Test notes:** Manual clean Windows VM pass; no automated test can prove install/uninstall and portable launch on a clean OS.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 17.
- **Decision:** deferred

### ML-REL-018 — WMV and 3GP compatible playback works

- **Kind:** outcome
- **Status:** implemented
- **Verification:** manual
- **Legacy ID:** A18
- **Text:** WMV and 3GP play through the cached FFmpeg compatible copy.
- **Source text:** WMV/3GP compatible playback; packaged WMV proxy smoke and codec matrix; clean-VM playback pending.
- **Sources:** `docs/release/acceptance.md`, `docs/release/codec-matrix.md`, `docs/release/release-checklist.md`
- **ADRs:** `docs/adr/0009-bundled-ffmpeg-video-proxies.md`
- **Contracts:** `docs/contracts/library.md`
- **Implementation:** _none_
- **Proving tests:** `tests/e2e/video-proxy.spec.ts`, `tests/integration/video-proxy.test.ts`
- **Test notes:** WMV/3GP proxy integration and E2E tests pass; the clean-VM playback pass remains manual.
- **Conflicts:** _none_
- **Notes:** Maps acceptance.md row 18.
- **Decision:** implemented

## Conflicts

_No conflicts in this batch._
## Approval

This batch is approved. For future batches, either:

1. change `status` to `accepted` and keep the text;
2. edit `text` in the JSON and keep `needs-review`; or
3. change `status` to `non-goal` if the item is out of scope.

Do not mark a requirement `verified` unless its `verificationMethod` is satisfied:

- `automated-test`: at least one test carries the requirement ID and passes;
- `automated-check`: an implementation or guard path is recorded;
- `manual`: a test note records the manual acceptance;
- `inspection`: an implementation or guard path is recorded.
