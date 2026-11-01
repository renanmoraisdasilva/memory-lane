# Replication implementation plan

Status: proposed. Design and behavior live in
[`partial-backups.md`](partial-backups.md). Contracts live in
[`../contracts/replication.md`](../contracts/replication.md). The cross-cutting
architecture decision is
[`../adr/0008-replication-implementation-boundaries.md`](../adr/0008-replication-implementation-boundaries.md).

## 1. Scope decisions

Confirmed on 2026-11-01:

- **Dedicated destinations first.** A destination must not be an active source
  archive. Dual-role browsing and promotion are deferred.
- **One heavy operation at a time.** Scan, validation, and replication are
  mutually exclusive. Browsing stays available.
- **Switching the source is blocked** while a run is running or paused.
- **Three delivery slices, same release.** Adoption and planning, then partial
  copy execution, then full copy and promotion. Promotion ships last.

These choices keep the riskiest catalog-merge work out of the first copy
executor and make failure recovery understandable. No further blocking product
decision is required for Slice 1.

## 2. Current-code findings

The scout found no blocker that requires a rewrite, but several current
assumptions must be extended deliberately.

| Area | Current state | Implication |
|---|---|---|
| DB worker catalog | `db-worker-handler.ts` owns one `CatalogSession` for the source catalog | Destination catalogs and the source index need a catalog registry |
| SQLite ownership | Only the DB worker imports `better-sqlite3` | Destination catalog/source-index writes stay in the DB worker |
| Read-only guard | `scripts/check-read-only.mjs` rejects `copyFile`, `rename`, `rm`, and `writeFile` outside four files, but does not catch `mkdir`, `open` with write flags, or `cp` | Harden the guard in Slice 1 and rely on the runtime destination-writer policy as the real boundary |
| Path safety | `path-guard.ts` checks one root with `path.resolve` | Destination writes need realpath/reparse-point checks and source/destination overlap checks |
| Heavy work | Scan and validation each run independently | A workload coordinator is needed before replication starts |
| Source switching | `AppShell.switchDrive` closes the workspace; `DriveService` has an `onBeforeCatalogChange` hook | The hook can enforce “pause or finish the backup first” |
| Media | `ml-media` resolves IDs only in the active source catalog | Destination detail needs a destination-scoped media URL |
| Schema | Catalog schema is 6; many tests assert 6 | Replication migration moves it to 7 and updates fixtures once |
| Unused table | `app.db.backup_destinations` exists but nothing uses it | Replace it with a typed destination cache instead of creating a second registry |
| File paths | `files.path` is absolute and library/media resolve it directly | Destination catalogs need a portable relative path and a role-aware resolver |
| File hashing | `FileHasher` hashes a whole file | Copy needs a new streaming copier that hashes source and destination bytes |
| Pause/stop pattern | `ScanService` has pause gates, active state, shutdown interruption, and recovery | Reuse the pattern for `RunService`; do not invent a second scheduler |
| Contracts | Zod schemas and typed IPC envelopes are established | Replication contracts follow the same pattern, namespaced to avoid a flat API explosion |
| E2E fixture | One `MEMORY_LANE_DEV_DRIVE` | Add a multi-drive fixture for source + destinations |
| Tests | Repository tests use in-memory SQLite; integration uses temp files | Reuse both layers; add fault injection at interfaces |

Reusable pieces:

- `ScanService` pause gate, active-loop, shutdown, and interrupted-state pattern.
- `ScanRunner` batch/progress conventions, but not its stage model.
- `DbWorkerClient`, `DbClient`, worker protocol, and repository test style.
- `file-hasher.ts` for source hashes.
- `file-enumerator.ts` traversal ideas and `classifyFile` for media classes.
- `media-response.ts` range/HEAD handling.
- `tests/integration/scan-harness.ts` and `tests/e2e` launch pattern.
- `onBeforeCatalogChange` in `DriveService` for the source-switch guard.

## 3. Code organization

The existing application already uses feature modules, a single SQLite writer,
Zod contracts, and a feature-based renderer. Replication follows those patterns
instead of introducing a second architecture.

