# Replication contract

Status: implemented. TypeScript and Zod definitions live in
`src/shared/contracts/replication/`, `src/shared/contracts/channels.ts`, and
`src/preload/index.ts`.

The behavior is defined in
[`../product/partial-backups.md`](../product/partial-backups.md). The module
layout and test plan are in
[`../archive/replication-implementation-plan.md`](../archive/replication-implementation-plan.md).

## Contract layout

```text
src/shared/contracts/replication/
  types.ts           public destination, plan, and shared contracts
  run-types.ts       run state, scopes, order entries, start params
  promotion-types.ts promotion state, verification, apply, and rollback params
  channels.ts        IPC channel names
  api.ts             ReplicationApi namespace exposed by preload
```

The preload bridge exposes a nested namespace:

```ts
window.memoryLane.replication.getOverview()
window.memoryLane.replication.startRun({ scope: "all_connected" })
```

Existing v0.1 flat methods stay unchanged. Replication does not add dozens of
flat methods to `MemoryLaneApi`.

## IPC methods

| Channel | Method | Params | Result |
|---|---|---|---|
| `replication:get-overview` | `getOverview` | none | `ReplicationOverview` |
| `replication:list-destination-candidates` | `listDestinationCandidates` | none | `DestinationCandidate[]` |
| `replication:list-destinations` | `listDestinations` | none | `DestinationSummary[]` |
| `replication:get-destination` | `getDestination` | `{ destinationId }` | `DestinationDetail` |
| `replication:register-destination` | `registerDestination` | `RegisterDestinationParams` | `DestinationDetail` |
| `replication:get-adoption-state` | `getAdoptionState` | `{ destinationId }` | `AdoptionState` |
| `replication:start-adoption` | `startAdoption` | `{ destinationId }` | `AdoptionState` |
| `replication:pause-adoption` | `pauseAdoption` | `{ destinationId }` | `AdoptionState` |
| `replication:resume-adoption` | `resumeAdoption` | `{ destinationId }` | `AdoptionState` |
| `replication:update-destination` | `updateDestination` | `UpdateDestinationParams` | `DestinationDetail` |
| `replication:get-plan` | `getPlan` | none | `ReplicationPlan` |
| `replication:get-coverage` | `getCoverage` | none | `CoverageSummary` |
| `replication:get-run-state` | `getRunState` | none | `ReplicationRunState \| null` |
| `replication:start-run` | `startRun` | `StartRunParams` | `ReplicationRunState` |
| `replication:pause-run` | `pauseRun` | none | `ReplicationRunState` |
| `replication:resume-run` | `resumeRun` | none | `ReplicationRunState` |
| `replication:request-stop` | `requestStop` | none | `ReplicationRunState` |
| `replication:replan` | `replan` | none | `ReplicationRunState \| null` |
| `replication:get-run-events` | `getRunEvents` | `{ runId, cursor? }` | `RunEventsPage` |
| `replication:get-promotion` | `getPromotion` | `{ destinationId }` | `PromotionState` |
| `replication:verify-promotion` | `verifyPromotion` | `{ destinationId, deep? }` | `PromotionState` |
| `replication:apply-promotion` | `applyPromotion` | `ApplyPromotionParams` | `PromotionState` |
| `replication:rollback-promotion` | `rollbackPromotion` | `{ promotionId, destinationId }` | `PromotionState` |

Not yet exposed: destination file browsing/history and reveal/open destination
items. Re-adoption reuses `startAdoption`. The implemented API covers adoption,
planning, run control, destination detail/media, and promotion.

There is deliberately no restore-to-source method in the first release. Source
files are never written. Source-missing replicas are reported as coverage gaps;
destination reveal/open is deferred.

All params are Zod-parsed in the main process. All handlers use the existing
trusted-sender check and `IpcResult<T>` envelope.

There are no push events. The renderer polls `getRunState` while a run is active
or paused; overview and destination queries use normal TanStack Query caching.

## Core state shapes

```ts
type DestinationGoal = "extend_coverage" | "full_copy";
type DestinationRecordStatus = "active" | "retired" | "lost";
type DestinationConnection = "connected" | "offline" | "retired" | "lost";
type FullCopyStatus = "not_applicable" | "in_progress" | "complete" | "incomplete";

type RunStatus =
  | "planned"
  | "running"
  | "paused"
  | "stopping"
  | "completed"
  | "stopped"
  | "failed"
  | "interrupted";

type RunScope = "all_connected" | "full_copy_only" | "partial_only";
type ReplicaStatus =
  | "discovered"
  | "copied"
  | "verified"
  | "stale"
  | "missing"
  | "conflict"
  | "failed";
```

