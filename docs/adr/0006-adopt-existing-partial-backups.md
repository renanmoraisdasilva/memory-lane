# 0006 - Adopt existing partial backups across destination drives

- Status: Proposed
- Date: 2026-11-01

Detailed feature specification:
[`../product/partial-backups.md`](../product/partial-backups.md).

Full-copy destinations and source promotion are covered by
[`0007-promote-full-copy-to-source.md`](0007-promote-full-copy-to-source.md).

## Context

The source archive is larger than any single destination drive. The user has a
4 TB archive and two 1 TB destination drives. Files have already been copied
manually and split between those destinations outside Memory Lane. A future
partial-backup feature must not require re-copying, moving, or reorganizing
those existing copies.

## Role model

- **“Truth” is not a drive type.** It is the relationship between a source
  archive catalog and the files it owns.
- Use **source archive** as the user-facing term for the truth copy. Use
  **backup destination** in the UI and **replica** only in technical
  documentation.
- A drive should not have an exclusive `truth` or `backup` flag. The same
  physical drive could be the source archive for its own local library and a
  backup destination for another archive.
- Roles are scoped to an archive, not to a volume. Avoid a global drive-type
  enum and avoid making the role immutable.
- The source archive is authoritative for coverage. A backup destination is a
  relationship target, not a second source catalog.

## Where the information lives

- Store authoritative replica/coverage metadata in the **source archive’s
  `catalog.db`** on the source drive. It travels with the archive and survives
  a PC reinstall.
- Keep `app.db` as a convenience registry of known drives, last-seen state, and
  UI preferences. It must not be the only place that knows which files cover
  which archive.
- A destination keeps its own local library catalog and cache for the files on
  that drive, plus a compact source index snapshot. These are derived and
  rebuildable; they are not the authority for source coverage.
- Optionally write a small marker on a backup destination such as
  `.memorylane/replicas/<catalog-id>.json` containing only the source catalog
  identity and label. It is a hint for recognition, not the authority. If the
  marker is missing, the source catalog can still adopt the destination and
  rebuild coverage by scanning and hashing.
- Store destination paths **relative to the destination root**, never with a
  drive letter or mount-point prefix. Resolve them against the current volume
  mount point at runtime.
- Store a separate **source-relative path** for coverage matching. It remains
  stable when the source root moves or a destination is promoted.

## Decision

- Treat existing destination contents as the starting state, not as an empty
  backup target.
- Adopt a destination by scanning it, matching its files to the source catalog,
  and recording verified coverage without modifying the destination files.
- Hard-reject a destination on the same volume as the source archive, or with
  overlapping source/destination roots.
- On first adoption, a different hash at the expected path is a conflict, not a
  stale copy. Stale replacement requires a prior verified copy and approval.
- Stale replacements target the existing destination first. They may use the
  reserve only under the 1 GiB-floor exception; new copies never use it.
- Catalog files carry `source_membership = source | local_only` so local-library
  files cannot be mistaken for source coverage.
- Report files that exist only on a destination under **Only on this drive**.
  Keep them in the destination’s local library, never count them as source
  coverage, never copy them to the source or other destinations automatically,
  and never delete them automatically. Distinguish them from source-missing
  replicas, which are shown as “Source missing; backup copy exists.”
- Match by relative path plus size first, then unique name plus size, then
  unique content hash. Verify SHA-256 before counting coverage.
- Track coverage per destination and as a union. A source file counts once even
  if it exists on multiple destinations.
- Plan the entire present source archive, oldest first, with undated files
  last. The user does not select files in the first version.
- Fill destinations in priority order: the first destination receives the
  oldest uncovered files until its allocation is reached, then the next
  destination continues. This is a fill order, not a claim that the first
  destination’s existing files are older.
- Never move existing files between destinations to make date ranges cleaner.
  Existing date coverage may overlap; show it as a map, not as a clean range.
- Copy only missing, unverified, stale, or uncovered files.
- When capacity runs out, copy what fits and report the exact remainder.
- Preserve the existing destination layout. New copies go under a dedicated
  `Memory Lane\<archive>` folder on each destination.
- Use a safe per-destination allocation, defaulting to all free space minus a
  reserve of 2% of capacity with a 5 GiB minimum.
- Allow one backup-destination relationship per drive in the first version. A
  drive may still have its own local library or source catalog.
- Fill gaps only for partial destinations. A full-copy destination is the
  explicit exception and is defined in ADR 0007.
- Keep source catalogs independent; destination coverage is metadata about
  copies, not a merged source catalog.
- The first replication release requires a **dedicated destination**. A drive
  that is currently an active source archive cannot be registered as a
  destination. The role model remains capable of dual-role support later.

## Alternatives

- **Require a fresh backup from an empty destination.** Rejected: it duplicates
  data, wastes hours, and does not match the user's existing workflow.
- **Support only one destination mirror.** Rejected: the archive does not fit on
  one smaller drive.
- **Trust filenames and sizes without hashing.** Rejected: a same-name file may
  be a different or corrupt copy; the feature must distinguish copied from
  verified.
- **Hash every destination file before showing any progress.** Safer, but slow.
  The implementation should show discovered/unverified state first and verify
  in the background.
- **Normalize all destinations into one app-managed folder layout.** Rejected:
  it would force the user to reorganize existing manual backups. New copies use
  a dedicated folder, but existing files stay where they are.

## Implementation sketch

The source catalog needs a stable archive identity and two relationship tables:

- `archive_identity`: stable catalog/archive ID, separate from the volume ID.
- `replica_destinations`: destination volume identity, label, destination root,
  dedicated copy folder, priority, allocation mode, reserve, last-seen time,
  free space, and active/retired/lost status.
- `replica_files`: source file, destination-relative path, size, verified
  SHA-256, verification status, and timestamps.

Coverage is a query over verified `replica_files` joined to the source files.
Per-destination views group the same rows by destination; cumulative coverage
uses a distinct source-file count so an overlapping copy is not double-counted.
The planner orders uncovered files by resolved date and fills destinations in
priority order. The UI must keep “discovered”, “copied”, and “verified”
distinct.

## Consequences

- The first adoption pass may hash existing destination files to prove
  coverage. This is read-only verification, not a re-copy.
- The catalog needs destination identity, source-to-destination mappings, and
  verification state.
- The source drive carries the authoritative coverage map; the PC database is
  only a cache.
- Losing a destination marker is recoverable by re-adoption.
- The model supports multiple source archives and multiple destinations
  without assigning a permanent kind to any physical drive.
- Overlapping coverage is visible rather than hidden or double-counted.
- Destination-only files are visible in the destination’s local library and in
  the **Only on this drive** section. They remain outside source coverage and
  are never imported automatically.
- New copies use a documented dedicated folder; existing files are never moved.
- Each destination keeps its own local library catalog and cache, plus a
  compact source index. The source catalog remains the coverage authority.
- A verified full copy can later become the new source without re-copying or
  re-hashing; see ADR 0007.
- A backup run has a persistent status and a stable progress screen. Plan and
  destination changes are locked until the run is paused; paused edits apply to
  remaining work only and never move or recopy verified files.
- Chronological fill is a planning order, not a guarantee of perfectly
  partitioned date ranges when adopted content is mixed.
- Existing destinations may each contain overlapping years. The app shows the
  actual date coverage and never rebalances files by moving them.
- The feature needs its own schema migration, ADR follow-up, tests, and a manual
  two-destination drill before release.
