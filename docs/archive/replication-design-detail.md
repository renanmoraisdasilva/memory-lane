# Replication design detail (archived)

Status: archived detail extracted from the original `partial-backups.md`
design. Current behavior lives in
[`../product/partial-backups.md`](../product/partial-backups.md). The IPC and
worker contract is [`../contracts/replication.md`](../contracts/replication.md).

Section numbers are preserved from the original design. References such as
§5.5a point to the current product document.

## 12. Data model

The source catalog is authoritative.

### 12.1 `archive_identity`

- `catalog_id` — stable UUID for the archive, independent of volume ID.
- `label` — user-facing archive or local-library label.
- `role` — `source | destination_library | demoted_source`.
- `previous_local_catalog_id` — the destination’s own catalog ID before it was
  merged into a promoted source catalog.
- `source_catalog_id` — for a destination library, the source archive’s
  `catalog_id`; null for a source.
- `source_label` — human-readable source label for a destination library.
- `source_root_relative` — the folder whose contents belong to the source
  archive, relative to the catalog root. Empty means the catalog root.
- `library_scope` — `source_root | whole_catalog_root`. A catalog can serve as
  both a source archive and a local library for its whole drive.
- `active_source_volume_id` — the volume currently allowed to act as the active
  source for this `catalog_id`.
- `promoted_at`, `demoted_at` — promotion history.
- `last_indexed_at` — last local-library or source-index refresh.
- `created_at`.
- `schema_version`.

The app creates this row on first use if the catalog predates the feature. A
catalog with `role = source` is authoritative for its archive. A catalog with
`role = destination_library` describes the files physically on that drive and
may point to a source catalog. A `demoted_source` is not an active source; it is
kept for history and may still be updated as a local library/destination.

The catalog role describes the catalog’s authority. Backup-destination
relationships are stored separately in the source catalog’s
`replica_destinations`; they are not part of the role enum. A drive can be a
source for its own catalog and a destination for another archive at the same
time.

### 12.1a Catalog file membership

The catalog’s `files` table adds:

- `source_membership` — `source | local_only`.

`source` files belong to that catalog’s source archive. `local_only` files are
visible in the drive’s local library but are excluded from source coverage,
planning, and source archive views. This prevents backup copies or extras from
being mistaken for source files when a local library and a source archive share
one catalog. The source archive view and planning queries filter on
`source_membership = source`. The local library shows both.

### 12.2 `replica_destinations`

- `id`
- `destination_id` — random UUID written to the marker; survives hardware
  fingerprint changes and distinguishes identical drives.
- `volume_id`
- `volume_serial`
- `label`
- `root_relative` — destination root relative to the drive mount point; empty
  means the drive root.
- `copy_root_relative` — dedicated folder for new copies, relative to the
  destination root.
- `archive_folder_name` — stored folder name under `Memory Lane`.
- `replica_goal` — `extend_coverage | full_copy`.
- `replica_layout` — `dedicated | mirror_source`. `dedicated` is the default.
- `local_catalog_id` — the destination’s own library catalog ID, when it has
  one.
- `local_catalog_relative` — path to the destination’s local `catalog.db`,
  relative to the drive root. Never store an absolute path.
- `source_index_relative` — path to the compact source index, relative to the
  drive root.
- `source_index_updated_at`.
- `allocation_mode` — `all_safe | percent | fixed`.
- `allocation_percent` — 0–100, for `percent`.
- `allocation_bytes` — total replica bytes for `fixed`.
- `reserve_bytes`
- `priority`
- `status` — `active | retired | lost`.
- `identity_confidence` — `confirmed | probable | needs_confirmation`.
- `full_copy_status` — `not_applicable | complete | incomplete`.
- `full_copy_shortfall_bytes`, `full_copy_shortfall_files`.
- `last_full_copy_check_at`.
- `last_seen_at`
- `last_capacity_bytes`
- `last_free_bytes`
- `created_at`

### 12.3 `replica_files`

- `id`
- `replica_id`
- `file_id`
- `relative_path` — relative to the destination root. Compare case-insensitively
  and store the actual casing, matching the source catalog’s path behavior.
- `source_relative_path` — path relative to the source root. This is the
  stable matching key. It survives a source-root change, including promotion
  into the dedicated `Memory Lane\<archive>` folder.
- `size_bytes`
- `sha256` — nullable while `discovered`; required for `verified`.
- `status` — `discovered | copied | verified | stale | missing | conflict |
  failed`.