```text
src/shared/contracts/replication/
  types.ts                 Zod schemas and inferred public types
  channels.ts              replication IPC channel names
  api.ts                   ReplicationApi namespace

src/main/modules/replication/
  domain/                  pure rules; no Node, Electron, SQL, or logger
    replication-types.ts
    coverage.ts
    capacity.ts
    chronology.ts
    path-policy.ts
    conflict-classifier.ts
    plan-builder.ts
    plan-summary.ts
    promotion-policy.ts
    run-state.ts
  application/             orchestration; depends on interfaces only
    replication-service.ts        facade used by IPC
    destination-service.ts        register, update, re-adopt, status
    adoption-service.ts           scan/match/hash existing destination files
    plan-service.ts               load inputs and call the pure planner
    run-service.ts                start/pause/resume/stop/recover
    run-runner.ts                 file-by-file execution loop
    run-progress.ts               progress batching and ETA
    promotion-service.ts          verify/apply/rollback
    source-hash-service.ts        ensure source hashes for coverage
  infrastructure/          filesystem and Electron adapters
    destination-reader.ts         enumerate/stat/lstat, read-only
    destination-writer.ts         the only destination write adapter
    destination-marker.ts         marker read/write
    destination-capabilities.ts   max file size, path length, case rules
    file-copier.ts                stream copy + source/destination hashes
    drive-availability.ts         volume identity and reconnect checks

src/main/db/
  catalog-registry.ts             source + destination catalog sessions
  replication-worker-protocol.ts  DB method names and Zod params
  replication-db-handlers.ts      thin handler map
  repositories/
    replication-destination-repository.ts
    replication-coverage-repository.ts
    replication-adoption-repository.ts
    replication-run-repository.ts
    replication-event-repository.ts
    replication-promotion-repository.ts
    destination-library-repository.ts
    source-index-repository.ts
  migrations/catalog/0007-replication.sql
  migrations/app/0003-replication-cache.sql

src/main/modules/workloads/
  application/workload-coordinator.ts

src/renderer/src/features/replication/
  ReplicationOverviewPage.tsx
  ReplicationPlanPage.tsx
  ReplicationRunPage.tsx
  ReplicationDestinationPage.tsx
  ReplicationPromotionPage.tsx
  components/
    DestinationCard.tsx
    DestinationSwitcher.tsx
    CoverageMap.tsx
    RunBanner.tsx
    PlanJobCard.tsx
    PromotionWizard.tsx
    AddDestinationDrawer.tsx
    AttentionCard.tsx
  use-replication-overview.ts
  use-replication-plan.ts
  use-replication-run.ts
  use-replication-destination.ts
  use-replication-promotion.ts
  replication-client.ts
  replication-client-context.tsx
  replication-url.ts
  types.ts

src/renderer/src/features/shell/
  ReplicationChip.tsx             top-bar progress chip
```

### 3.1 Dependency rules

- `domain/` is pure. It can import other domain files and shared types only.
- `application/` depends on domain types and narrow interfaces:
  - `DbClient`
  - `DestinationFileSystem`
  - `FileCopier`
  - `FileHasher`
  - `Logger`
  - `Clock`
  - `WorkloadCoordinator`
- `infrastructure/` implements those interfaces with Node/Electron APIs.
- `db/repositories/` take a `Database.Database` and never import application
  services.
- `db/replication-db-handlers.ts` only parses Zod params and calls repositories.
- The renderer imports shared contracts and its own client. It never imports main
  process code.
- The existing dependency-cruiser rules continue to enforce these boundaries.
  Add a rule that `replication/domain` cannot import
  `replication/infrastructure` or `replication/application`.

### 3.2 File-size and function-size discipline

The repository hard limit is 400 physical lines and 100 lines per function. The
layout above is intentionally split so no file needs an exception:

- planner rules are separate from plan presentation summaries;
- run lifecycle is separate from the file loop;
- progress batching is separate from run transitions;
- destination filesystem reads and writes are separate adapters;
- each DB repository owns one table group.

If a file approaches 300 lines, split by use case rather than adding a disable.

### 3.3 Renderer state

- Add a `ReplicationClient` interface and context, following the existing
  `LibraryClient` pattern. Tests inject a mock client.
- Add `queryKeys.replication` entries:
  - overview
  - destinations
  - destination detail
  - plan
  - run state
  - run events
  - promotion
- Poll `getRunState` every 1 second while `running` or `stopping`; every 2
  seconds while `paused`; no polling while `interrupted` (show resume), and stop
  when terminal.
- Invalidate overview, plan, destinations, and coverage on run completion, pause,
  stop, adoption completion, and promotion completion.
- Do not duplicate lock logic in components. The backend returns a
  `ReplicationCapabilities` object (`canPause`, `canResume`, `canStop`,
  `canEditPlan`, `canAddDestination`, `canPromote`, `canSwitchSource`) and the
  UI renders from it.

## 4. Major structural changes

### 4.1 Catalog registry in the DB worker

**Problem:** the DB worker currently owns one `CatalogSession`. A destination
detail page needs a destination catalog open while the source catalog remains
open and serving media and queries.

**Change:** extract the current session logic from `db-worker-handler.ts` into
`src/main/db/catalog-registry.ts`.

Responsibilities:

- hold one active source catalog;
- hold destination catalogs keyed by `destinationId` and normalized path;
- reject duplicate paths and source-as-destination;
- acquire and release a catalog lock per opened catalog;
- run migrations on first open;
- close all sessions on `close`;
- expose `getSource()`, `getDestination(destinationId)`, and
  `closeDestination(destinationId)`.

Existing scan, library, health, and settings handlers stay bound to the source
catalog. Destination library handlers use the destination session. This is the
largest change and should land first with registry tests before any replication
table exists.

### 4.2 Workload coordinator

**Problem:** scan, validation, and replication all read the source drive and
write the source catalog. Running them together makes progress, errors, and
shutdown ambiguous.

**Change:** add `WorkloadCoordinator` in the main process.

- Lease types: `scan`, `validation`, `replication`.
- One lease at a time.
- `acquire(kind, runId)` returns a release function or throws
  `REPLICATION_WORKLOAD_CONFLICT`.
- `ScanService.startScan`, `HealthService.startValidation`, and
  `ReplicationService.startRun` acquire a lease.
- Release on completion, failure, interruption, and shutdown.
- Expose `hasActiveWorkload()` for the source-switch guard.

Existing services change constructors to accept the coordinator. Their tests
get a fake coordinator. This is cross-cutting but small.

### 4.3 Destination write adapter and read-only guard

**Problem:** the current read-only guard rejects `copyFile`, `rename`, `rm`, and
`writeFile` anywhere in `src/main` outside a four-file allowlist. Replication
must write destination copies.

**Change:** introduce `DestinationFileSystem` with one production adapter,
`destination-writer.ts`. It is the only replication file added to the read-only
allowlist.

