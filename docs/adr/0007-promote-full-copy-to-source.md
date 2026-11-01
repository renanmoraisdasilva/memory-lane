# 0007 - Promote a verified full-copy destination to source archive

- Status: Accepted
- Date: 2026-11-01

Detailed feature specification:
[`../product/partial-backups.md`](../product/partial-backups.md).

## Context

The current source archive is 4 TB. The user may later buy another 4 TB or 8 TB
drive, either to hold a complete backup or to become the new main source. Two
1 TB destinations already hold partial copies. The user does not want to redo
those backups or re-hash data unnecessarily when the archive moves.

The existing partial-backup design already adopts destination contents and
tracks coverage by union. It does not yet support a destination whose goal is a
complete copy, or a safe way to make that copy the new source.

## Decision

- Add a per-destination goal:
  - `extend_coverage` — partial destination, filled oldest-first as part of the
    chronological chain;
  - `full_copy` — receives every present source file, even when partial
    destinations already cover it.
- Full copy is optional. Partial-only archives remain valid; a completed full
  copy can be excluded from later runs. Promotion is unavailable until a
  complete full-copy destination exists.
- The first release promotes a dedicated full-copy destination, not a drive that
  is currently an active source archive. Dual-role promotion is deferred.
- Intentional overlap between a full-copy destination and partial destinations
  is allowed and labelled. It is not accidental duplication.
- A full-copy destination must fit the entire present source plus the reserve.
  If it does not, the app shows the exact shortfall and does not call it full.
- If the source later grows beyond the destination, the destination
  automatically becomes partial with a warning. Existing files are never
  deleted, and the app never claims a full copy it no longer has.
- If a full-copy destination runs out of space during a run, mark it incomplete.
  Do not silently spill its files to partial destinations.
- Promotion is a guided, metadata-only operation available only after a full
  copy is 100% verified with zero stale, missing, conflict, failed, or remainder
  files. It is blocked while a backup run is running or paused.
- Promotion preserves the archive identity: `catalog_id`, dates, manual
  overrides, duplicates, hashes, and coverage history.
- The new source root follows the destination layout: the dedicated
  `Memory Lane\<archive folder>` for dedicated destinations, or the destination
  root for mirror-layout destinations. The catalog root stays at the drive root,
  so no archive files need to move.
- The old source is registered as a mirror-layout destination because its files
  are already at its root.
- Destination-only files are left out of the new source archive, remain visible
  in the local library, and are never imported or deleted automatically.
- Every replica stores both its destination-relative path and its
  source-relative path. The source-relative path is preserved through
  promotion, so existing coverage remains valid without re-hashing.
- The previous source catalog becomes `demoted_source`, not an active source,
  with a reference to the new active source. It may still update its local
  library as a destination. The previous source drive may become a full-copy
  destination when it still fits, or a partial destination when it does not. The
  user chooses whether to keep or retire it.
- Existing 1 TB destinations may be kept as partial destinations or retired
  after promotion. Keeping them preserves their coverage and markers.
- Only one source catalog per `catalog_id` may be active. Promotion blocks a
  duplicate active source.
- Promotion reports destination-only files, including files inside the new
  source root. It never imports them into the new source automatically; the
  user may leave them as local extras or exclude them from the source scope.
- Rollback is guaranteed only before the first change on the new source. After
  that, disable rollback unless a merge-back feature exists.
- Promotion restores the pre-promotion catalog snapshots if the merge fails
  before the active-source switch.
- Each destination keeps a local library catalog and cache for its own files,
  plus a compact source index snapshot. The source catalog remains the
  authority for coverage; the local library is for browsing and recovery. The
  full source thumbnail cache is not duplicated to every destination.

## Alternatives

- **Require a fresh backup to the new drive.** Rejected: it repeats days of
  copying and ignores the existing partial destinations.
- **Create a new catalog identity on the new drive.** Rejected: it invalidates
  destination markers and forces re-adoption and re-hashing of the 1 TB drives.
- **Use the new drive only as a backup and never promote it.** Rejected: the
  user may want the larger drive to become the main source.
- **Copy the entire source catalog and thumbnail cache to every destination.**
  Rejected: partial drives would show missing files and caches would be
  duplicated. Use a local library plus a compact source index instead.
- **Promote without full verification.** Rejected: the old source could be
  demoted while the new drive is incomplete.
- **Move the archive files to the new drive’s root during promotion.** Rejected:
  moving 4 TB is slow and risky. Promotion is metadata-only; the dedicated
  folder becomes the new source root.

## Consequences

- The catalog needs roles, a source root, and promotion records.
- Full-copy destinations need capacity checks and source-growth monitoring.
- The destination needs a local library catalog, a local cache, and a compact
  source index. These add maintenance but make each drive browsable on its own.
- Promotion needs a guided UI, verification gate, rollback, and tests.
- Existing 1 TB catalogs can be reused as local libraries.
- A dual-role drive can be a source for its own local library and a backup
  destination for another archive. Its roles must be labelled separately.
- The feature needs a manual drill: 1 TB dual role, a large full copy,
  promotion, old-source full/partial behavior, and 1 TB keep/retire choices.