- `source_size_at_verify`
- `source_modified_at_fs_at_verify`
- `destination_size_at_verify`
- `destination_modified_at_fs_at_verify`
- `discovered_at`
- `copied_at`
- `verified_at`
- `last_checked_at`
- `last_error`
- `UNIQUE (replica_id, file_id)`
- `UNIQUE (replica_id, relative_path COLLATE NOCASE)`
- `UNIQUE (replica_id, source_relative_path COLLATE NOCASE)`
- `CHECK (status <> 'verified' OR sha256 IS NOT NULL)`

Verification is skipped only when both size and modified time still match the
stored values. Any mismatch forces a re-hash before coverage is trusted.

### 12.3a `replica_orphans`

Destination-only files are tracked separately so they can be shown without
being counted as coverage.

- `id`
- `replica_id`
- `relative_path` — relative to the destination root.
- `size_bytes`
- `sha256` — nullable while unreadable or unverified.
- `modified_at_fs`
- `classification` — `extra | previously_in_source | ambiguous | unreadable`.
- `matched_source_count` — number of source files the hash matched, when
  ambiguous.
- `status` — `present | missing`.
- `discovered_at`
- `last_checked_at`
- `last_error`
- `UNIQUE (replica_id, relative_path COLLATE NOCASE)`
- Index: `(replica_id, classification, status)`.

Source-missing replicas are **not** stored here. They remain normal
`replica_files` rows with `status = verified`, while the source file has
`state = missing`. The UI joins those rows to show “Source missing; backup copy
exists.”

`replica_orphans` is authoritative for the source catalog’s list of
destination-only files. The destination’s local catalog independently lists the
same files for browsing. A missing orphan row is not coverage and must never be
deleted automatically.

### 12.4 `replication_runs`

- `id`
- `started_at`
- `finished_at`
- `status` — `planned | running | paused | stopping | completed | stopped |
  failed | interrupted`.
- `plan_revision` — starts at 1; increments when a paused run’s plan changes.
- `plan_hash` — stable hash of source and destination inputs used for the review.
- `plan_updated_at`
- `paused_at`, `resumed_at`, `stop_requested_at`, `last_heartbeat_at`.
- `scope` — `entire_archive` in the first version.
- `goal` — `extend_coverage | full_copy | both`.
- `destination_snapshot` — JSON: destination IDs, priority, goal, allocation,
  free space at plan time.
- `planned_files`, `planned_bytes`
- `copied_files`, `copied_bytes`
- `verified_files`, `verified_bytes`
- `failed_files`, `failed_bytes`
- `stale_files`, `stale_bytes`
- `remainder_files`, `remainder_bytes`
- `full_copy_shortfall_files`, `full_copy_shortfall_bytes`
- `destination_only_files`, `destination_only_bytes`
- `source_missing_files`, `source_missing_bytes`
- `replacement_peak_bytes` — largest temporary space required for a replacement.
- `reserve_breach_used` — whether any replacement used the §5.5a exception.
- `promotion_id` — set when the run is part of a promotion.
- `error_message`

The plan itself is recomputed on resume. Persisting every planned item is not
required for the first version. `stopped` means the user stopped after the
current file; `interrupted` means the app closed or the run was stopped before a
clean finish. Both keep verified files and are resumable.

At most one row per source catalog may have status `running`, `paused`, or
`stopping`. Enforce this in the database or with a transaction that checks
before starting or resuming a run.

### 12.4a `source_promotions`

- `id`
- `catalog_id`
- `from_volume_id`
- `to_volume_id`
- `status` — `planned | verifying | verified | completed | failed | rolled_back`.
- `started_at`, `completed_at`, `rolled_back_at`.
- `from_source_root_relative`, `to_source_root_relative`.
- `source_snapshot_path`, `destination_snapshot_path`.
- `verified_files`, `verified_bytes`
- `shortfall_files`, `shortfall_bytes`
- `error_message`

Promotion records are append-only. The current active source is determined by
`archive_identity.active_source_volume_id`, not by the latest promotion row
alone.

### 12.4b `replication_run_events`

Append-only audit events for run state and plan changes:

- `id`
- `run_id`
- `at`
- `type` — `started | paused | resumed | stop_requested | plan_changed |
  destination_added | completed | stopped | failed | interrupted`.
- `plan_revision`
- `note`

Events are never edited or deleted. Run events are available through the
run-events API and the run screen.

### 12.5 Destination marker

Optional, advisory only:

```text
<drive root>/.memorylane/replicas/<catalog-id>.json
```

Example:

```json
{
  "schemaVersion": 1,
  "catalogId": "…",
  "destinationId": "…",
  "sourceLabel": "4TB Archive",
  "sourceVolumeId": "…",
  "rootRelative": "",
  "copyRootRelative": "Memory Lane/4TB Archive",
  "replicaGoal": "full_copy",
  "replicaLayout": "dedicated",
  "localCatalogId": "…",
  "localCatalogRelative": ".memorylane/catalog.db",
  "sourceIndexRelative": ".memorylane/replicas/…/index.db",
  "updatedAt": "2026-11-01T12:00:00Z"
}
```

It must not be the only copy of coverage data. The marker’s `catalogId` is the
primary link to the source archive; `sourceVolumeId` is informational and may
change if the source archive moves. The marker also points to the destination’s
local catalog and source index, and records the destination’s goal and layout.
If two registered destinations claim the same volume ID, the marker’s
`destination_id` is the tiebreaker. If neither marker exists, the app asks the
user to confirm rather than guessing.

### 12.6 PC cache

The existing `app.db` `backup_destinations` table remains a cache/registry only.
It may store known volume IDs, labels, last-seen times, and UI preferences. It
must not become the authoritative coverage store.

Destination local catalogs and caches live on the destination, not in `app.db`.
They are derived and rebuildable. The source index is also stored on the
destination and is a snapshot, not authority.

The existing database backup and restore process must include `catalog.db` so
the replica tables survive. Resetting or rebuilding the catalog destroys
coverage metadata; destination files remain and can be re-adopted. Clearing the
generated cache must not delete replica metadata or destination local
catalogs.

### 12.7 Hash freshness and indexes

The existing `hashes` table must record the source size and modified time
observed at hash time, or a companion table must. A legacy hash without those
values is trusted only when the file's modified time is not newer than the hash
timestamp; otherwise the source is re-hashed.

Recommended indexes:

- `file_dates(resolved_date, file_id)` for chronological planning.
- `replica_files(replica_id, status)` for coverage and run queries.
- `replica_files(replica_id, source_relative_path)` for path-based matching.
- `replica_destinations(priority)` for destination order.

The `relative_path` unique constraint is case-insensitive to match Windows
filesystems.

## 15. Test plan

### 15.1 Unit

- Reserve and allocation formulas for fixed, percent, and all-safe modes.
- Per-file size estimate and free-space checks.
- Chronological comparator: exact, month-only, year-only, manual overrides,
  undated files, and path tiebreakers.
- Date coverage map for contiguous, mixed, and non-contiguous destination
  coverage, separating verified backup coverage from local-library contents.
- Planner fill order across two and three destinations with overlapping
  existing date coverage.
- Planner never moves existing files to improve date ranges.
- Planner never returns to an earlier destination after advancing.
- Planner handles a single incompatible file without wasting the current drive.
- Remainder calculation for partial capacity.
- Active-run uniqueness and status transitions (`running`, `paused`,
  `stopping`, `completed`, `stopped`, `failed`, `interrupted`).
- Plan revision increment and audit event when a paused run is edited.
- Locked-control policy matrix for running, paused, and stopped states.
- Run re-entry state selection: running in background, paused, completed, or
  interrupted.
- Offline destination ranges and pending assignments.
- Union coverage, overlap, gaps, and last-known coverage.
- Adoption matching order and ambiguity handling.
- Filesystem compatibility checks.
- Conflict classification.
- Destination path construction and sanitization.
- Volume identity confidence and collision handling.
- Full-copy capacity and shortfall calculations.
- Partial vs full-copy planning separation and intentional overlap.
- Source growth and full-copy degradation.
- Replacement peak-space and 1 GiB reserve-floor calculations.
- First-adoption conflict versus prior-verified stale classification.
- `source_membership` filtering.
- Promotion eligibility and rollback safe-point rules.
- Same-volume and overlapping-root rejection.
- Goal and layout selection.
- Source root versus catalog root resolution.
- Source index serialization and timestamping.
- Local catalog reuse and update rules.

### 15.2 Integration

- Adoption with matching paths, reorganized paths, renamed files, missing
  markers, and ambiguous same-hash source files.
- Adoption with two identical 1 TB drives.
- Plan across two destinations with one drive smaller than the source.
- Plan with two destinations whose existing years overlap heavily and are not
  chronological. Confirm the oldest uncovered files go to the first
  destination, no existing files move, no duplicates are created, and the UI
  shows the overlapping coverage.
- Plan and run with partial destinations only; no full-copy job, no promotion,
  and no 100% all-destination claim.
- Plan and run with a full-copy destination only; no partial section or
  remainder.
- Complete a full copy, then run partial destinations only. Confirm the full
  copy is shown as complete and is not recopied.
- Open the plan with every destination offline; confirm Start backup is
  disabled and ranges are still shown.