The adapter validates:

- the destination is registered and connected;
- the destination root is not the source root and does not overlap it;
- the destination volume is not the source volume;
- the relative path is not absolute and has no `..`;
- the resolved path stays inside the destination root after `realpath`;
- no symlink, junction, or reparse point escapes the root.

Operations:

- `mkdir(relativePath)`
- `writeText(relativePath, text)` for the advisory destination marker
- `createTemp(relativePath)` → writable stream and temp path
- `renameTemp(tempPath, relativePath)`
- `removeTemp(tempPath)`
- `removeEmptyDirectory(relativePath)` only for directories created by the run

The marker module composes the JSON and calls the writer; it does not call
`fs.writeFile` directly. Generated thumbnails and previews continue to use the
existing reviewed cache generator and stay under `.memorylane/cache`.
Destination cache paths come from the destination context, never from the
renderer.

The adapter does not delete verified files, source files, or destination-only
files. It only removes its own temp files and empty directories it created.

Add a runtime test that tries source paths, overlapping roots, unregistered
roots, `..`, and symlink escapes. Add a static guard test that the allowlist
contains only this file.

### 4.4 Namespaced replication API

**Problem:** the existing `MemoryLaneApi` is flat. Replication would add roughly
two dozen methods.

**Change:** add `replication: ReplicationApi` to the preload bridge and a
`ReplicationClient` in the renderer. Existing flat methods remain untouched.

### 4.5 Destination-scoped media

**Problem:** `ml-media` resolves file IDs only in the active source catalog.
Destination detail needs thumbnails and previews for destination library files.

**Change:** extend `MediaUrlTarget` and `parseMediaUrl` with a destination
scope:

```text
ml-media://destination/<destinationId>/thumbnail/<fileId>
ml-media://destination/<destinationId>/media/<fileId>
```

The media handler resolves destination URLs through destination-library DB
methods and the catalog registry. Source URLs remain unchanged. This keeps
renderer requests ID-based and prevents arbitrary path access.

### 4.6 Multi-drive development fixture

**Problem:** E2E currently supports one development drive via
`MEMORY_LANE_DEV_DRIVE`.

**Change:** add `MEMORY_LANE_DEV_DRIVES` as a JSON array of
`{ path, label, serial }`, while keeping the single-drive variable for existing
tests. `listDetectedDrives` returns all configured development drives. E2E can
then create one source and two destinations in one temporary root.

### 4.7 Source-switch guard

**Problem:** `AppShell.switchDrive` closes the workspace without checking for an
active run. The main process would keep a run alive with no source UI.

**Change:** `DriveService` already accepts `onBeforeCatalogChange`. In
`main/index.ts`, compose it:

```ts
onBeforeCatalogChange: async () => {
  replication.assertCanChangeSource();
  await scan.interruptActive();
}
```

`assertCanChangeSource` throws when a run is running or paused. The drive drawer
also disables “Switch drive” with the same reason, but the main-process guard is
authoritative.

## 5. Runtime flows

### 5.1 Register and adopt a destination

1. Renderer calls `listDestinationCandidates`.
2. User picks a connected drive, root, goal, layout, allocation, and reserve.
3. Main process validates volume identity, root overlap, and destination
   marker.
4. DB worker creates/reopens the destination catalog and stores
   `replica_destinations` in the source catalog.
5. Main process enumerates the destination with `destination-reader`.
6. Adoption acquires the replication workload lease and runs as a resumable
   session with pause/resume. It matches path/size, then unique name/size, then
   unique hash.
7. Source hashes are filled read-only through `SourceHashService`. It reads
   existing hashes with source size/mtime, hashes only when missing or stale,
   and persists the hash plus observed size/mtime through a DB method so
   coverage can trust it.
8. Destination hashes are computed and compared.
9. DB worker persists adoption batches, orphans, and summary counters.
10. Destination local catalog is updated in batches.
11. Source index is written.
12. UI shows verified coverage, only-on-drive files, source-missing replicas,
    identity confidence, and adoption progress.

Adoption is read-only on the destination. It never moves, renames, deletes, or
overwrites a destination file.

### 5.2 Plan

1. `PlanService` loads source files, coverage, destination state, and
   replacement candidates from the DB worker.
2. Pure `plan-builder` runs the replacement pass, partial chain, and full-copy
   job separately.
3. `plan-summary` computes coverage labels, remainder, shortfall, warnings, and
   `planHash`.
4. Renderer shows the plan and execution drawer.
5. Start backup recomputes the plan, compares `planHash`, and rejects or
   refreshes if the inputs changed.
6. DB worker creates the run with `planHash` and `planRevision = 1`.

The planner is deterministic. The same inputs produce the same plan and hash.

### 5.3 Run

1. `ReplicationService.startRun` acquires the workload lease and creates the run.
2. `RunRunner` asks the plan service for assignments in destination order:
   full copy first, then partial destinations by priority.
3. For each file:
   - checkpoint pause/stop and drive availability;
   - recheck source size/mtime/hash;
   - recheck destination identity, free space, reserve, path;
   - stream copy to `.memorylane-tmp-*`;
   - hash streamed bytes and the temp file;
   - discard on source change or hash mismatch;
   - rename temp to final path;
   - save the verified replica row;
   - update the destination local catalog and cache best-effort.
4. Progress is persisted in batches (for example every 25 files or 1 second),
   not once per file.