`active` in run rules means `running`, `paused`, or `stopping`. `completed`
means the plan finished naturally. `stopped` means the user stopped after the
current file. `interrupted` means the app closed or the run was stopped before a
clean finish; it is resumable. `getRunState` returns `null` when the source has
no run at all.

`AdoptionState` contains:

- destination ID, status (`idle | scanning | hashing | paused | complete |
  failed | interrupted`), started/finished times;
- scanned, matched, verified, conflict, stale, ambiguous, extra, and unreadable
  counters;
- current file and ETA;
- pause/resume/stop capabilities.

`ReplicationOverview` contains:

- source archive identity, label, file count, bytes, coverage as-of;
- partial coverage today, partial remainder today, full-copy plan;
- destination summaries;
- one attention aggregate with only-on-drive and source-missing counts;
- active or paused run summary, if any.

The first read after opening a large cold catalog may exceed the normal request
timeout. The overview uses the long maintenance timeout for its aggregate
source and coverage reads. If a transient read still fails, the page keeps the
loading state and offers Retry.

`DestinationSummary` contains:

- destination ID, label, mount, filesystem, goal, connection state;
- capacity, verified bytes, available safe bytes, last-known qualifier;
- fill order for partial destinations;
- one attention count and link target;
- full-copy status and shortfall when applicable;
- identity confidence only when not confirmed.

The full destination detail adds identity, root, layout, allocation, reserve,
coverage map, local-library status, source-index timestamp, health counts, and
maintenance actions.

`ReplicationPlan` contains:

- source scope: file count, bytes, undated count;
- full-copy jobs and partial jobs that exist;
- per-destination adopted bytes, new files/bytes, new-file date range, free
  after, reserve, and a link target for the existing date map;
- replacement summary and reserve warning;
- projected coverage with explicit scope labels;
- partial remainder and full-copy shortfall;
- warnings and blocking reasons;
- `planHash` — a stable hash of source file IDs and destination state used to
  detect drift between review and start.

`ReplicationRunState` contains:

- run ID, status, scope, plan revision, plan hash;
- current destination and file;
- progress by files and bytes for the run and the active destination;
- run order entries with active/pending/offline states;
- waiting offline ranges;
- speed and ETA;
- verified, copied, failed, stale, skipped, and remainder counters;
- error list with retryable flags;
- a `capabilities` object:

`plannedFiles` and `plannedBytes` are the run's total work and are never smaller
than `verified + failed + stale + remainder`. `failedFiles` counts distinct
failed files, not retry attempts. A completed run with failed files is labelled
**Completed with errors**. Copy failures use a specific code:
`SOURCE_PERMISSION_DENIED`, `SOURCE_BUSY`, `SOURCE_MISSING`, `SOURCE_IO_ERROR`,
or `COPY_FAILED`.

```ts
interface ReplicationCapabilities {
  canPause: boolean;
  canResume: boolean;
  canStop: boolean;
  canEditPlan: boolean;
  canAddDestination: boolean;
  canPromote: boolean;
  canSwitchSource: boolean;
  lockedReason: string | null;
}
```

The renderer renders controls from `capabilities`; it does not infer lock state
from run status.

`RunEvent` is append-only:

```ts
type RunEventType =
  | "started"
  | "paused"
  | "resumed"
  | "stop_requested"
  | "plan_changed"
  | "destination_added"
  | "completed"
  | "stopped"
  | "failed"
  | "interrupted";
```

Events store `runId`, `at`, `type`, `planRevision`, and a short note. They never
contain file contents.

## Run state machine

```text
planned -> running
running -> paused | stopping | completed | failed | interrupted
paused -> running | stopping | failed | interrupted
stopping -> stopped | failed | interrupted
interrupted -> running (resume) | stopping
completed, stopped, failed -> terminal
```

Rules:

- At most one row per source catalog may have status `running`, `paused`, or
  `stopping`, enforced by a partial unique index or a transaction.
- Starting a run requires no active scan or validation. Starting a scan or
  validation requires no active run.
- Starting when an active run exists returns the active run; it never creates a
  second one.
- Pausing sets a gate. The executor finishes the current file, persists the
  result, and stops before scheduling the next file.
- Stopping sets `stopping`; after the current file the run becomes `stopped`.
- A paused run may change the plan. The plan is recomputed from current
  coverage, `planRevision` increments, and a `plan_changed` event is appended.
