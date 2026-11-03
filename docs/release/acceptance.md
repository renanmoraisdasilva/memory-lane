# Acceptance criteria

Status: v0.1 and replication automated criteria complete; manual release pass pending.

| # | Criterion | Evidence | Status |
|---|---|---|---|
| 1 | Local-only, no accounts, telemetry, or network services | Offline Settings statement, no network clients, CSP self/localhost only | Automated |
| 2 | Original files are never deleted, edited, or truncated. The only file-moving operation is the confirmed duplicate quarantine. | Read-only guard, path guards, integration tests, IPC review; quarantine rows Q1-Q9 | Automated |
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
| 18 | WMV/3GP compatible playback | Packaged WMV proxy smoke, codec matrix | Automated; clean-VM playback pending |

## Replication acceptance (post-v0.1)

| # | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| R1 | Partial runs copy only planned uncovered files and report the remainder | Plan, run integration, replication E2E | Automated |
| R2 | A full copy with enough capacity completes and is promotable | Full-copy integration, promotion E2E | Automated |
| R3 | A full copy with insufficient capacity is incomplete and never spills into partial destinations | Full-copy shortfall integration | Automated |
| R4 | Promotion requires a complete, connected, confirmed full copy and no active work | Promotion policy, integration, E2E | Automated |
| R5 | Promotion preserves `catalog_id`, dates, overrides, duplicates, and coverage | Promotion merge repository tests | Automated |
| R6 | Promotion leaves destination-only files out of the source and keeps them `local_only` | Promotion merge tests, review step | Automated |
| R7 | Rollback works before the first change and is refused after | Promotion integration and service tests | Automated |
| R8 | Source archives remain read-only and source switching is blocked during runs | Read-only guard, run controls, E2E | Automated |
| R9 | Physical USB promotion and rollback drills | Manual release pass | Pending |

## Duplicate quarantine acceptance (post-v0.1)

| # | Criterion | Evidence | Status |
|---|---|---|---|
| Q1 | Duplicate groups are exact full-SHA-256 groups and list every present copy | Health repository and cleanup domain tests | Automated |
| Q2 | The keeper is a verified backup copy first, then the oldest copy; one keeper remains per group | Cleanup domain and repository tests | Automated |
| Q3 | Coverage is a preference, not an eligibility gate; uncovered groups are eligible with a warning | Cleanup domain, repository, and health UI tests | Automated |
| Q4 | The mover re-hashes the source before the move and the quarantined copy after; a mismatch restores the source | Quarantine mover tests | Automated |
| Q5 | The mover skips unsafe or ambiguous candidates and never moves the last eligible copy | Cleanup domain and quarantine mover tests | Automated |
| Q6 | Every move writes a manifest, journal, and `cleanup_moves` audit row; the quarantine is never deleted | Quarantine mover, repository, and migration tests | Automated |
| Q7 | After a move batch, moved rows are deleted and a rescan does not report them missing | Cleanup service and cleanup-then-rescan integration tests | Automated |
| Q8 | The UI shows KEEP/MOVE, SKIP reasons, confirmation, progress, and completion | Health UI and E2E tests | Automated |
| Q9 | The security review and read-only guard allowlist only the quarantine mover | Security review and read-only guard | Automated |

## Sign-off rule

v0.1 is accepted only when every v0.1 row (1-18) is either automated-green or
marked complete in `release-checklist.md` with a date and tester. No manual row
may be waived without updating the product scope.

Replication has its own acceptance rows and matrix in
[`../product/replication-implementation-plan.md`](../product/replication-implementation-plan.md).
Its rows are accepted only when automated-green or recorded in
`release-checklist.md`; they are not part of v0.1 acceptance.

Duplicate quarantine has its own rows Q1-Q9 and the batch 1 ledger in
[`../traceability/requirements.json`](../traceability/requirements.json). Its
rows are accepted only when the ID-tagged tests are green; they are not part of
v0.1 acceptance.