- Open the app with no destinations; confirm the add-destination empty state and
  no plan.
- Plan with an offline earlier destination and a connected later destination.
- Plan with all-safe, percentage, and fixed allocations.
- Destination full, reserve floor, and FAT32 limit.
- Source changed before and during copy.
- Stale replacement approval and failure.
- Disconnect/reconnect and app restart.
- Start a run, navigate to overview, plan, destination detail, and promotion;
  confirm the persistent running status opens the run screen from each.
- Restart the app while a run is running and while it is paused; confirm no
  second run starts and the correct resume state is shown.
- Pause, change allocation or destination order, confirm, and resume; confirm
  verified files are not recopied, existing files are not moved, and the
  remaining plan is recomputed with a new `plan_revision`.
- Add a destination while a run is active; confirm the active plan is unchanged
  and the destination appears in the next plan.
- Try to start promotion while a run is running and while it is paused; confirm
  both are blocked.
- Request a second Start backup while a run is active; confirm the active run
  opens instead of a second run.
- Open destination detail for a full-copy destination; confirm the same page,
  switcher, and tabs work and show full-copy status instead of partial fill.
- Stale, missing, conflicting, and destination-only files.
- Destination has extra files not in the source: shown in the local library and
  **Only on this drive**, not counted as coverage, not copied, not deleted.
- Source file missing but a verified replica exists: reported as a source-missing
  attention count; no restore or reveal/open in this release.
- Ambiguous destination file matching multiple source files: reported without
  guessing.
- Promotion with destination-only files inside the new source root: reported,
  not imported automatically.
- Local-library date map includes extras; backup coverage map excludes them.
- No overwrite and temporary-file cleanup.
- Duplicate source content at different paths.
- Metadata stale and undated files.
- Chronology across runs when a new destination is added later.
- Destination with an existing local catalog reused without creating a second
  catalog.
- Destination local cache seeded from the source cache and regenerated on
  demand.
- Full copy with enough capacity, insufficient capacity, and exact shortfall.
- Full copy plus partial destinations in one plan: full gets every file, no
  file goes to two partial destinations.
- Full copy runs out of space and is marked incomplete without spilling.
- Source growth that turns a full copy into an incomplete/partial copy.
- Stale replacement on the same destination, reserve use with 1 GiB free, and
  blocked replacement when even that cannot fit.
- First-adoption conflict is never overwritten; a prior verified stale copy can
  be replaced after approval.
- Same-volume and overlapping-root destination rejected.
- `source_membership = local_only` files excluded from source coverage and
  planning but visible in the local library.
- Promotion success, blocked promotion, rollback before the first change, and
  rollback disabled after the first change.
- Promotion catalog-merge failure restores the snapshots.
- Promotion leaves extras inside the source root out of the source archive.
- Crash after rename leaves a `copied` row; restart verifies it instead of
  recopying.
- Cache reuse rejected when the source hash/version changed.
- `.memorylane-tmp-*` files skipped and cleaned.
- Source-missing replica is reported as an attention count; no restore or
  reveal/open exists in the first release.
- Dedicated destination with its own local catalog; an active source used as a
  destination is rejected until dual-role support lands.
- Old source registered as a full-copy or partial destination after promotion.
- Keeping and retiring existing 1TB destinations after promotion.
- Catalog copy and path rebasing to the dedicated source root, including
  preserved `source_relative_path` values.
- Refusal to activate two source catalogs with the same `catalog_id`.
- Rebuilding a destination local catalog by scanning.

### 15.3 Manual

- The user’s real 4 TB source plus two 1 TB destinations with existing split
  backups.
- Add both destinations, choose the drive root, adopt, verify coverage, set
  “all safe”, plan, start the backup, and confirm the oldest files landed on the
  first destination.
- Start a backup, leave the run screen for the overview, plan, and a destination
  page, and return via the persistent status each time.
- Pause the backup, change an allocation or destination order, confirm, and
  resume. Confirm verified files were not recopied and existing files were not
  moved.
- Close and reopen the app during a run and while paused; confirm the correct
  resume state and no second run.
- Confirm no source file is copied twice to partial destinations. A full-copy
  destination may duplicate them intentionally. Confirm the remainder is
  reported accurately.
- Disconnect one destination mid-run, reconnect, and resume.
- Confirm existing files were not moved and new files are under
  `Memory Lane\<archive folder>`.
- Open the 1 TB destination by itself and browse its local library and source
  index without the 4 TB source connected.
- Add a third destination later and confirm it continues from the oldest
  uncovered file.
- Add a large drive as a full copy, verify 100%, promote it to source, keep the
  old 4 TB as a full copy, and keep or retire the 1 TB destinations.