- Verified files are never recopied or moved by a replan.
- A run interrupted by app shutdown becomes `interrupted` on the next catalog
  open. It is resumable; the app never starts a run automatically.
- Switching the source archive is rejected while a run is running or paused.
- Promotion requires no active run, including paused or interrupted.

## Run scopes and full copies

`StartRunParams.scope` selects work from the current execution plan:

- `all_connected` runs the full-copy job first, then partial destinations in
  priority order.
- `full_copy_only` runs only the full-copy destination.
- `partial_only` runs only partial destinations.

A full copy is complete only when every present source file is verified on the
destination with zero stale, missing, conflict, failed, or remainder files.
A shortfall blocks the full-copy goal by default; it is never spilled to partial
destinations. `full_copy_status` and its shortfall are refreshed when plans load
and after runs, so source growth degrades a full copy to `incomplete` without
deleting files.

Copy verification is single-pass: SHA-256 is computed while the source streams
to the temporary destination file, compared with the trusted source hash when
one exists, and the final file size is checked after rename. The temporary file
is not read back inline. Deep verification re-reads destination data later and
is the path that catches post-write corruption or bit rot.

## Promotion contract

`PromotionState` contains:

- promotion ID, destination identity and label, source label and volume;
- status (`planned | verifying | verified | completed | failed | rolled_back`);
- connected and identity-confirmed flags;
- source/verified/shortfall/stale/missing/conflict/failed/only-on-drive counts;
- old-source capacity and whether it still fits a full copy;
- active partial destinations eligible for keep/retire;
- `canPromote` and `blockedReason`;
- `canRollback` and `rollbackBlockedReason`;
- `newCatalog` after a completed promotion and the previous source volume for
  opening the restored archive.

`ApplyPromotionParams` contains:

```ts
interface ApplyPromotionParams {
  destinationId: string;
  deepVerify: boolean;
  oldSourceFate: "full_copy" | "extend_coverage" | "retire";
  partialFates: Array<{ destinationId: string; keep: boolean }>;
  confirm: true;
}
```

Promotion preflight requires a complete full copy, a connected destination, a
confirmed identity, zero shortfall, no active run, and no scan or validation.
Apply writes pre-promotion snapshots, merges catalog metadata, preserves
`catalog_id`, dates, overrides, duplicate memberships, hashes, and replica
coverage, demotes the old source, and registers it as a destination with the
chosen fate. Rollback is allowed only before the first change on the new source;
the rollback window is closed by scan, validation, date edits, adoption,
destination changes, and backup runs.

## Destination persistence contract

Catalog migration 7 adds:

- `archive_identity` — stable `catalog_id`, role, source relationship, source
  root, active source volume, promotion timestamps;
- `files.source_membership` — `source | local_only`, backfilled to `source`;
- `hashes.source_size_at_hash`, `hashes.source_modified_at_fs_at_hash`;
- `replica_destinations`;
- `replica_files`;
- `replica_orphans`;
- `replication_adoptions`;
- `replication_runs`;
- `replication_run_events`;
- `source_promotions`;
- indexes and uniqueness constraints, including the single-active-run rule.

Catalog migration 8 adds `quick_hashes` for sampled large-file fingerprints and
a `files(size, state)` index. Quick fingerprints are never coverage evidence.
Replication hashes a source file fully on demand when adoption or a copy needs a
source hash, and a full hash clears the matching quick fingerprint. Existing
full hashes from older catalogs remain valid and are not rewritten.

App migration 3 replaces the unused `backup_destinations` table with a
`replication_destination_cache` table. The cache holds volume ID, destination
ID, catalog ID, label, root relative, and last-seen time. It is never the
authority for coverage.

Destination marker:

```text
<destination root>/.memorylane/replicas/<catalog-id>.json
```

The marker is advisory. It contains `schemaVersion`, `catalogId`,
`destinationId`, `sourceLabel`, `sourceVolumeId`, `rootRelative`,
`copyRootRelative`, `replicaGoal`, `replicaLayout`, `localCatalogId`,
`localCatalogRelative`, `sourceIndexRelative`, and `updatedAt`.

Source index:

```text
<destination root>/.memorylane/replicas/<catalog-id>/index.db
```

The source index is a compact read-only SQLite snapshot with a schema version,
source catalog ID, source root, generated timestamp, and one row per source file
with relative path, size, hash when known, resolved date, media class, and local
verification state. It contains no thumbnails and is never the authority for
coverage. It is written in a transaction with its journal checkpointed before
close so the destination does not keep WAL sidecars.

## Destination catalog contract