5. Run events are appended only on state changes and plan changes.
6. On completion, the source index is refreshed and coverage is invalidated.

Source catalog writes are authoritative. Destination catalog and source-index
writes are derived; if they fail, the verified backup still counts and the UI
shows a warning. If the source catalog write fails, stop the run and do not count
the file; a destination file that was already renamed is re-adopted on the next
connection.

### 5.4 Pause, replan, resume

- Pause finishes the current file, persists it, and stops scheduling.
- `getRunState` reports `paused` and `canEditPlan = true`.
- Changing allocation, order, goal, or destinations increments `planRevision`,
  recomputes remaining work, and appends `plan_changed`.
- Verified files are never recopied or moved.
- Resume continues from the recomputed plan.
- Stop after the current file transitions to `stopped`.
- App shutdown marks the run `interrupted` and releases the lease before the DB
  worker closes.

### 5.5 Full copy and promotion

- A full-copy destination is planned independently and receives every present
  source file.
- Shortfall blocks the full-copy goal by default; an explicit partial fallback is
  allowed.
- A full copy is complete only with zero stale, missing, conflict, failed, or
  remainder files.
- Promotion is a four-step wizard: verify, review extras, choose fates, confirm.
- Promotion preflight requires a complete full copy, connected destination,
  confirmed identity, no active run, no scan, and no validation.
- Apply writes a pre-promotion snapshot, merges the source catalog into the
  destination catalog, rebases paths, demotes the old source, registers it as a
  destination, and switches the active catalog.
- Rollback is available until the first write to the new source. Merge failure
  restores the snapshots and keeps the old source active.

### 5.6 Re-entry and recovery

- Add `ReplicationChip` to the top bar and a sidebar pulse, both driven by
  `getRunState`. It appears for `running`, `paused`, `stopping`, and
  `interrupted`.
- The run route is stable: `/backup/run`.
- Opening the app with an interrupted run shows the overview with a Resume
  backup banner.
- A second Start backup opens the active run.
- The run screen and overview show `canEditPlan`, `canPause`, `canStop`, and
  disabled reasons from the backend, not local guesses.

## 6. Data and migrations

### 6.1 Catalog migration 7

Add:

- `archive_identity` with stable `catalog_id`, role, source relationship,
  source root, active source volume, promotion timestamps;
- `files.source_membership` default `source`;
- `files.relative_path` nullable, for destination-catalog portability;
- `hashes.source_size_at_hash` and `hashes.source_modified_at_fs_at_hash`;
- `replica_destinations`;
- `replica_files`;
- `replica_orphans`;
- `replication_adoptions`;
- `replication_runs`;
- `replication_run_events`;
- `source_promotions`;
- `relative_path_key` and `source_relative_path_key` normalized columns for
  Windows-safe case uniqueness;
- indexes for coverage, priority, status, and run lookup;
- a partial unique index or trigger that allows at most one active run.

Backfill rules:

- every existing catalog becomes `role = source`;
- every existing file becomes `source_membership = source`;
- existing `files.relative_path` values stay null because source paths are
  absolute;
- `archive_identity.source_root_relative` is derived from the common ancestor of
  enabled `scan_roots`, or empty when the scan spans the catalog root. If a scan
  root is outside the catalog root, replication is blocked with a clear error;
- existing `drive_identity.volume_id` becomes
  `archive_identity.active_source_volume_id`;
- `catalog_id` is a new stable UUID stored once;
- existing hashes get null size/mtime and are re-hashed before use as coverage.

Set `CATALOG_SCHEMA_VERSION = 7`. Update every test fixture and assertion that
currently expects 6.

### 6.2 App migration 3

Replace the unused `backup_destinations` table with
`replication_destination_cache`:

- volume ID
- destination ID
- catalog ID
- label
- root relative
- last seen
- last status

This table is a cache for drive selection and the destination picker. It is
never the authority for coverage.

### 6.3 Destination marker and source index

- Marker schema version 1 under
  `<destination>/.memorylane/replicas/<catalog-id>.json`.
- Source index schema version 1 under
  `<destination>/.memorylane/replicas/<catalog-id>/index.db`.
- Both are written by the DB worker through validated absolute paths.
- Both are advisory snapshots; the source catalog remains authoritative.

### 6.4 Performance shape

- `replica_files` indexes: `(replica_id, status)`, `(file_id, status)`,
  `(replica_id, source_relative_path_key)`.
- `replica_destinations(priority)`.
- Coverage uses `COUNT(DISTINCT file_id)` over verified rows with status
  predicates, not per-file application loops.
- The planner loads a compact source row set: `file_id`, `source_relative_path`,
  `size`, `resolved_date`, `media_class`. It does not load metadata blobs.
- 25,000 files is the current real archive. 200,000 is the performance target.

## 7. Delivery slices

### Slice 1 — foundations, adoption, coverage, and plan

Deliver:

- catalog schema 7 and app migration 3;
- catalog registry, destination path policy, read-only allowlist, and guard
  hardening for `mkdir`/write-open APIs;
- shared contracts, namespaced preload API, error codes;
- workload coordinator and source-switch guard;
- destination registration, marker, resumable adoption sessions, source hashes,
  orphans, and adoption progress UI;
- coverage queries and source index;
- overview, destination detail, plan screen, add-destination drawer;
- read-only UI states for partial-only, full-copy-only, all-offline, no
  destinations, and completed full copy.

Exit criteria:

- existing suite green after schema bump;
- registry and path-policy tests green;
- adoption works with reorganized paths and missing markers;
- coverage math and scope labels are correct;
- no destination writes occur during Slice 1 except the marker, destination
  catalog, and source index;
- plan tests pass for all deployment shapes.

### Slice 2 — partial copy execution and run lifecycle

Deliver:

- `DestinationFileSystem`, `FileCopier`, stale replacement, free-space checks;
- run service and runner, pause/resume/stop, plan revisions, run events;
- run screen, global run chip, locked controls, re-entry;
- destination local library updates and destination-scoped media;
- failure handling for disk full, disconnect, source change, permission, crash;
- E2E happy path for source + two destinations with pause/resume.

Exit criteria:

- partial plans copy exactly the planned files and report the remainder;
- verified files survive pause, stop, restart, and replan;
- no source file is written;
- no verified file is copied twice across partial destinations;
- run and destination tests cover the failure matrix;
- app shutdown leaves an interrupted, resumable run.

### Slice 3 — full copy and promotion

Deliver:

- full-copy goal, shortfall, completion status, source-growth degradation;
- promotion wizard, preflight, snapshots, catalog merge, demotion, keep/retire;
- rollback before the first change;
- full-copy E2E and promotion E2E;
- security review, README, release acceptance updates.

Exit criteria:

- full copy with enough capacity completes and is promotable;
- full copy with insufficient capacity is incomplete and does not spill;
- promotion preserves `catalog_id`, dates, overrides, duplicates, and coverage;
- rollback works before the safe point and is refused after;
- old source and 1 TB destinations end in the chosen roles;
- no active source can be registered as a destination in this release.

## 8. Test strategy

### 8.1 Unit tests

Pure domain tests, no filesystem or SQLite:

- coverage union/overlap/gap math;
- capacity, reserve, shortfall, peak replacement space;
- chronological comparator and undated ordering;
- conflict vs stale vs missing classification;
- path normalization, case keys, path length, FAT32 limits;
- plan builder for partial-only, full-only, mixed, offline, completed full copy;
- plan summary labels and remainder;
- run state machine and allowed transitions;
- promotion eligibility and rollback window.

### 8.2 Repository and migration tests

Real in-memory SQLite:

- fresh schema 7;
- schema 6 -> 7 migration and backfill;
- unique constraints and status checks;
- one active run;
- coverage queries with overlapping and offline replicas;
- orphan and source-missing queries;
- run event append-only behavior;
- source index schema and write/read round trip.

### 8.3 Service and coordination tests

- workload coordinator exclusive leases;
- destination registration and identity collision;
- adoption matching order and ambiguity;
- run start/pause/resume/stop/replan;
- source switch rejection;
- scan/validation/replication conflict;
- app shutdown interruption;
- promotion preflight and rollback.

### 8.4 Infrastructure tests

Temp filesystem and injected faults:

- destination writer accepts only safe paths;
- symlink/junction escape rejected;
- temp file creation, hash mismatch, rename, cleanup;
- source change during copy;
- disk full;
- permission denied and locked file retry;
- destination disconnect and reconnect;
- case collision and path length;
- marker read/write and corrupt marker;
- source index write failure is non-fatal.

### 8.5 Renderer component tests

- overview normal/running/paused;
- plan normal/locked/editable;
- disabled controls and explanations;
- run progress/paused/stopped/completed/error;
- destination switcher, tabs, map scope, file filters;
- promotion wizard steps, blocked state, completion;
- add-destination drawer queued state;
- no horizontal overflow at minimum width;
- keyboard and ARIA behavior for tabs, drawers, and wizard.

### 8.6 Integration tests

Use `tests/integration/replication-harness.ts` with a real source catalog and
two real destination folders.

- adoption with matching/reorganized/renamed files;
- partial plan and copy-what-fits;
- stale replacement and reserve floor;
- full copy and shortfall;
- pause/replan/resume;
- restart and interrupted run;
- full-copy promotion;
- rollback and merge failure;
- destination library/media scope;
- destination-only and source-missing flows.

### 8.7 E2E tests

Add `tests/e2e/replication.spec.ts` using `MEMORY_LANE_DEV_DRIVES`.

Happy path:

1. set up source catalog and scan;
2. add destination A and B;
3. adopt and verify;
4. review plan;
5. start, pause, navigate away, return via chip, resume;
6. complete and inspect destinations;
7. verify source files are unchanged.

Promotion path:

1. add full-copy destination;
2. complete full copy;
3. open promotion wizard;
4. confirm and verify new source roles;
5. roll back before first change.

Failure path:

1. try to switch source during a run;
2. try to start a scan during a run;
3. try promotion while paused;
4. confirm each is blocked with a reason.

### 8.8 Performance tests

- plan 200,000 files under the agreed budget;
- coverage queries with 200,000 replica rows;
- destination adoption of 100,000 files with bounded memory;
- run progress polling does not cause query storms;
- SQLite WAL growth and checkpoint behavior;
- no per-file DB round trip when batching progress.

### 8.9 Static and security tests

- read-only guard allowlist contains only the destination writer;
- destination writer tests cover source-path and overlap rejection;
- IPC schemas reject unknown/malformed payloads;
- media parser rejects destination path injection;
- source files opened read-only;
- no renderer direct filesystem or SQLite access;
- update `docs/release/security-review.md`.

### 8.10 Proposed test files

