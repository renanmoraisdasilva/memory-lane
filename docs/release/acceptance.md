# v0.1 acceptance criteria

Status: automated criteria complete; manual release pass pending.

| # | Criterion | Evidence | Status |
|---|---|---|---|
| 1 | Local-only, no accounts, telemetry, or network services | Offline Settings statement, no network clients, CSP self/localhost only | Automated |
| 2 | Original files are never moved, renamed, edited, or deleted | Read-only guard, path guards, integration tests, IPC review | Automated |
| 3 | External drive selection, catalog setup, and changed-letter handling | Drive gate tests and E2E | Automated |
| 4 | Four-stage scan with pause/resume/intensity and interruption recovery | Scan integration, controls, worker restart, E2E | Automated; physical disconnect pending |
| 5 | Incremental scan, missing/moved detection, duplicate groups | Scan, health repository, and Library health E2E | Automated |
| 6 | Memory Lane timeline, filters, density, viewer, reveal/open | Renderer, integration, and E2E suites | Automated |
| 7 | ExifTool dates, Date unavailable, manual overrides | Unit, integration, real ExifTool, packaged smoke | Automated; mixed corpus pending |
| 8 | Whole-catalog validation with pause/resume and reports | Repository, service, renderer, E2E | Automated |
| 9 | Other files categories, pagination, external open/reveal | Repository, handler, renderer, E2E, packaged smoke | Automated |
| 10 | Cache controls and catalog/backup Settings | Service, handler, renderer, E2E, packaged smoke | Automated |
| 11 | SQLite-safe backups every 15 minutes and on close | Service/handler tests, packaged backup smoke | Automated; real-drive restore pending |
| 12 | Manual backup recovery works | Restore integration test | Automated; real-drive drill pending |
| 13 | 100k/200k catalog query performance | In-memory performance tests | Automated |
| 14 | Installer/portable artifacts verified | `verify:package` binaries and SHA-256 | Automated; clean-VM install/uninstall pending |
| 15 | Codec behavior and external fallback are known | `codec-matrix.md` | Manual playback pending |
| 16 | Disconnect during a real scan is safe | Simulated disconnect test | Physical USB pending |
| 17 | Clean Windows VM release pass | `release-checklist.md` | Pending |

## Sign-off rule

v0.1 is accepted only when every row above is either automated-green or marked
complete in `release-checklist.md` with a date and tester. No manual row may be
waived without updating the product scope.

Post-v0.1 replication has a separate acceptance matrix in
[`../product/replication-implementation-plan.md`](../product/replication-implementation-plan.md)
(§9). It is not part of v0.1 sign-off.