The first release requires a dedicated destination. A drive that is currently an
active source archive is rejected as a destination; dual-role support is
deferred.

A destination catalog uses the same catalog schema and migrations as a source
catalog. Its `archive_identity.role` is `destination_library` for a dedicated
local catalog, or `demoted_source` for a former source that is now a
destination. In both cases it is not an active source, and its
`source_catalog_id` points at the current source archive.

Files copied from the source are stored as local library rows with
`source_membership = local_only` and a portable `relative_path`. Destination
library queries resolve `relative_path` against the current destination root;
the absolute `path` column is a hint and is never the authority. On promotion,
mapped full-copy files become `source` rows. Destination-only files remain
`local_only` forever unless a separate import feature is added.

Destination library methods are separate from the source library methods. Local
library data comes from the destination catalog. Only-on-drive data comes from
the source catalog's `replica_orphans`; source-missing data comes from the
source catalog's `replica_files` joined to missing source files. The renderer
never joins two catalogs itself.

| Method | Purpose |
|---|---|
| `destinationLibrary.getContext` | Destination catalog and cache paths |
| `destinationLibrary.resolveMedia` | Resolve a destination file ID for media |
| `destinationLibrary.resolveThumbnail` | Resolve a destination thumbnail |
| `destinationLibrary.saveThumbnail` | Persist thumbnail cache state |
| `destinationLibrary.resolvePreview` | Resolve a HEIC/preview for a destination file |
| `destinationLibrary.savePreview` | Persist preview cache state |
| `replication.upsertDestinationLibrary` | Batch insert/update after adoption |
| `replication.saveDestinationLibraryFile` | Insert/update one copied file |
| `replication.getDestinationLibraryStats` | Local library counts for destination detail |

Destination file browsing/history APIs are not exposed in the current release.
The source catalog is never used to answer destination-library queries.

## Media URLs

Source URLs are unchanged:

```text
ml-media://thumbnail/<fileId>
ml-media://media/<fileId>
```

Destination URLs add a destination scope:

```text
ml-media://destination/<destinationId>/thumbnail/<fileId>
ml-media://destination/<destinationId>/media/<fileId>
```

`parseMediaUrl` returns a discriminated union with `scope: "source" |
"destination"`. The media handler resolves source URLs through
`library.resolve*` and destination URLs through `destinationLibrary.resolve*`.
Destination IDs are not paths. The DB worker resolves the destination catalog;
the renderer cannot request an arbitrary file path.

## Error codes

Add to `APP_ERROR_CODES` and the Zod enum:

```text
REPLICATION_RUN_ACTIVE
REPLICATION_RUN_NOT_FOUND
REPLICATION_STATE_INVALID
WORKLOAD_CONFLICT
DESTINATION_NOT_FOUND
DESTINATION_OVERLAP
DESTINATION_FULL
DESTINATION_WRITE_FAILED
DESTINATION_DISCONNECTED
SOURCE_CHANGED
SOURCE_DISCONNECTED
CONFLICT_REVIEW_REQUIRED
PROMOTION_BLOCKED
PROMOTION_FAILED
```

Errors returned to the renderer include a stable code, a user-readable message,
and optional details such as destination ID, file ID, run ID, and retryability.
The UI maps codes to actions; it does not parse messages.

## Persistence and recovery rules

- The DB worker is the only SQLite writer for the source catalog, destination
  catalogs, and source indexes.
- The catalog registry rejects duplicate paths and source-as-destination.
- Destination catalogs are opened lazily and closed on disconnect or app
  shutdown.
- A destination catalog lock is separate from the source catalog lock.
- The source index is written after adoption and after a successful run. A write
  failure is a warning, not a backup failure.
- Adoption has its own resumable session. App shutdown marks it `interrupted`;
  reopening the destination offers resume. Adoption never writes destination
  archive files; it only reads them and updates the destination catalog/source
  index.
- The source catalog is authoritative. If a source-catalog write fails, stop the
  run and do not count the file; a destination file already renamed is
  re-adopted on the next connection.
- Destination catalog and source-index writes are derived. A failure is a
  warning and never invalidates a verified replica.
- A temporary destination file is named `.memorylane-tmp-*` and is cleaned on
  the next connection. It is never adopted, counted, or shown as a destination
  file.
- A `copied` row is verified on restart. It is never treated as coverage until
  the hash matches.
- A running run is marked `interrupted` when the catalog reopens after an
  unclean shutdown.
- Promotion snapshots are written before any catalog merge. A merge failure
  restores the snapshots and leaves the old source active.