| File | Scope |
|---|---|
| `src/main/modules/replication/domain/*.test.ts` | coverage, capacity, chronology, planner, path policy, state machine |
| `src/main/modules/replication/infrastructure/destination-writer.test.ts` | destination path safety, temp/rename/remove, symlink escape |
| `src/main/modules/replication/infrastructure/file-copier.test.ts` | stream copy, dual hash, source change, hash mismatch |
| `src/main/modules/replication/application/run-service.test.ts` | start/pause/resume/stop/replan/recovery |
| `src/main/modules/replication/application/promotion-service.test.ts` | preflight, fates, rollback |
| `src/main/db/repositories/replication-*.test.ts` | constraints, coverage, runs, events, promotions |
| `src/main/db/catalog-registry.test.ts` | source + destination sessions, duplicate paths, locks |
| `src/main/modules/workloads/application/workload-coordinator.test.ts` | exclusive leases and conflicts |
| `src/renderer/src/features/replication/*.test.tsx` | overview, plan, run, destination, promotion states |
| `tests/integration/replication-harness.ts` | real source + two destination fixtures |
| `tests/integration/replication-adoption.test.ts` | adoption, orphans, conflicts, source index, pause/resume/restart |
| `tests/integration/replication-plan.test.ts` | deployment shapes and planning |
| `tests/integration/replication-run.test.ts` | copy, pause, resume, stop, replan |
| `tests/integration/replication-failures.test.ts` | disk full, permissions, disconnect, source change |
| `tests/integration/replication-promotion.test.ts` | full copy, merge, rollback |
| `tests/integration/replication-recovery.test.ts` | crash, restart, temp cleanup |
| `tests/e2e/replication.spec.ts` | happy path, re-entry, promotion, blocked actions |
| `src/renderer/src/test/replication-fixtures.ts` | component fixtures |

## 9. Acceptance criteria matrix