- Grow the source beyond the old 4 TB capacity and confirm it degrades to
  partial with an accurate shortfall.
- Roll back a promotion before the first change on the new source; verify
  rollback is refused after a scan or edit.
- Confirm source-missing replicas appear as attention counts and the source
  archive remains unchanged.

## 16. Resolved decisions and deferred choices

The core design is settled. Items that were open in the first draft are now
decided below. None of the remaining deferred choices blocks the first
implementation.

### 16.1 Resolved in this design

| Question | Decision |
|---|---|
| Old source after promotion | Prompt with **full copy** preselected when it still fits, otherwise **partial**. Never switch silently. |
| Source index format | SQLite, documented schema, compact read-only snapshot. |
| Local library updates | Incremental after every adoption and run, with cache reuse and a retry queue. |
| Rollback after the first change | Disabled unless a merge-back migration exists. Warn before the first change. |
| Source exceeds every full-copy drive | Show the exact shortfall, require a larger drive, never silently downgrade. |
| Full-copy destination with a shortfall | Default blocks; explicit **copy what fits as partial** is allowed and labelled partial. |
| Connected-drives-only mode | Advanced option, off by default, with a chronology warning. |
| Leftover capacity on an earlier drive | Report it; do not backfill out of chronological order. |
| Run-history retention | Keep the last 50 runs; prune older rows. |
| Periodic deep verification | On demand in the first version; scheduling is future work. |
| Catalog clone detection | Block two active sources with the same `catalog_id`; require one demoted. |
| Run re-entry | Persistent status on every screen plus an overview run banner; the run screen is always one click away. |
| Plan changes during a run | Locked while running; pause, confirm, and resume. Verified files are never recopied or moved. |
| Add destination during a run | Queued for the next plan; never changes the active run. |
| Promotion during a run | Blocked while running or paused. |
| Concurrent runs | One active run per source archive. A second Start backup opens the active run. |
| Dual-role in the first release | Dedicated destinations only. An active source cannot be a destination; dual-role is deferred. |
| Heavy workloads | Scan, validation, and replication are mutually exclusive. Browsing stays available. |
| Switching source during a run | Blocked while running or paused; pause or finish first. |
| Stopping a run | `stopped` after the current file; verified files stay; resume is allowed. |
| Plan persistence | Recompute the deterministic plan; store `planHash` and summary counters, not every plan item. |

### 16.2 Deferred choices

1. **Exclusion rules.** Excluding non-media files, sidecars, or folders. The
   first version includes every present cataloged file.
2. **Sidecar grouping.** `.xmp`, `.aae`, and similar sidecars follow their
   primary file. The first version treats each cataloged file independently.
3. **Selected second copies.** Full-copy destinations are the only intentional
   duplicate mechanism. Selected duplicates on partial destinations are future
   work.
4. **Import destination-only files.** The first version leaves extras out of the
   source archive and shows them in the local library. A future explicit import
   is possible but not required.
5. **Restore into source.** The first release keeps the source archive
   read-only and exposes no destination item actions. A future explicit recovery
   tool may add per-file or batch restore with its own write boundary and
   security review.
6. **Merge-back after the rollback safe point.** If required later, it is a
   separate explicit migration. The first version disables rollback instead.

## 17. Implementation phases

The engineering delivery slices, module layout, risks, and acceptance-test
matrix are in
[`replication-implementation-plan.md`](replication-implementation-plan.md).
The product phases below describe feature capability, not the merge order.

1. Archive identity, roles, catalog root, and source root.
2. Destination registration, local library reuse/create, root selection,
   marker, and identity confidence.
3. Destination scan, adoption, matching, hash verification, local catalog
   updates, cache reuse, and source index generation.
4. Allocation, goal, and layout UI.
5. Partial chronological planner with union coverage, offline ranges, gaps,
   and remainder.
6. Full-copy planner, capacity/shortfall checks, and source-growth monitoring.
7. Copy executor with temp-file verification, stale replacement, pause/resume,
   disconnect handling, run status and re-entry, plan locking, plan revisions,
   and local library/cache updates.
8. Promotion flow, catalog migration, old-source demotion, keep/retire choices,
   and rollback.
9. Plan, run, coverage, destination detail, and promotion UI, including the
   persistent running status, locked controls, and paused **Edit plan** state.
10. Manual drills: dedicated destination with its own local catalog, active
    source rejected as a destination, 8 TB full copy, promotion, source growth
    beyond the old 4 TB, and 1 TB keep/retire.

Status: capabilities 1-9 are implemented. The manual physical-drive drill in
step 10 remains tracked in the release checklist.
