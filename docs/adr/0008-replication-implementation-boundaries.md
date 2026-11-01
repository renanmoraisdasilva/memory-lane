# 0008 - Replication implementation boundaries

- Status: Accepted
- Date: 2026-11-01

Detailed feature behavior:
[`../product/partial-backups.md`](../product/partial-backups.md).
Implementation plan and test matrix:
[`../product/replication-implementation-plan.md`](../product/replication-implementation-plan.md).
IPC and worker contracts:
[`../contracts/replication.md`](../contracts/replication.md).

## Context

Adoption-first replication adds three things the current application has never
done:

- it writes files to destination drives;
- it keeps a local catalog on each destination while the source catalog is open;
- it runs a long, pausable operation that must coordinate with scan, validation,
  drive switching, and application shutdown.

The current code has one open source catalog in the DB worker, a single
`CatalogSession`, a read-only guard that rejects filesystem writes outside a
small allowlist, and no coordination between scan and validation. Extending the
existing modules in place would hide these cross-cutting decisions inside
feature code.

## Decision

### Process boundaries

- The **main process** owns planning orchestration, filesystem traversal,
  copying, hashing, pause/stop gates, and drive availability checks.
- The **DB worker** remains the only SQLite writer. It owns the source catalog,
  every open destination catalog, the compact source index, and the app cache.
- The renderer receives only typed, intended operations. It never receives
  paths for copying or direct database access.

### Catalog ownership

- Extract the current `CatalogSession` from `db-worker-handler.ts` into a
  **catalog registry**.
- The registry holds one active source catalog and zero or more destination
  catalogs keyed by `destinationId` and normalized catalog path.
- Opening the same path twice, or opening the source catalog as a destination,
  is rejected.
- Destination catalogs use the same versioned schema and migration runner as the
  source catalog.
- A destination catalog is created lazily when it is absent and reopened on
  reconnect.
- The source index is a separate SQLite database written by the DB worker under
  the destination's `.memorylane/replicas/<catalog-id>/` folder.

### First-release scope

- The first replication release accepts **dedicated destinations**. A drive that
  is currently an active source archive cannot be registered as a destination.
- The role model and `source_membership` columns remain capable of dual-role
  support later, but dual-role registration, browsing, and promotion are
  deferred.
- This avoids merging two active source catalogs in the first release.

### Workload coordination

- Add a main-process **workload coordinator** that grants one exclusive heavy
  workload at a time: scan, validation, or replication.
- Browsing, viewing, and reveal/open remain available while a heavy workload is
  active.
- Starting a backup while a scan or validation is active is rejected with a
  clear error. Starting a scan or validation while a backup is active is
  rejected the same way.
- Switching source archives while a run is running or paused is blocked until
  the run is finished or stopped.

### Run model

- One active run per source archive. Active means `running`, `paused`, or
  `stopping`.
- A second Start backup request opens the active run instead of starting a new
  one.
- The plan is a deterministic function of source files, destination state, and
  policies. It is recomputed at start and after pause; individual plan items are
  not persisted in the first release.
- The run stores a `plan_hash`, `plan_revision`, summary counters, and append-only
  events. This keeps the plan review and execution aligned without a large plan
  table.
- Run states are `planned | running | paused | stopping | completed | stopped |
  failed | interrupted`.
- Application shutdown pauses/interrupts the run and records the state before the
  DB worker closes.

### Destination writes

- All destination filesystem writes go through one infrastructure adapter,
  `replication/infrastructure/destination-writer.ts`. That includes the advisory
  marker and temporary copy files.
- The adapter accepts only a validated destination root, a validated relative
  path, and an operation (`mkdir`, `writeText`, `writeTemp`, `rename`,
  `removeTemp`).
- It rejects the source root, overlapping roots, unregistered roots, `..`
  escapes, symlink/reparse escapes, and paths outside the destination root.
- The static read-only guard adds only this adapter to the existing
  cache/lock/backup allowlist. The rest of the main process remains unable to
  write to archive or destination files.
- Source files are always opened read-only.

### Contracts and routes

- Replication uses a namespaced `replication` API on the preload bridge instead
  of adding dozens of flat methods.
- Replication contracts live under `src/shared/contracts/replication/`.
- Stable routes are `/backup`, `/backup/plan`, `/backup/run`,
  `/backup/destinations/:destinationId`, and
  `/backup/promote/:destinationId`.
- Destination media uses a destination-scoped `ml-media` URL, resolved through
  the destination catalog registry. Source media URLs remain unchanged.

## Alternatives

- **Put replication SQL inside the main process.** Rejected: it breaks the
  single-writer rule and the existing DB worker boundary.
- **Keep one catalog session and close the source while updating a destination.**
  Rejected: coverage planning, media serving, and UI polling need the source
  catalog continuously.
- **Use JSON instead of destination SQLite catalogs.** Rejected: it duplicates
  library query, media, and cache logic and loses the existing schema/tests.
- **Persist every planned item.** Rejected for the first release: a deterministic
  planner plus a plan hash and summary is smaller, resumable, and auditable
  enough. Revisit only if plan recomputation exceeds the performance budget.
- **Allow scan, validation, and backup concurrently.** Rejected: they contend for
  the same source drive and catalog, and make failure/recovery states ambiguous.
- **Support dual-role in the first release.** Rejected: merging an active source
  catalog into a destination catalog is the riskiest part of promotion and
  deserves its own design and tests.
- **Let the renderer pass destination paths.** Rejected: paths stay in the main
  process and DB worker; the renderer uses IDs.

## Consequences

- The DB worker needs a multi-catalog registry and destination-scoped library
  queries. This is the largest structural change.
- The main process needs a new workload coordinator and a narrow destination
  write adapter. Both need tests before copy code is added.
- The read-only guarantee changes from "the app never writes archive files" to
  "the app writes only to registered destination roots, never the source." The
  security review, README, and release acceptance must say this explicitly.
- The static guard must be tightened to catch directory creation and write-open
  APIs; the runtime destination-writer policy is the primary control.
- Destination browsing needs a destination-scoped media path; source media
  behavior remains unchanged.
- The first release cannot promote a drive that is currently an active source.
  That limitation is visible in the UI and spec.
- Existing schema-version assertions and fixtures must move from catalog schema 6
  to 7.
- The feature needs a multi-drive development fixture and E2E flow.
- Run recovery and promotion snapshots need integration tests before the UI is
  considered complete.