| ID | Criterion | Level | Evidence |
|---|---|---|---|
| R-01 | Fresh catalogs migrate to schema 7 | Integration | migration test |
| R-02 | Existing schema 6 catalogs migrate without losing files, dates, hashes, or coverage | Integration | migration/backfill test |
| R-03 | `archive_identity` has one stable `catalog_id` and `role = source` for existing archives | Integration | catalog repository test |
| R-04 | `files.source_membership` defaults/backfills to `source` | Integration | migration test |
| R-05 | Replica and run tables enforce status, path, and uniqueness constraints | Integration | repository tests |
| R-06 | At most one active run per source is enforced | Integration | unique-index/trigger test |
| R-07 | Hash records store source size and modified time; missing values force rehash | Unit/integration | source-hash test |
| R-08 | A destination catalog can be opened while the source catalog stays open | Integration | catalog-registry test |
| R-09 | The source catalog cannot be opened as a destination | Integration | catalog-registry test |
| R-10 | Duplicate catalog paths are rejected | Integration | catalog-registry test |
| R-11 | Destination is identified by volume ID plus marker `destination_id` | Integration | registration test |
| R-12 | Two identical drives are not merged by volume ID collision | Integration | identity test |
| R-13 | Same-volume or overlapping source/destination roots are hard-rejected | Unit/integration | path-policy test |
| R-14 | Destination root subfolder is stored relative and survives letter changes | Integration | registration test |
| R-14a | Destination library resolves files through `relative_path` after a letter change | Integration | destination-library test |
| R-15 | Missing marker adoption still works | Integration | adoption test |
| R-16 | Adoption matches path/size, unique name/size, then unique hash | Integration | adoption test |
| R-17 | First-adoption different hash is a conflict and is never overwritten | Integration | adoption test |
| R-18 | Prior verified stale copy is replaceable only after approval | Integration | replacement test |
| R-19 | Destination changed or missing file is re-verified before coverage | Integration | adoption test |
| R-20 | Ambiguous file is reported, never guessed | Integration | adoption test |
| R-21 | Only-on-drive extra is visible, never coverage, never copied/deleted | Integration | orphan test |
| R-22 | Source-missing replica is separate and offers reveal/open only; no source write in the first release | Integration/component | destination-files test |
| R-23 | Symlink/junction/reparse escape is skipped or rejected | Unit/integration | path-policy test |
| R-24 | Destination local catalog is reused or created once | Integration | destination-library test |
| R-24a | Adoption progress is visible; pause, resume, and restart recover the session | Integration/component | adoption-controls test |
| R-25 | Source index is written, timestamped, and readable without the source | Integration | source-index test |
| R-26 | Marker/source-index write failure is a warning, not a backup failure | Integration | failure test |
| R-27 | Union coverage counts each source file once | Unit/integration | coverage test |
| R-28 | Intentional full-copy overlap is labelled separately | Unit/integration | coverage test |
| R-29 | Offline coverage is last-known and qualified | Unit/integration | coverage test |
| R-30 | Retired/lost coverage is excluded from active coverage | Unit/integration | coverage test |
| R-31 | Source-missing and orphan files do not count as current coverage | Unit/integration | coverage test |
| R-32 | Coverage labels name full copy, partial drives, and all destinations | Component | overview/plan tests |
| R-33 | No 100% all-destination claim when no full copy exists | Component/integration | plan tests |
| R-34 | Plan covers the entire present source archive, no file selection | Unit/integration | plan test |
| R-35 | Oldest-first order; equal dates by path; undated last | Unit | chronology test |
| R-36 | Partial destinations fill in priority order and stop at allocation | Unit | planner test |
| R-37 | No source file goes to two partial destinations | Unit/integration | planner/copy test |
| R-38 | Full copy receives every source file independently | Unit/integration | planner/copy test |
| R-39 | Full copy and partial jobs can each be absent or both present | Unit/component | plan tests |
| R-40 | Completed full copy is excluded from default later runs | Integration | run-shape test |
| R-41 | Offline earlier destination keeps its range; later destinations do not steal it | Unit/integration | planner test |
| R-42 | Connected-drives-only mode is advanced, off by default, and warns | Component | plan test |
| R-43 | Exact remainder count, bytes, and starting date are reported | Unit/integration | plan test |
| R-44 | Full-copy shortfall is exact; default blocks; explicit partial fallback allowed | Unit/component | capacity test |
| R-45 | Incompatible file tries later destinations and reports unused capacity | Unit | planner test |
| R-46 | No destinations shows add-destination state and disables Start | Component | overview test |
| R-47 | All destinations offline keeps plan readable but disables Start | Component | plan test |
| R-48 | Stale replacement reserve use is shown and keeps 1 GiB free | Unit/integration | capacity/replacement test |
| R-49 | New copies never consume the reserve | Unit/integration | capacity/copy test |
| R-50 | Plan hash changes when source or destination inputs change | Unit | plan hash test |
| R-51 | Start run creates one run and opens the run route | Integration/E2E | run test |
| R-52 | Second Start opens the active run instead of creating another | Integration/E2E | run test |
| R-53 | Pause finishes the current file and persists progress | Integration | run-controls test |
| R-54 | Resume continues without recopying verified files | Integration | run-controls test |
| R-55 | Stop after current file ends in `stopped` and keeps verified files | Integration | run-controls test |
| R-56 | App shutdown marks the run `interrupted`; restart offers resume | Integration | recovery test |
| R-57 | Every screen can reach the run via chip/banner | Component/E2E | shell/run tests |
| R-58 | Plan and destination edits are locked while running; reason is shown | Component | plan/destination tests |
| R-59 | Pause unlocks plan/destination edits | Component/integration | paused-state test |
| R-60 | Replan increments `planRevision` and appends an event | Integration | run/replan test |
| R-61 | Verified files are never moved or recopied by replan | Integration | run/replan test |
| R-62 | Adding a destination during a run is queued for the next plan | Integration/component | add-drawer test |
| R-63 | Promotion is blocked while running or paused | Component/integration | promotion test |
| R-64 | Source switching is blocked while running or paused | Integration/component | switch-guard test |
| R-65 | Scan/validation and replication cannot run together | Integration | workload test |
| R-66 | Copy writes to a temp file, hashes, then renames | Unit/integration | copier test |
| R-67 | Source change during copy discards temp and retries once | Integration | fault test |
| R-68 | Source hash unknown uses size/mtime and streamed hash | Integration | copier test |
| R-69 | Hash mismatch discards temp and marks failed | Integration | copier test |
| R-70 | Crash mid-copy leaves no partial file counted; temp is cleaned | Integration | recovery test |
| R-71 | Disk full pauses partial destination and marks full copy incomplete | Integration | fault test |
| R-72 | Locked/permission-denied file retries, then fails without killing run | Integration | fault test |
| R-73 | Destination/source disconnect pauses safely; no substituted drive | Integration | fault test |
| R-74 | Destination write outside root or via symlink is rejected | Unit/integration | writer/path test |
| R-75 | Destination local library updates are derived; failure does not invalidate backup | Integration | destination-library test |
| R-76 | Copied thumbnail cache is reused only when source hash/version matches | Integration | cache test |
| R-77 | Full copy completes only with zero stale/missing/conflict/failed/remainder | Integration | full-copy test |
| R-78 | Full copy out of space becomes incomplete and does not spill | Integration | full-copy failure test |
| R-79 | Source growth degrades full copy to incomplete with shortfall | Integration | growth test |
| R-80 | Promotion requires complete full copy, connected/confirmed identity, no active work | Integration | preflight test |
| R-81 | Promotion preserves `catalog_id`, dates, overrides, duplicates, coverage | Integration | promotion test |
| R-82 | Promotion rebases source root and keeps `source_relative_path` stable | Integration | promotion test |
| R-83 | Old source becomes a demoted destination; 1 TB keep/retire applies | Integration | promotion test |
| R-84 | Promotion rollback works before first change; refused after | Integration | promotion test |
| R-85 | Promotion merge failure restores snapshots | Integration | promotion failure test |
| R-86 | Destination-only files stay out of promoted source; remain local | Integration | promotion extras test |
| R-87 | Active source cannot be registered as a destination in this release | Integration/component | dedicated-destination test |
| R-88 | Destination-scoped media resolves only destination file IDs | Unit/integration | media parser test |
| R-89 | All destination writes are confined to the allowlisted writer | Static/security | read-only guard test |
| R-90 | No source file content or metadata is modified | Integration/E2E | hash-before/after test |
| R-91 | Source-missing UI offers reveal/open only; no restore-to-source IPC exists | Static/component | IPC/channel test |

## 10. Failure and edge-case matrix

| Scenario | Expected behavior | Test |
|---|---|---|
| Destination root overlaps source root | Reject registration before writing | path-policy unit |
| Destination volume equals source volume | Reject with clear error | registration integration |
| Identical drives, same volume ID | Marker `destination_id` disambiguates; no coverage merge | identity integration |
| Destination marker missing/corrupt | Prompt for confirmation or create a new marker; adoption still works | marker integration |
| Destination root contains symlink/junction | Skip/reject; never follow outside root | writer/path unit |
| Destination path collides case-insensitively | Report collision; do not overwrite | writer integration |
| Destination path is a directory | Mark conflict/incompatible; do not overwrite | writer integration |
| FAT32 file too large | Mark incompatible; try later destination; report | planner unit |
| Path too long | Mark incompatible; report | planner unit |
| Destination full during partial copy | Pause destination, replan remaining files to later partial destinations | fault integration |
| Destination full during full copy | Mark incomplete; do not spill | fault integration |
| Free space below reserve | Stop assigning/copying to that destination | capacity unit |
| Stale replacement needs peak space | Use reserve only up to 1 GiB floor; warn; block if impossible | replacement integration |
| Source changes before copy | Rehash/recheck; skip or mark stale | copier integration |
| Source changes during copy | Discard temp; retry once; mark stale | copier integration |
| Destination changes during copy | Discard temp; mark stale/conflict; no overwrite | copier integration |
| Source or destination disconnect | Pause; discard temp; resume on same identity | fault integration |
| Different volume at same drive letter | Refuse; never substitute | drive-availability integration |
| App crash during adoption | Adoption marked interrupted; restart offers resume; no destination file is modified | recovery integration |
| App crash mid-copy | Temp cleaned on next connection; `copied` row verified or recopied | recovery integration |
| SQLite busy/locked | Retry with backoff; fail run cleanly if persistent | worker/service test |
| Source catalog missing/corrupt | Block planning/copy; do not invent coverage | service test |
| Destination catalog lost | Rebuild by scan; source coverage unaffected | destination-library integration |
| Source index lost/corrupt | Rebuild from source catalog; warn | source-index test |
| Promotion merge fails | Restore snapshots; old source stays active | promotion fault test |
| Promotion rollback after first change | Refuse; explain merge-back is unavailable | promotion test |
| Add destination during run | Queue for next plan; active run unchanged | service/component test |
| Start a second run | Open active run; no second row | run service test |
| Switch source during run | Block until stop/finish | workload/switch test |
| Scan starts during run | Block with workload conflict | workload test |
| Run starts during scan/validation | Block with workload conflict | workload test |

## 11. Quality gates and definition of done

The existing `npm run check` remains mandatory:

- typecheck
- ESLint with complexity, nesting, parameter, and file-size limits
- Prettier
- file-size check
- read-only guard
- dependency-cruiser
- knip

Additional gates:

- `npm run test:coverage` with the existing 80/75 floors and 90% for shared and
  DB code. Add a 90% branch floor for
  `src/main/modules/replication/domain/**` and
  `src/main/db/repositories/replication-*`.
- `npm run test:e2e` includes the replication happy path, run re-entry, and
  promotion path.
- `npm run check:full` stays the release gate.
- The read-only guard allowlist has exactly one replication file:
  `replication/infrastructure/destination-writer.ts`.
- `docs/release/security-review.md`, README, and release acceptance state the
  revised guarantee: source archive read-only, destination writes only to
  registered destination roots after explicit confirmation.
- No new runtime dependency is required. Use Node `fs`, `crypto`, `stream`,
  `zod`, and `better-sqlite3` already in the project.

Definition of done for the feature:

1. All acceptance rows R-01..R-90 are automated-green or explicitly marked
   manual with a completed drill.
2. The three delivery slices are merged behind the replication routes.
3. A real source + two destination drill passes, including pause/resume and
   restart.
4. A full-copy + promotion drill passes on a clean Windows VM.
5. The source archive is byte-identical before and after every drill.
6. Security review and product docs are updated.
7. No new file exceeds the 400-line hard limit; no new lint exception is added.

## 12. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Catalog registry changes touch every DB handler | High regression risk | Land registry first with source-only behavior unchanged; run full suite before adding destination handlers |
| Promotion catalog merge is the most complex code | Data loss or wrong active source | Separate slice, snapshots, merge failure tests, rollback test, dedicated destination only |
| Destination writer broadens the read-only surface | Security regression | Single adapter, path policy, runtime tests, static guard, security review |
| Progress writes flood the DB worker | Slow copy, UI lag | Batch progress; run events only on state changes; performance test |
| Plan recomputation is expensive | Slow start/resume | Compact source row query; 200k performance target; persist summary, not every item |
| Windows path/case/symlink behavior | Wrong file matching or overwrite | Normalized path keys, lstat/realpath checks, collision tests |
| Destination local catalog and media scope | Large secondary feature | Reuse catalog schema; add destination-scoped media in Slice 2; keep source media unchanged |
| Test flakiness from real filesystem timing | Unreliable CI | Deterministic temp fixtures, polling helpers, fault injection at interfaces, no fixed sleeps |
| Scope creep from dual-role, sidecars, selected second copies | Delays release | Explicitly deferred in §16 of the spec; dedicated destinations only |
| Existing tests hard-code schema 6 | Broad test churn | Update fixtures once in Slice 1; use `CATALOG_SCHEMA_VERSION` in tests |

## 13. Deferred work

Not part of the first replication release:

- dual-role active source + destination;
- opening a destination as a separate source-like workspace; the first release
  browses it through destination detail and destination-scoped media;
- promotion from a dual-role drive;
- selected second copies on partial destinations;
- sidecar grouping;
- importing destination-only files;
- restore into the source archive; the first release offers reveal/open only;
- batch restore;
- merge-back after the promotion rollback safe point;
- scheduled deep verification;
- cloud/network destinations.
