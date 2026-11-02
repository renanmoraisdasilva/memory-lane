# Archive replication across destination drives

Status: implemented as the post-v0.1 replication release. The design below is
the source of truth for behavior; all three delivery slices (adoption/planning,
partial execution, full copy/promotion) are implemented.

It is referenced by
[`../adr/0006-adopt-existing-partial-backups.md`](../adr/0006-adopt-existing-partial-backups.md)
and
[`../adr/0007-promote-full-copy-to-source.md`](../adr/0007-promote-full-copy-to-source.md).

Implementation structure, delivery slices, and the acceptance-test matrix are
in [`replication-implementation-plan.md`](replication-implementation-plan.md).
The IPC and worker contracts are in
[`../contracts/replication.md`](../contracts/replication.md).

## 1. Summary

The source archive is larger than any single destination drive. The user has a
4 TB source archive and two 1 TB backup destinations with existing manually
split copies. The feature must:

- adopt existing destination contents without re-copying them;
- verify copies by content;
- let the user set a safe allocation per destination, with **Use all safe
  space** as the default;
- plan the entire source archive in chronological order;
- fill partial destinations oldest-to-newest until their allocation, then
  continue on the next partial destination;
- support explicit **full-copy destinations** that receive every source file,
  even when partial destinations already cover it;
- let each destination keep a local library catalog and cache for its own
  files, plus a compact source index for recovery;
- copy only files that do not already have a verified replica on a partial
  destination;
- copy what fits when capacity runs out, and report the remainder precisely;
- never duplicate a source file across partial destinations by default;
- support a guided promotion of a verified full-copy destination into the new
  source archive, preserving archive identity and history;
- degrade a full-copy destination to partial, with a warning, when the source
  grows beyond its capacity;
- never double-count coverage;
- fail safely on disconnect, restart, conflict, or source change.

The source archive is authoritative. A backup destination is a relationship
target, not a second source catalog.

### First implementation scope

- A destination must be a **dedicated destination** in the first release. A
  drive that is currently an active source archive cannot be registered as a
  destination. The role model remains capable of dual-role support later.
- Scan, validation, and replication are mutually exclusive heavy workloads.
  Browsing remains available.
- Switching the source archive is blocked while a run is running or paused.
- The feature was delivered in three slices: adoption/coverage/plan, partial
  copy execution, then full copy and promotion. The slice plan and test matrix
  are in [`replication-implementation-plan.md`](replication-implementation-plan.md).

### Decision log

| Question | Decision |
|---|---|
| Destination layout | Reorganized or mixed; adoption must not assume matching paths. |
| Copy behavior | The app copies, but only after showing a plan. Pause and resume are required. |
| Safe reserve | 2% of capacity with a 5 GiB minimum. |
| Capacity shortage | Copy what fits in chronological order; show the remainder. Do not ask the user to pick files. |
| Sources per destination | One source archive per destination in the first version. |
| New copy location | Dedicated `Memory Lane\<archive>` folder by default; mirror layout optional. Existing files stay where they are. |
| Undated files | After all dated files, ordered by path. |
| Stale copies | Prompt once per run, then replace safely. |
| Duplicate coverage | Partial destinations fill gaps only. Full-copy destinations are an explicit exception. |
| Destination browsing | Each destination keeps a local library catalog and cache for its own files, plus a compact read-only source index. No full source cache duplication. |
| Large drives | A destination can be partial coverage or a full copy. Full copy is an explicit per-destination goal. |
| Promotion | A guided flow can promote a verified full-copy destination to the source archive, preserving catalog identity and history. |
| Old source | Keep it as a full-copy destination when it fits. If the new source outgrows it, degrade it to partial with a warning. |
| 1 TB drives after promotion | Keep as partial destinations or retire them; the user chooses. |
| Existing 1 TB catalog | Reuse and update it as that drive’s local library. |
| New source layout | New copies stay under `Memory Lane\<archive>`; that folder becomes the new source root after promotion. |
| Mixed existing dates | Keep existing files exactly where they are. Chronology applies only to the order of **uncovered** files. Show actual date coverage and overlap; never move files to rebalance. |
| Destination-only files | Show them under **Only on this drive** and in the destination local library. Never count as source coverage, copy to the source, or delete automatically. |
| Full-copy overlap | Partial destinations fill gaps only. A full-copy destination may intentionally copy files already on partial destinations. Plan the two groups separately. |
| First-adoption conflict | A different hash at the expected path on first adoption is a conflict. Never overwrite. Stale replacement requires a prior verified copy. |
| Source/destination overlap | Hard reject a destination on the same volume as the source archive, or with overlapping source/destination roots. |
| Stale replacement | Replace on the existing destination first. If peak space is short, use the reserve only for the replacement, keep at least 1 GiB free, and warn automatically. |
| Extras at promotion | Leave destination-only files out of the new source archive. They remain visible in the local library. Never import or delete them automatically. |
| Rollback | Rollback is guaranteed only before the first change on the new source. After that, disable rollback or require an explicit merge. |
| Full-copy out of space | Mark the full copy incomplete. Do not silently spill its files to partial destinations. |
| Destination-only UI | Show **Only on this drive** and **Source missing** as separate groups. |
| Source-missing replicas | Show them separately; do not write into the source archive in the first release. Expose no restore or reveal/open action; restore is deferred. |
| Run re-entry | A persistent **Backup running** status on every screen opens the run screen. The overview also shows a run banner. The run screen never depends on browser history. |
| Plan changes during a run | Lock goal, allocation, priority, layout, root, retire, and re-adoption while the run is running. Pause first; changes apply only to remaining work and never move or recopy verified files. |
| Concurrent runs | At most one active run per source archive. Starting another opens the active run instead. |
| Add destination during a run | Allowed, but queued for the next plan. It does not alter the active run. |
| Promotion during a run | Blocked while a run is active, including paused. |

## 2. Goals and non-goals

### Goals

- One source archive can be spread across one or more destination drives.
- Existing manual copies are adopted and verified without being moved.
- Per-destination allocation is configurable, including “use all safe space”.
- The plan covers the entire source archive. The user does not select files.
- Partial destinations are filled oldest-to-newest in priority order.
- Full-copy destinations receive every present source file and can become the
  next source archive.
- Each destination can be opened on its own and browsed through a local library
  catalog and cache.
- A compact source index on each destination supports recovery and gap
  checking without duplicating the full source cache.
- A verified full-copy destination can be promoted to the source archive with
  the same catalog identity, dates, overrides, duplicates, and coverage.
- A full-copy destination that no longer fits the source degrades to partial
  with an explicit warning.
- A destination can be added, retired, reconnected, or replaced without
  rewriting the source archive.
- Disconnect, restart, full-disk, conflict, and source-change cases fail safely.
- The original source files are never modified.

### Non-goals for the first implementation

- Merging multiple independent source archives into one catalog.
- Automatic deletion or cleanup of destination files.
- Moving, renaming, or reorganizing existing destination files.
- Rebalancing existing files between destinations to create cleaner date
  ranges.
- Cloud or network destinations.
- Incremental block-level deduplication.
- Compression, encryption, or erasure coding of destination copies.
- Promoting a destination to source without a verified full copy and explicit
  user confirmation.
- Two active source catalogs with the same archive identity.
- Copying the entire source thumbnail cache to every destination.
- Backing up a source file to multiple partial destinations by default.
- Per-file selection or media/date scope filters. The first version backs up
  the whole present source archive.
- Backing up the source archive’s own `.memorylane` internals.

## 3. Terminology

| Term | Meaning |
|---|---|
| Source archive | The truth copy and its catalog. The authority for files and coverage. |
| Backup destination | A drive that holds a partial copy of the source archive. |
| Replica | Technical term for a file copy on a backup destination. |
| Adopt | Discover and verify files already on a destination without copying them. |
| Coverage | Source files with at least one verified replica. |
| Union coverage | Distinct source files covered by any destination. A file is counted once. |
| Gap | A present source file with no verified replica. |
| Stale | A replica whose source file or destination content changed after verification. |
| Allocation | Maximum total replica bytes Memory Lane may use on one destination for this source archive. |
| Reserve | Free space that must remain unused on the destination. |
| Plan | A read-only proposed assignment of files to destinations, reviewed before copying. |
| Run | Execution of a confirmed plan. |
| Chronological fill | Assigning the oldest uncovered files first, filling each destination in priority order. |
| Dated file | A file with a usable resolved date from metadata, a manual override, or the filesystem fallback. |
| Undated file | A file with no reliable resolved date. |
| Orphan | A destination file that does not match any source file. User-facing label: **Only on this drive**. |
| Destination-only file | A file physically on a destination that is not part of the source archive. It may be an extra, previously-in-source, ambiguous, or unreadable. It is **not** a source-missing replica. |
| Extra | A destination-only file with no matching source file. |
| Source-missing replica | A verified destination copy whose source file is currently missing from the source archive. It is a separate recovery category, not a destination-only file, and may be explicitly restored later. |
| Ambiguous file | A destination file that matches more than one source file and cannot be assigned safely. |
| Last-known coverage | Coverage recorded at the last successful verification while the destination was connected. |
| Local library | A catalog and cache describing the files physically on one drive. It is for browsing and recovery, not the authority for another archive’s coverage. |
| Destination catalog | The local library catalog stored at the destination’s catalog root. |
| Source index | A compact, read-only snapshot of the source archive’s file list and coverage metadata, stored on a destination for recovery and gap checking. It contains no thumbnails. |
| Partial destination | A destination whose goal is to hold a chronological subset of the source archive. |
| Full-copy destination | A destination whose goal is to hold every present source file. |
| Promotion | The metadata-only operation that makes a verified full-copy destination the new source archive. |
| Demoted source | The previous source archive after promotion. It is not an active source, but it may still be updated as a local library and become a full-copy destination. |
| Catalog root | The folder containing `.memorylane\catalog.db`. In the current app this is the drive root. |
| Source root | The folder whose contents belong to the source archive. It may be the catalog root or a subfolder such as `Memory Lane\4TB Archive`. |
| Date coverage | The distribution of dates present on a destination. It may be contiguous, overlapping another destination, or non-contiguous. |
| Mixed coverage | A destination containing files from overlapping or non-contiguous date ranges. This is expected after a manual split. |

User-facing terms are **source archive** and **backup destination**. “Truth” is
acceptable in explanatory text but is not a drive type.

## 4. Role model and source of truth

- A drive has no permanent `truth` or `backup` flag.
- The role is a relationship with one source archive.
- The same physical drive may be a source archive for one catalog and a backup
  destination for another, but the first implementation treats a destination as
  belonging to one source archive at a time.
- The source catalog stores the authoritative destination and coverage data.
- The PC `app.db` only caches known drives and UI state.
- A small destination marker may point back to the source catalog, but it is
  advisory and may be regenerated.
- The source archive must be connected to plan or execute a run, because the
  authoritative catalog lives on it.
- The source archive root’s `.memorylane` folder is excluded from backup.
  Other folders named `.memorylane` are treated as normal user data unless they
  are a known Memory Lane cache or catalog path.

### 4.1 Local library versus source archive

- A **local library** describes the files physically on one drive. It is what
  you see when you open that drive by itself.
- A **source archive** is the authoritative catalog for an archive. Its files,
  hashes, dates, duplicates, overrides, and coverage live in its catalog.
- A destination’s local library is derived from the destination contents. It
  can be rebuilt by scanning. It must not be used as the authority for the
  source archive’s coverage.
- The source archive’s catalog remains authoritative even when a destination
  has its own catalog and cache.

### 4.2 Destination local catalog and cache

- Each destination keeps its own `.memorylane\catalog.db` and
  `.memorylane\cache` at its catalog root.
- The destination catalog lists the files physically on that drive, including
  files copied by Memory Lane and any unrelated files the user scanned.
- The destination cache holds thumbnails and previews for the files on that
  drive only. It is not a copy of the full source cache.
- The app reuses the source thumbnail/preview cache when copying a file, so the
  destination library does not have to decode the same HEIC or video again.
- If the destination catalog or cache is lost, rebuild it by scanning. The
  source coverage is unaffected.
- A destination that was already initialized in Memory Lane reuses its existing
  catalog. The app updates it instead of creating a second catalog.

### 4.3 Source index snapshot

- Each destination stores a compact, read-only **source index** under
  `.memorylane\replicas\<catalog-id>\index.db`.
- The index contains the source catalog ID, source label, source root, a
  generated timestamp, and the source file list with relative paths, sizes,
  hashes, dates, and media classes. It contains no thumbnails.
- Each destination’s index is specific to that destination. It records which
  source files are present and verified on that drive at snapshot time, so the
  drive can show what the full archive contains and what is missing locally.
- The index does not replace the source catalog’s union coverage. It is a local
  snapshot for browsing, gap checking, and recovery.
- The index is a snapshot, not the authority. It is updated after each run and
  labelled with its timestamp.
- The index is not a full catalog backup. It preserves file identity, dates,
  hashes, and coverage state; manual overrides, duplicate decisions, and other
  history require the source catalog backup.
- If the source catalog is lost, the index helps rebuild coverage and identify
  missing files. Re-adoption by scanning remains the fallback.

### 4.4 Partial and full-copy destinations

- A **partial destination** has `replica_goal = extend_coverage`. It participates
  in the chronological fill chain and receives only files without a verified
  replica on any active destination.
- A **full-copy destination** has `replica_goal = full_copy`. It receives every
  present source file, regardless of coverage on partial destinations.
- The no-duplicate rule applies to partial destinations. A full-copy
  destination is the explicit exception: it may intentionally copy a file that
  is already verified on a partial destination.
- The partial chain and the full-copy pass are planned separately. A full-copy
  destination is never part of the partial fill order.
- Intentional overlap between a full-copy destination and partial destinations
  is allowed and labelled. It is not treated as an accidental duplicate.
- A full-copy destination is eligible for promotion only when every present
  source file is verified on it, with no stale, missing, conflict, failed, or
  remainder files.

### 4.5 Promotion and one active source

- Promotion is a guided, metadata-only operation after a full copy is verified.
  It does not move or copy the archive files again.
- The new source keeps the same archive identity: `catalog_id`, dates, manual
  overrides, duplicates, and coverage history.
- After promotion, the previous source catalog becomes **demoted**: not active
  as a source and clearly labelled as the previous source copy. It may become a
  full-copy destination and still update its local library for browsing.
- Only one source catalog per archive identity may be active at a time. The app
  must detect a duplicate `catalog_id` and refuse to treat both as active
  sources.
- Rollback is guaranteed only before the first change on the new source. A
  change includes a scan, metadata refresh, date override, import, backup run,
  or any other write to the new source catalog.
- After the first change, rollback is disabled unless the app can merge the new
  source changes back into the previous source. The UI must warn before the
  first change if rollback will no longer be available.
- Before the safe point, rollback re-activates the previous source catalog,
  restores the pre-promotion destination catalog snapshot, and leaves the new
  drive as a destination.

### 4.6 Dual-role drives (deferred)

The model allows a drive to be a source archive for its own local library and a
backup destination for another source archive. **The first replication release
does not allow this.** A destination must be a dedicated drive; registering an
active source archive as a destination is rejected with a clear message. This
avoids merging two active source catalogs in the first release.

- The model allows one destination relationship per drive. It does not merge
  multiple source archives into one catalog.
- The app labels both roles explicitly: “Local library” and “Backup destination
  for 4TB Archive”.
- When a dual-role drive is scanned as its own local library, the backup folder
  is part of that library by default.
- The catalog distinguishes source files from local-only files with
  `source_membership = source | local_only`. The local library shows both; the
  drive’s own source view and the 4 TB source archive view include only their
  own `source` files.
- The backup folder may be marked `local_only` for the drive’s own source scope
  if the user does not want those files in that source archive. They remain
  visible in the local library.
- The destination marker and source index remain separate from the drive’s own
  catalog. They never replace it.

### 4.7 Catalog root versus source root

- The **catalog root** is where `.memorylane\catalog.db` lives. In the current
  app this is the drive root.
- The **source root** is the folder whose contents belong to the source archive.
  It may be the catalog root or a subfolder.
- A future source created under `H:\Memory Lane\4TB Archive` keeps its catalog
  at the drive root and sets `source_root_relative = Memory Lane/4TB Archive`.
  Promotion does not require moving the files to the drive root.
- Coverage paths are relative to the source root. The local library may include
  files outside the source root.
- Every replica stores both its destination-relative path and its
  source-relative path. The source-relative path is the stable coverage key and
  does not change when the source root moves.
- New copies always use the destination’s dedicated
  `Memory Lane\<archive folder>` unless the user explicitly chooses a mirror
  layout.

### 4.8 Deployment shapes

A full-copy destination is **optional**. The feature must work in all of these
shapes:

| Shape | Behavior |
|---|---|
| Partial destinations only | Plan and run partial coverage. There is no full-copy job. Coverage is partial only, and the remainder is “not covered anywhere.” |
| Full copy only | Plan and run the full copy. There is no partial chain. |
| Mixed partial + full copy | Plan both jobs. They are independent. |
| Full copy already complete | The full copy is shown as complete and is excluded from the run by default. A partial-only run is valid. |
| Full copy stale or incomplete | The full copy is shown as needing work and is included only when selected or when the source changed. |
| One partial destination | The chain has one destination. Adding another later extends it. |
| No destinations | No plan is possible. Show an “Add a destination” empty state and disable Start backup. |
| All destinations retired or lost | Treat as no active destination. Retired history remains; lost coverage is excluded. Show the add/replace state. |
| All destinations offline | The plan remains readable, but Start backup is disabled until at least one destination reconnects. |
| Promotion without a full copy | Promotion is unavailable. The app explains that a complete full copy is required. |

The plan must show only the jobs that exist. “Full copy” and “partial coverage”
are not mandatory pairs.

## 5. Capacity, allocation, and reserve

### 5.1 Units

All calculations use bytes. UI labels may show decimal GB/TB, but must show the
same unit consistently and include the exact byte value in destination details.
Do not assume a “1 TB” drive has 1,000 GiB available.

### 5.2 Safe reserve

Default reserve:

```text
reserveBytes = max(5 GiB, ceil(capacityBytes * 0.02 / 1 GiB) * 1 GiB)
```

- The default leaves roughly 2% free, with a minimum of 5 GiB.
- A hard floor of `max(1 GiB, 1% of capacity)` applies to any custom reserve.
- The user may choose:
  - Recommended: 2% with a 5 GiB minimum;
  - Conservative: 5%;
  - Custom percentage or fixed amount, subject to the floor.
- “Use all safe space” means all **currently free** space minus the reserve.
- The reserve covers filesystem overhead, temporary copy files, marker files,
  and normal drive use. It is not backup capacity.

### 5.3 Destination allocation

`allocationBytes` is the maximum total bytes of this source archive’s replicas
that may exist on the destination, including adopted files.

```text
presentReplicaBytes = sum of tracked replica files that physically exist
freeBytes           = current filesystem free space
reserveBytes        = configured reserve
```

`presentReplicaBytes` includes every physically present tracked replica,
regardless of verification status. A `discovered`, `copied`, `stale`, or
`conflict` file still consumes space. `missing` and `failed` files do not.

For a fixed allocation:

```text
availableForNew = max(0, min(
  allocationBytes - presentReplicaBytes,
  freeBytes - reserveBytes
))
```

For a percentage allocation:

```text
allocationBytes = floor(capacityBytes * percent / 100)
availableForNew = max(0, min(
  allocationBytes - presentReplicaBytes,
  freeBytes - reserveBytes
))
```

For “use all safe space”:

```text
allocationBytes   = presentReplicaBytes + max(0, freeBytes - reserveBytes)
availableForNew   = max(0, freeBytes - reserveBytes)
```

If adopted files already exceed the chosen allocation, the destination is
**over budget**. No new files are assigned to it until the user raises the
allocation, removes files manually, or chooses another destination. The app
must not delete destination files automatically.

### 5.4 Per-file size estimate

Use a conservative estimate:

```text
estimatedBytes(file) = ceil((sizeBytes * 1.01) / 4096) * 4096
```

The plan uses this estimate. Immediately before each copy, the executor also
checks actual free space against the real file size plus the reserve.

### 5.5 Never fill the drive

Before copying a file:

```text
freeBytes - actualFileBytes >= reserveBytes
```

If false, the destination is full for planning purposes. The file is not
copied there. The planner advances to the next destination.

For new files, the app must never intentionally consume the reserve. It must
also leave room for the temporary file used during atomic copy.

### 5.5a Temporary reserve use for stale replacements

Replacing a stale copy is different from adding a new file. The old copy stays
on disk until the new copy is verified, so the replacement needs temporary peak
space.

- The app may use the reserve **only** for a stale replacement on the same
  destination.
- It must always keep at least **1 GiB free** on the destination.
- It may proceed automatically, but the plan and run screens must show a clear
  warning: “This replacement will temporarily use X GB of the reserve.”
- It must never use the reserve for a new file, a full-copy extension, or a
  copy to a different destination.
- If `freeBytes - newFileBytes < 1 GiB`, the replacement is blocked. The app
  asks the user to free space or explicitly lower the reserve.
- If the replacement succeeds, the old file is replaced and the reserve is
  restored. If it fails or the app crashes, the temporary file is discarded and
  the old file remains.
- The full-copy status must account for this peak requirement, not only for net
  replica bytes.

This is the only exception to the hard reserve rule.

### 5.6 Offline destinations

- A connected destination uses current free space.
- An offline destination uses `last_free_bytes`, marked with the last-seen
  time.
- If an active destination has no known capacity, the plan is blocked with
  “Connect this drive once to record its capacity.”
- A plan may assign files to an offline destination. Those assignments wait
  until that destination reconnects. This preserves chronological order.
- The executor copies assignments for connected destinations only.
- Free-space changes on an offline drive are detected when it reconnects; the
  remaining plan is recomputed before copying.

### 5.7 Full-copy capacity

A full-copy destination must be able to hold every present source file:

```text
fullCopyRequiredBytes = present source bytes
fullCopyCapacity      = presentReplicaBytes
                      + max(0, min(
                          allocationBytes - presentReplicaBytes,
                          freeBytes - reserveBytes
                        ))
fullCopyShortfall     = max(0, fullCopyRequiredBytes - fullCopyCapacity)
```

- If `fullCopyShortfall` is greater than zero, the plan must say the destination
  cannot be a full copy and show the exact shortfall.
- The user may explicitly choose to copy what fits; the destination is then
  labelled **partial**, not full.
- Unrelated files on the destination reduce `freeBytes` and therefore reduce
  full-copy capacity. They are never counted as replicas.
- Recheck the shortfall after every run and whenever the source grows.
- A full-copy destination should keep extra headroom for the reserve and future
  growth. The UI warns when the source reaches 90% of the destination’s
  full-copy capacity.

## 6. Coverage semantics

A source file is **covered** only when:

- the source file is present and its current SHA-256 is known;
- a replica exists on a destination;
- the replica SHA-256 matches the source SHA-256;
- the replica status is `verified`;
- the source file has not changed since verification.

### 6.1 Source hash prerequisite

Adoption cannot prove coverage without a source hash. The existing catalog may
have unhashed files because the user paused the hash stage. In that case:

- the destination file is recorded as `discovered`, not covered;
- the source file is hashed read-only and stored in the existing `hashes`
  table;
- only then is the destination copy hashed and compared;
- if the source cannot be read, the replica stays `discovered` and the reason
  is reported.

The hash record must store the source size and modified time observed at hash
time. If an existing hash lacks those values, trust it only when the file's
modified time is not newer than the hash timestamp; otherwise the file changed
after hashing and the source must be re-hashed before the hash is used for
coverage. Hashing is coordinated with the existing scan/hash pipeline so the
same file is not hashed twice at the same time.

This makes adoption also complete the source hash coverage. It is a one-time
read cost, resumable, and never changes the source.

Large files may have only a sampled quick fingerprint from a completed scan.
That fingerprint is not coverage evidence. Adoption and copying compute the full
SHA-256 on demand for the files they touch. Existing full hashes from older
catalogs remain valid, so a fully hashed drive is not rehashed by the new scan
policy.

### 6.2 Avoiding repeated hashing

Each verification stores enough metadata to skip unchanged files on the next
run:

- source size and filesystem modified time at verification;
- destination size and filesystem modified time at verification;
- the verified SHA-256;
- `verified_at`.

A replica is re-hashed only when the source or destination size or modified
time changed, the user requests a deep verification, or the previous status was
not `verified`. The fast path trusts the stored hash when size and modified time
match. A legacy hash without those values is trusted only when the file was not
modified after hashing. It cannot detect bit rot or tampering that preserves
both. Deep verification re-reads the file and is the only way to catch that; run
it periodically or on demand.

The UI must call a file `verified` only from a stored hash comparison, and deep
verification remains available.

### 6.3 Coverage calculations

```text
destinationCoverage(dest) = distinct source files verified on dest
unionCoverage             = distinct source files verified on any active dest
overlap                   = distinct source files verified on 2+ active dests
gap                       = present source files - unionCoverage
```

A file on both destinations counts once in `unionCoverage`. It is shown in the
overlap count but is not added again.

The coverage denominator is present source files. Missing source files are
reported separately; their replicas are retained but are not counted as current
coverage.

Coverage is reported **as of** a timestamp. The UI must not imply that an
offline destination’s files are currently present without qualification.

### 6.4 Offline and retired destinations

- Coverage from an offline destination is **last-known coverage**, labeled with
  the last verification time.
- A file with a verified replica only on an offline destination is not a gap,
  but the UI shows that the copy is on an offline destination.
- Unverified replicas on an offline destination are not counted. They remain
  `discovered` and are listed as “waiting for verification.”
- A destination marked `lost` is excluded from coverage. Its files become gaps
  and can be copied elsewhere.
- A destination marked `retired` keeps its history, files, and marker but is
  excluded from active planning and active coverage. Its last-known coverage is
  shown separately and is not counted as current coverage. The user does not
  have to decide this per destination; retiring is the decision. Keeping a
  destination as a partial destination is the alternative.

### 6.5 Destination-only files and orphans

A **destination-only file** is a file physically on a destination that is not
part of the source archive. It can be:

- **extra** — no matching source file;
- **previously in source** — in an older source index but not the current
  source catalog;
- **ambiguous** — matches more than one source file and cannot be assigned
  safely;
- **unreadable** — cannot be hashed or verified.

A **source-missing replica** is a separate category: it matches a source file
that is currently missing from the source archive. It is not a destination-only
file.

Rules:

- Destination-only files are shown in the destination’s local library with
  thumbnails or previews when possible.
- They are also listed in a user-facing **Only on this drive** section for that
  destination.
- They are never counted as source coverage, never copied to the source archive
  or another destination automatically, and never deleted automatically.
- A **source-missing replica** has a source file ID and a verified hash; the app
  reports it in a separate **Source missing** attention category with a count.
  The current release does not expose destination file browsing, reveal/open, or
  restore; it never writes into the source archive.
- A source-missing replica requires a stored source hash and a verified match.
  Without a stored hash, the destination file remains unverified or extra; the
  app must not guess that it is the missing source file.
- If the source index snapshot contains a file that the current source catalog
  no longer has, label it **Previously in source**. This is more useful than a
  generic extra, but it still does not count as current coverage.
- An **ambiguous** file is reported for review. The app does not guess which
  source file it belongs to. If the multiple candidates exist only because source
  duplicates were deleted outside Memory Lane, use Library health → Missing to
  remove those missing duplicate catalog entries, then re-adopt so the surviving
  file can match. Missing entries that also have move suggestions require an
  explicit confirmation before they can be removed as duplicates.
- A **conflict** at the expected source path is reported separately from an
  extra. It is not a destination-only file because it occupies the path of a
  known source file.
- Extras are not shown in the source archive library unless the user explicitly
  imports them. Importing extras is out of scope for the first version.
- A destination may contain unrelated files. Only files that match the source
  catalog by path, name/size, or content are adopted as replicas.
- Orphan cleanup is a separate, explicit user action; it is out of scope for
  the first implementation.
- Byte-identical duplicate files on a destination are reported as overlap or
  extras. The app adopts at most one canonical replica per source file.

### 6.6 Status values

```text
discovered   found on destination, not yet checked
copied       written but not yet hash-verified
verified     source and destination hashes match; source unchanged
stale        source changed or destination content no longer matches
missing      destination row exists but file is gone
conflict     destination path exists with different content
failed       copy or verification failed
pending      planned for a destination but not copied yet
```

Only `verified` contributes to coverage. `pending` is a plan state, not a
replica state; it is shown in the run UI.

### 6.7 Full-copy coverage

- A full-copy destination is **complete** only when every present source file
  has a verified replica there and there is no stale, missing, conflict, failed,
  or remainder file.
- If the source grows after a full copy, the destination is **incomplete**.
  The UI shows the new bytes/files that are missing and warns that the drive is
  no longer a full backup.
- An incomplete full-copy destination remains a valid partial destination. It
  is not deleted, downgraded silently, or reported as full.
- Intentional overlap between a full-copy destination and partial destinations
  is shown separately from accidental overlap. Union coverage still counts each
  source file once.
- The destination’s local catalog is not used to compute source coverage. It is
  for browsing and recovery. A destination file counts as coverage only when
  the source catalog has a verified `replica_files` row for it.

## 7. Adoption of existing destinations

Adoption is read-only on the destination.

### 7.1 Register the destination

1. Identify the destination by stable volume identity, not drive letter.
2. Reject a drive that is currently an active source archive. The first release
   requires a dedicated destination.
3. Ask the user to choose the destination root: the drive root or a subfolder.
   The default is the drive root. The root must contain the existing files.
4. Record the root relative to the drive mount point, never with a drive letter.
5. Check for a destination marker. If it names another source archive, reject
   with a clear message: one backup-destination relationship per drive in the
   first version. The drive may still keep its own local library.
6. Write or refresh the marker after registration. Marker write failure is a
   warning, not a blocker.

### 7.2 Choose the adoption root

- The default is the drive root, so all existing split files are found.
- If the drive contains a large amount of unrelated data, the user may choose a
  subfolder. This limits the scan but may miss existing copies outside it.
- Show the number of files and bytes that will be scanned before starting.
- Store the choice and reuse it on reconnect.

### 7.3 Scan and match

1. Enumerate files under the adoption root recursively.
2. Do not follow symlinks, junctions, or reparse points that resolve outside the
   root. Skip and report them.
3. Match candidates to source files in this order:
   - exact source-relative path and size. For files under the destination’s
     copy root, strip the copy root and compare the remaining path; store it as
     `source_relative_path`;
   - unique source file name and size;
   - unique source content hash;
   - if multiple source files share a name/size or hash, require a path match or
     report the file as ambiguous.
4. Verify candidate pairs with SHA-256.
5. Before and after hashing a destination file, compare its size and modified
   time. If either changed, discard the result and retry; do not mark it
   verified.
6. Record verified, stale, missing, conflict, and unverified files.
7. Never move, rename, delete, or overwrite a destination file during adoption.

Classify unmatched destination files:

- If the file matches a source file that is currently missing from the source
  archive, and the stored source hash verifies, record it as a
  **source-missing replica**, not an orphan.
- If the source index contains the file but the current source catalog does not,
  record it as **Previously in source**.
- If it matches more than one source file, record it as **ambiguous**.
- If it matches no source file, record it as an **extra**.
- If it cannot be read or hashed, record it as **unreadable**.

Destination-only files remain in the destination’s local library and are
reported in the source coverage view under **Only on this drive**. They are not
adopted as source coverage.

Skip the destination’s `.memorylane/replicas` marker folder, known Memory Lane
cache folders, `System Volume Information`, `$RECYCLE.BIN`, and other
filesystem metadata folders. They are not orphans and are never adopted. Do not
skip an unrelated `.memorylane` folder wholesale.

The first adoption may hash many destination files because the existing layout
is reorganized. This is expected and must be resumable. A file discovered but
not yet verified is visible as `discovered`, never as covered.

If the destination marker is missing, adoption still works. The marker is only
a shortcut. If the drive contains files from multiple sources, the user must
confirm which source archive the destination belongs to.

### 7.3a Conflict versus stale

The same different-hash situation can mean two different things. The app must
classify it from history, not guess:

- **First adoption, no prior replica row:** a file at the expected path with a
  different hash is a **conflict**. Never overwrite it.
- **Prior verified replica, source changed:** the source file’s current hash
  differs from the verified hash, but the destination still matches the old
  verified hash. The replica is **stale** and may be replaced after approval.
- **Prior verified replica, destination changed:** the source still matches the
  verified hash, but the destination file no longer does. The replica is
  **stale** or **missing** and must be re-verified.
- **Both changed and differ:** classify as **conflict** until the user chooses.
- **Destination matches the current source hash:** mark **verified**, regardless
  of its previous state.
- **Destination file is absent but a replica row exists:** mark **missing**, not
  conflict.

A conflict is never overwritten automatically. A stale replacement requires the
prior verified row and the once-per-run replacement approval.

### 7.4 Re-adoption

- On every connection, refresh the destination before planning.
- Use size and modified time to skip unchanged verified files.
- Detect new, changed, missing, and orphan files.
- A file that was manually added to the destination is adopted if it matches a
  source file.
- A file that was manually moved within the destination is matched by name/size
  or hash and its `relative_path` is updated only after verification.
- A previously extra file that later matches a new source file is adopted and
  removed from the **Only on this drive** list.
- A source-missing replica whose source file returns is re-matched normally.
- Adoption never re-copies a verified file.
- Adoption never deletes a destination-only file.

### 7.5 Destination local library

- On registration, look for `.memorylane\catalog.db` at the destination’s
  catalog root.
- If a catalog exists, reuse it. Do not create a second catalog for the same
  drive.
- If no catalog exists, create one and scan the destination root. The catalog
  lists the files physically on the drive.
- After adoption, update the local catalog with newly discovered, changed, and
  missing files. This is an incremental update, not a full rescan.
- The local catalog includes the dedicated `Memory Lane\<archive>` folder and
  any unrelated files that were scanned. The app may exclude app metadata
  (`.memorylane`) but never the backup files.
- Destination-only files are part of the local library. The app labels them
  **Only on this drive** and does not count them as source coverage.
- The local-library date map includes destination-only files. The backup
  coverage map excludes them. The two maps are labelled separately.
- The local catalog’s cache contains thumbnails and previews for local files
  only, including destination-only files.
- If the drive was already initialized as a source archive, its existing
  catalog is its local library. Reuse it and add the backup files; do not create
  a second catalog.
- A destination’s local catalog is derived and rebuildable. It is not the
  authority for the source archive’s coverage.

### 7.6 Source index update

- After a successful adoption or run, write or refresh the compact source index
  at `.memorylane\replicas\<catalog-id>\index.db`.
- The index contains the source catalog ID, source label, source root,
  generated timestamp, and the source file list with relative paths, sizes,
  hashes, dates, and media classes. It contains no thumbnails.
- The index is read-only and labelled with its timestamp. It may be stale
  between runs.
- If the write fails, the backup is still valid. Retry on the next run and show
  a warning.
- If the source catalog is lost, the index helps rebuild coverage and identify
  missing files. Scanning the destination remains the fallback.

## 8. Chronological fill planning

Planning is read-only and must complete before any copy starts.

### 8.1 Scope

- The scope is the **entire present source archive**: images, videos, and other
  cataloged files with `source_membership = source`.
- Local-library-only files (`source_membership = local_only`) are excluded from
  source coverage, planning, and copying.
- The user does not select files, media types, or date ranges in the first
  version.
- Missing source files are excluded from copying and reported separately.
- Destination-only files are never candidates for copying, promotion, or source
  coverage. They are reported under **Only on this drive**.
- The source archive’s `.memorylane` internals are excluded.
- If the user wants to limit the scope later, that is a future feature. The
  first version must not silently omit a category.

### 8.2 Chronological order

The sort key is the library’s resolved date:

1. `file_dates.resolved_date` ascending. This includes metadata dates, manual
   overrides, and the filesystem fallback.
2. For equal dates, source path ascending, case-insensitive.
3. Undated files after all dated files, ordered by path.
4. Date precision is preserved. A year-only date sorts at the start of that
   year, consistent with the Library timeline.

Before the first backup plan, the app checks metadata freshness:

- If the metadata refresh banner is active or any files are undated, show the
  existing refresh banner and offer **Refresh metadata first** as the default.
- Planning may continue with the stored dates after an explicit confirmation.
- The plan screen shows how many files are undated and warns that they will be
  placed at the end.
- Refreshing metadata never changes the source files.

### 8.3 Destination order

- Destinations are processed in user-defined **priority order**.
- The first destination in fill order receives the oldest **uncovered** files
  until its allocation is reached, regardless of how old or mixed its existing
  contents are.
- The second destination continues from the next oldest uncovered file, and so
  on.
- The default order is registration order. The UI labels the first row “Fills
  first with the oldest uncovered files” and later rows “Fills next”. It does
  not call a drive the “oldest drive”.
- Changing the order never moves existing files. It only changes where new
  copies go. The UI warns that date coverage may overlap after a reorder.
- Existing files are never moved to make a drive’s date coverage contiguous.

### 8.4 Candidate set

```text
partialCandidates  = present source files with source_membership = source
                     and no verified replica on any active destination
fullCopyCandidates = all present source files with source_membership = source
                     for a full-copy destination
```

Before planning, existing unverified copies on connected destinations are
verified. A failed or stale copy does not count. A conflicted destination path
does not block a copy to a different destination, but it is reported.

Files with a verified replica on an offline destination are not candidates for
partial destinations. Files with only an unverified replica on an offline
destination are not candidates by default; they are listed as “waiting for
verification” to avoid duplicates. The user may explicitly choose to copy them
anyway.

Full-copy destinations ignore coverage on other destinations. A full-copy
destination always plans every present source file, because its purpose is to
be a complete copy or the next source archive.

The partial chain uses **active partial destinations only**. Full-copy
destinations are never mixed into the partial fill order.

### 8.5 Assignment algorithm

Before the partial fill, run a **replacement pass** for each connected
destination with stale or missing replicas. A full-copy destination’s
replacements belong to the full-copy job; a partial destination’s replacements
precede the partial fill.

1. Find stale or missing replicas on connected destinations.
2. Target the same destination first.
3. Reserve peak space for the temporary copy. The replacement may use the
   reserve only under §5.5a, keeping at least 1 GiB free.
4. If the replacement cannot fit even with the reserve exception, mark it
   blocked and ask. Do not silently assign it to a different destination.
5. Remove the replaced files from the ordinary partial candidate list.

Then process partial destinations in priority order. The planner never goes back
to an earlier destination after advancing.

```text
remainingCapacity(dest) = availableForNew(dest) - plannedBytes(dest)
```

The partial fill uses **active partial destinations only**.

`availableForNew` uses current free space for a connected destination and
last-known free space for an offline destination.

```text
destinations = active partial destinations ordered by priority
current = 0
for file in candidates ordered chronologically:
  assigned = false
  while current < destinations.length:
    dest = destinations[current]
    if estimatedBytes(file) > remainingCapacity(dest):
      current += 1          # destination is full for this sequence
      continue
    if file is incompatible with dest:
      for later in destinations after current:
        if compatible(later, file) and fits(later, file):
          assign(file, later)
          remainingCapacity(later) -= estimatedBytes(file)
          assigned = true
          break
      break                 # keep current destination for later files
    assign(file, dest)
    remainingCapacity(dest) -= estimatedBytes(file)
    assigned = true
    break
  if not assigned:
    add file to partial remainder with a reason
```

Rules:

- A file is assigned to at most one **partial** destination.
- A file already covered on a partial destination is never assigned to another
  partial destination.
- A full-copy destination may still receive a file that is covered on a partial
  destination. That is the explicit full-copy exception.
- A file that does not fit the current destination advances the sequence to the
  next destination. The planner never returns to the earlier destination.
- A file that is incompatible with the current destination (for example, a
  FAT32 file-size limit or an invalid path) may try a later destination without
  advancing the sequence. This avoids wasting the rest of a drive on one
  incompatible file. If this leaves unused capacity on the earlier destination,
  report it; do not backfill out of chronological order.
- No silent omission: every candidate is either planned or listed as a gap or
  remainder.
- The plan does not ask the user to choose a subset.

### 8.6 Copy what fits

- When every active partial destination reaches its allocation, including
  pending assignments to offline destinations, the remaining candidates are the
  **partial remainder**.
- Full-copy destinations are planned separately. Their shortfall is shown
  separately from the partial remainder.
- The plan shows the remainder size, file count, and chronological range.
- The user confirms **Start backup** in the execution drawer. The app copies
  the planned files and leaves the remainder unbacked up.
- The remainder is not an error. It is the expected result when the archive is
  larger than the partial destinations.
- Adding another partial destination later extends the sequence from the oldest
  uncovered file. Adding a full-copy destination creates an independent full
  copy.
- The plan must never silently drop files or claim full coverage.

### 8.7 Offline destinations and chronology

- A plan may assign files to an offline destination. Those files wait.
- Connected destinations copy only their own assigned range. This preserves the
  chronological partition across drives.
- If an earlier destination is offline, later destinations may still copy their
  newer range. The older range waits for the earlier drive.
- The UI shows “Waiting for Backup A to reconnect: 320 GB, 2008-03 → 2019-11.”
- An explicit **Connected drives only** mode excludes offline destinations from
  new assignments, but their last-known verified coverage still counts, so
  already-covered files are not duplicated. Unverified copies on offline
  destinations remain uncounted; the user must confirm copying them. This mode
  can put newer files on an earlier drive and is labeled as a
  chronology-breaking choice. It is off by default.

### 8.8 Existing adopted content

- Existing files are never moved to make a cleaner chronological split. This is
  a hard rule, not a default.
- The two drives may each contain overlapping years. That is expected after a
  manual split and is not an error.
- The planner fills the first destination in fill order with the oldest
  uncovered files, then the next, regardless of the drives’ existing dates.
- The UI shows a **date coverage map** for each destination, for example a
  histogram by year. It labels overlapping years and non-contiguous coverage
  instead of reducing the drive to one range.
- The app does not claim that a drive covers a clean date range. It shows the
  actual distribution.
- No file is duplicated to “correct” a drive’s date range.
- “Fill A first, then B” is a capacity and predictability rule, not a claim
  that A contains older files than B.

### 8.9 Plan output

The plan must show:

- scope: entire source archive, file count, bytes, and undated file count;
- chronological order: oldest first, undated last;
- per destination: priority, adopted bytes, new files, new bytes, free after,
  reserve, the date range of the **new** files, and a link to the destination’s
  existing date coverage map;
- coverage before and after: verified bytes/files, gaps, overlaps, full-copy
  coverage, and partial coverage;
- stale and missing replicas, with the replacement approval summary;
- counts of conflicts, ambiguous files, filesystem-incompatible files, and
  destination-only files, with links to the destination detail;
- unverified files waiting on offline destinations;
- the remainder: bytes, files, and starting date;
- whether any destination is over budget or identity is unconfirmed;
- warnings for stale metadata, offline destinations, unverified copies,
  chronology-breaking mode, source growth, and full-copy shortfall;
- a running-state banner and disabled Start backup when a run is active.

The plan does not repeat each destination’s full date map. The map belongs to
the destination detail page; the plan shows the new-file range and links to it.
This keeps the plan readable.

Coverage after the plan is split into **verified after this run** and
**projected after pending offline destinations connect**. The plan must not
merge the two into a single optimistic number.

### 8.10 Full-copy destinations

A destination’s goal is chosen when it is added and can be changed later:

- `extend_coverage` — partial destination; participates in the chronological
  fill chain and receives only files without a verified replica on another
  active destination.
- `full_copy` — receives every present source file, regardless of coverage on
  partial destinations.

Full-copy planning:

1. Compute the present source bytes and file count.
2. Compute `fullCopyCapacity` and `fullCopyShortfall` using §5.7.
3. If the shortfall is greater than zero, show it and do not label the
   destination a full copy. The default is to block the full-copy goal and
   suggest a larger drive. The user may explicitly choose to copy what fits as a
   partial destination.
4. Otherwise, assign every present source file to the destination in
   chronological order, subject to filesystem compatibility.
5. Verify every copied file. A full-copy destination is complete only when the
   run finishes with zero failures, zero stale files, zero conflicts, and zero
   remainder.
6. After the run, refresh the destination’s local library and source index.

Rules:

- Full-copy destinations are independent of the partial chronological chain.
  They do not consume the partial destinations’ allocation or change their
  ranges.
- Intentional overlap between a full-copy destination and partial destinations
  is allowed. The UI labels it as “full copy” rather than accidental overlap.
- A full-copy destination can be offline during planning, but it must be
  connected to copy and verify. Promotion requires it connected.
- A full-copy destination must keep the configured reserve free for new files.
  Stale replacements may use the replacement exception in §5.5a.
- If a full-copy destination runs out of space during a run, mark it
  `full_copy_status = incomplete`. Do not silently copy its remaining files to
  partial destinations. Ask for a larger drive or an explicit goal change.
- A full-copy destination is complete only when every present source file is
  verified there, with no stale, missing, conflict, failed, or remainder files.
- A full-copy destination can be changed to `extend_coverage` later. Its
  existing files remain and count as coverage; it then joins the partial chain
  with its current contents.

### 8.11 Promotion planning

Promotion is available only when a full-copy destination is complete and the
user explicitly starts the guided flow.

Preconditions:

- The destination’s goal is `full_copy`.
- Every present source file has a verified replica on the destination.
- There are no stale, missing, conflict, failed, or remainder files.
- The destination is connected and its identity is confirmed.
- No scan or backup run is active, including a paused run.
- The source catalog is healthy and its source root is known.

Promotion steps:

1. Run a final verification pass. Use the size/modified-time fast path; offer
   deep verification as an option.
2. Confirm the destination’s full-copy capacity and shortfall are zero.
3. Build or refresh the destination’s local library catalog and cache.
4. Write the compact source index to the destination.
5. Create a restorable snapshot of the source catalog and the destination’s
   local catalog before merging.
6. Copy or merge the source catalog into the destination’s catalog root:
   - if the destination has no local catalog, copy the source catalog and rebase
     its paths;
   - if it has a local catalog, merge the source archive rows into it, preserve
     the local file rows and cache entries, and deduplicate by path/hash;
   - set the merged catalog’s `catalog_id` to the source `catalog_id`, and store
     the old local catalog ID as `previous_local_catalog_id`;
   - remap source file IDs to the destination catalog’s file IDs;
   - reuse the destination’s local cache for the promoted source; remap or
     rebuild source cache entries instead of copying old absolute cache paths;
   - preserve dates, manual overrides, duplicate memberships, hashes, and
     coverage history;
   - mark source files `source_membership = source` and destination-only files
     `local_only`; do not import destination-only files into the source archive;
   - warn that a destination with its own source identity will adopt the source
     archive identity, while its old local ID is kept as
     `previous_local_catalog_id`.
7. Set the destination’s `source_root_relative` from its layout:
   - `dedicated` → `Memory Lane\<archive folder>`;
   - `mirror_source` → empty.
   Rebase catalog paths from the old source root to the new source root.
   Preserve every replica’s `source_relative_path`, so coverage does not need
   re-matching.
8. Mark the new catalog `role = source`, set its active source volume ID to the
   new volume, update `drive_identity` to the new volume/serial, and update
   `scan_roots` to the new source root.
9. Mark the old source catalog `role = demoted_source`, not active as a source,
   and clear its active source volume ID. It may still update its local library
   as a destination.
10. Register the old source drive as a destination in the new source catalog:
   - `replica_layout = mirror_source` because its files are at its root;
   - `root_relative` set to that root;
   - `replica_goal` from the user’s choice, defaulting to `full_copy` when it
     still fits every source file and `extend_coverage` when the new source has
     outgrown it;
   - `status = active` or `retired` based on the user’s choice.
11. Keep or retire each existing 1 TB destination based on the user’s choice.
    Keeping it preserves its coverage and its marker. Retiring it keeps its
    history but excludes it from active coverage.
12. Update destination markers with the new source volume ID. The `catalogId`
    stays the same, so existing coverage remains valid.
13. Switch the app’s active catalog to the new source, refresh the source index
    with the new source root, and show a completion summary.

Promotion is metadata-only. It does not move or copy archive files again.

Rollback:

- Rollback is guaranteed only before the first change on the new source. A
  change includes a scan, metadata refresh, date override, import, backup run,
  or any other write to the new source catalog.
- Before that safe point, rollback re-activates the previous source catalog,
  restores the pre-promotion destination catalog snapshot, and leaves the new
  drive as a full-copy destination.
- After the first change, rollback is disabled unless the app can merge the new
  source changes back into the previous source. The UI warns before the first
  change that rollback will no longer be available.
- After permanent confirmation, the old source remains a demoted, non-active
  source catalog and a backup destination. The app must not treat it as an
  active source, but may update its local library.

### 8.12 Source growth and full-copy degradation

- The app compares present source bytes with each full-copy destination’s
  capacity after every scan and run.
- At 90% of a full-copy destination’s capacity, warn that the drive is
  approaching its limit.
- If the source grows beyond the capacity, mark the destination
  `full_copy_status = incomplete`, show the exact shortfall, and stop calling it
  a full backup.
- The destination remains a valid partial destination. Its existing files are
  never deleted.
- The planner may continue copying files that fit, but the destination is
  labelled partial until the user adds a larger drive or reduces the source.
- A new source that outgrows the old 4 TB drive follows the same rule: the old
  drive becomes partial with a warning.

### 8.13 Run shapes

The plan is built from the jobs that exist:

- **Full-copy job** — only if at least one active `full_copy` destination needs
  files or verification.
- **Partial job** — only if at least one active partial destination has
  capacity for uncovered files.
- **Both** — when both job types exist and are selected.
- **Neither** — no plan; show the empty state.

Rules:

- A full-copy destination is never created automatically, and its absence is
  not an error.
- A completed full copy is not re-run on every backup. If the source has not
  changed, the default run can be partial-only.
- A partial-only run does not reduce or invalidate the full-copy coverage.
- A full-copy-only run does not change the partial destinations.
- When both jobs run, the full-copy job runs first, then partial destinations
  in priority order. The user can select a scope to run one job only.
- The execution drawer shows only valid scopes:
  - “All connected work”;
  - “Full copy only” if a full-copy job exists;
  - “Partial coverage only” if a partial job exists.
- If every selected destination is offline, Start backup is disabled. The plan
  remains readable and the ranges remain reserved.
- If no active destination exists (none registered, or all retired/lost), the
  app shows the add-or-replace-destination state, not an empty plan.
- If no full copy exists, coverage labels must say **Partial drives only** and
  the remainder must say **Not covered anywhere**. The app must not show a
  100% all-destination claim.
- If a full copy exists but is offline, all-destination coverage is
  **last-known**, not live.
- If a full copy is complete, **All destinations** may be 100%; the partial
  drives are still reported separately.
- Promotion stays unavailable until a full-copy destination exists and is
  complete.
- Only one run may be active per source archive. A run is active while its
  status is `running`, `paused`, or `stopping`. Starting a second run opens the
  active run instead.
- Scan, validation, and replication are mutually exclusive heavy workloads.
  Starting a run while a scan or validation is active is blocked, and starting
  a scan or validation while a run is active is blocked. Browsing remains
  available.

Execution requires explicit confirmation of the plan.

## 9. Execution protocol

The executor copies one file at a time and one destination at a time. This is
slower but easier to reason about and resume.

For each planned file:

1. Re-check the source exists, size and modified time have not changed, and the
   expected source hash is still valid.
2. Re-check the destination identity, free space, reserve, and path.
3. Refuse to overwrite an existing file unless it is a confirmed stale replica
   at the expected path and the user approved replacement for this run, or the
   tracked replica is `missing` and no file exists at the path.
4. Write to a unique temporary file in the destination directory.
5. Stream-copy the source and hash the copied bytes.
6. If the source hash is known, compare the streamed hash with it. If it
   differs, the source changed: delete the temporary file, mark `stale`, stop
   that file. If the source hash is unknown, use the size and modified-time
   check in §9.1.
7. Rename the temporary file to the final path atomically on the same volume.
   For a stale replacement, keep the old file until the new file is verified.
8. Mark the replica `verified` after rename, the final size check, and the
   single-pass hash comparison. The temporary file is not read back inline;
   deep verification reads destination data later when requested.
9. Update the destination’s free-space accounting.
10. Update the destination’s local catalog and copy the source thumbnail or
    preview cache when available (see §9.6).

If the app exits or crashes, temporary files are cleaned on the next run and
are never counted as coverage. A file is not “backed up” because a copy was
attempted.

Crash recovery for `copied` rows:

- A `copied` row means the file was written but not yet marked verified.
- On startup, re-hash the final destination file if it exists.
- If it matches the source hash, mark it `verified`.
- If it does not exist, mark it `missing` and recopy.
- If it exists but does not match, mark it `stale` or `conflict` according to
  §7.3a and recopy only after approval.
- Never assume `copied` means coverage.

### 9.1 Source changes during a copy

- If the source hash is known and the streamed hash differs, discard the copy.
- If the source hash is not known, compare size and modified time before and
  after the copy. If either changed, discard the copy. If both are unchanged,
  the streamed hash becomes the source hash; store it in the `hashes` table
  with the observed size and modified time.
- Retry a changed source once. If it changes again, mark the file `stale` and
  continue with the next file.
- Never count a torn or partial copy.

### 9.2 Stale replacement

- A stale replica is a candidate for replacing on its **existing** destination
  first.
- The plan lists stale files. The user approves replacement once per run.
- Replacement is allowed only when a tracked replica row for the same source
  file and path exists with status `stale` or `missing`.
- The plan reserves peak space for the temporary new copy. It may use the
  reserve only under §5.5a, keeping at least 1 GiB free, and must show a
  warning automatically.
- If the replacement cannot fit even with the reserve exception, it is
  **blocked**. Do not silently assign it to another destination.
- The executor writes and verifies the new copy before replacing the old one.
- If replacement fails, the old file remains and the new attempt is marked
  `failed`.
- A `conflict` is a tracked or untracked path with different content. It is
  never replaced automatically and requires a separate review.

### 9.3 Failures

- A locked or unreadable file is retried up to three times with backoff, then
  marked `failed`; the run continues.
- A **partial** destination that runs out of space is paused; the remaining
  files are replanned to later partial destinations.
- A **full-copy** destination that runs out of space is marked incomplete. Do
  not silently replan its remaining files to partial destinations; that would
  break the full-copy goal. Ask for a larger drive or an explicit goal change.
- A failed file is reported at the end with its reason.
- A failed file does not block coverage of the files that succeeded.

### 9.4 Disconnect and resume

- Disconnect of the destination currently being copied: pause the run. The
  in-flight temporary file is discarded. Resume only when the same volume
  identity reconnects.
- Disconnect of a destination that has pending assignments but is not currently
  being copied: continue the current destination; the pending range waits.
- Source disconnect: pause the run. Never continue with a substituted source.
- A different volume mounted at the same letter or path must not be used.
- Completed verified files remain valid.
- A run can be paused and resumed without re-copying verified files.
- If the user chooses to continue with other connected destinations, the plan
  is recomputed and the chronology-breaking warning is shown.
- Closing the window does not silently cancel a run. The app minimizes to the
  tray or asks; the run continues in the background or pauses safely.
- Quitting the app pauses the run and records the state; on restart, the plan is
  recomputed from current coverage.

### 9.5 Run record

Every run records:

- start and finish time;
- source archive identity;
- destination snapshot and priority order;
- scope: entire source archive;
- planned, copied, verified, failed, stale, and remainder counts and bytes;
- the destination goal (`extend_coverage` or `full_copy`);
- full-copy shortfall, when applicable;
- errors and the reason the run stopped.

### 9.6 Destination local library updates

After each verified copy:

1. Insert or update the file in the destination’s local catalog.
2. Copy the source thumbnail and preview cache entries to the destination cache
   when they exist and were generated from the same source hash/version. Use
   the destination file ID for the cache path and insert the corresponding
   `cache_entries` rows. If the source hash/version does not match, regenerate
   instead.
3. If the source cache entry is missing, leave it pending; generate it on
   demand when the destination library is browsed.
4. Update the destination catalog’s file size, modified time, and hash.
5. Mark files that disappeared from the destination as missing.

Rules:

- Local library updates are derived. If they fail, the verified backup is still
  valid. Retry on the next run and show a warning.
- The local catalog must not be used to decide source coverage.
- The local catalog may include unrelated files. They are not counted as
  replicas.
- Destination-only files are updated in the local catalog but never inserted
  into `replica_files` or counted as source coverage.
- If a destination-only file disappears, mark it missing in the local catalog
  and the orphan record. Never delete the record automatically.
- Cache files are never copied to the destination as user files; they live
  under `.memorylane\cache` and are excluded from adoption.
- Temporary copy files named `.memorylane-tmp-*` are never adopted or counted
  as destination-only files. Clean them on startup and skip them in local
  library scans.
- If the destination already has a local catalog, update it in place. Do not
  create a second catalog.
- If the destination is also a source archive, its local catalog is its own.
  The backup files become part of that library, but the source archive’s
  coverage remains in the original source catalog.

### 9.7 Promotion execution

Promotion runs only after the guided flow in §8.11 is confirmed.

1. Re-check the destination identity, full-copy coverage, and zero shortfall.
2. Refresh the destination local library and source index.
3. Create a pre-promotion snapshot of both catalogs for rollback.
4. Copy or merge the source catalog into the destination catalog root. Preserve
   `catalog_id`, file records, dates, overrides, duplicate memberships, hashes,
   and replica coverage. If the destination already has a local catalog, merge
   its file and cache rows instead of replacing them, deduplicate by path/hash,
   remap source file IDs and cache entries to destination IDs, and store its old
   ID as `previous_local_catalog_id`. Reuse the destination’s local cache rather
   than copying old absolute cache paths. Mark source files
   `source_membership = source`; mark destination-only files `local_only`.
5. Rebase source paths from the old source root to the new source root. Keep
   `source_relative_path` unchanged on every replica.
6. Set `source_root_relative` from the destination layout: `dedicated` uses
   `Memory Lane\<archive folder>`, `mirror_source` uses empty.
7. Set the new catalog role to `source`, update `drive_identity` to the new
   volume/serial, update `scan_roots` to the new source root, and mark the old
   catalog `demoted_source`, not active as a source. Clear the old catalog’s
   active source volume ID.
8. Register the old source as a destination with
   `replica_layout = mirror_source`, its root, and full-copy or partial goal.
9. Apply the user’s keep/retire choice to each existing partial destination.
10. Update destination markers to the new source volume ID; keep the same
    `catalogId`.
11. Switch the active catalog, refresh the source index with the new source
    root, and publish the new roles.

Failure handling:

- If any step fails before the active-source switch, restore the pre-promotion
  catalog snapshots. The old source remains authoritative and the new drive
  remains a destination. The verified archive files are safe; a partially
  merged destination catalog is not.
- If the active-source switch succeeds but the user chooses rollback before the
  first change on the new source, restore the snapshots, reactivate the old
  source, and return the new drive to a destination.
- After the first change on the new source, rollback is disabled unless the app
  can merge the new changes back into the old source. The UI must warn before
  that first change.
- A duplicate active source with the same `catalog_id` must be blocked.

### 9.8 Source index snapshot

- Write the source index to
  `.memorylane\replicas\<catalog-id>\index.db` after adoption and after each
  run.
- Use a compact SQLite database or an equivalent read-only format. SQLite is
  recommended for queryability.
- Contents: source catalog ID, source label, source root, generated timestamp,
  file relative path, size, SHA-256 when known, resolved date, media class, and
  whether the file is present and verified on this destination at snapshot time.
- The index is destination-specific: each drive records its own local presence
  and verification state.
- The index contains no thumbnails and no destination-specific cache.
- The index is a snapshot. The UI must show its timestamp and must not present
  it as live coverage.
- If the index is missing or corrupt, rebuild it from the source catalog. If the
  source catalog is lost, the destination’s local library and a scan remain the
  recovery path.

### 9.9 Run entry, re-entry, and plan locking

A run is active while its status is `running`, `paused`, or `stopping`. There is
at most one active run per source archive. A second Start backup request opens
the active run instead of starting another.

**Starting and returning**

- Starting a run opens the run screen. The app does not rely on browser history
  or a transient toast for this.
- While a run is active, every screen shows a persistent **Backup running**,
  **Backup paused**, or **Backup interrupted** status with the current
  destination and percent. The status opens the run screen.
- The overview shows a run banner with progress, current destination, remaining
  time, **View progress**, and **Pause** or **Resume**.
- The plan screen shows a run banner with **View progress**; the plan itself is
  read-only.
- Destination detail and promotion show the same status. Promotion is blocked
  while a run is active.
- If the app reopens and the run is still running in the background, open the
  run screen. If the run was paused, open the overview with a **Resume backup**
  card. Never silently start a new run.
- A tray item or desktop notification may open the run screen. Dismissing it
  does not cancel the run.
- Switching to another source archive is blocked while the run is running or
  paused. The UI says “Pause or finish the backup before switching drives.”
  The main process enforces the same rule.
- Starting a scan or validation is blocked while a run is active, and starting a
  run is blocked while a scan or validation is active.

**Plan locking**

While a run is active, disable:

- Start backup and any new run;
- destination goal, allocation, reserve, layout, root, priority, and
  keep/retire/remove;
- re-adoption and deep verification that would change active coverage;
- promotion;
- import actions that would write into the source archive.

Allow:

- pause and stop-after-current-file;
- viewing progress, plan, destination detail, and run status;
- adding a new destination, queued for the next plan.

A disabled control must say why. Use “Pause the backup to change the plan” for
plan and destination edits, and “Finish or stop the backup before promoting” for
promotion. Do not hide the control without an explanation.

**Editing after pause**

- Pausing unlocks **Edit plan** and destination settings. A plan edit requires
  confirmation and applies only to remaining work.
- Verified files are never recopied, re-hashed unnecessarily, or moved.
- Existing destination files are never moved between destinations.
- A destination removed from the plan keeps its files. Its pending assignments
  are redistributed only for files that are still uncovered.
- If the source or a destination changed while paused, replan from current
  coverage.
- The run gets a new `plan_revision` and an audit event. The history of already
  verified files is not rewritten.
- Resuming with a changed plan recomputes the remaining assignments and shows
  the recomputed remainder before copying continues.
- Stopping a run sets `stopping`; after the current file the run becomes
  `stopped`. Verified files stay, and plan edits are then unlocked.
- Adding a destination while a run is active does not change the active plan.
  The UI says it will be included in the next plan.
- Promotion requires no active run, even if the run is paused.

## 10. Conflicts and failure handling

| Situation | Required behavior |
|---|---|
| Destination path exists with same hash | Adopt/mark verified; do not copy. |
| Destination path exists with different hash | On first adoption, mark `conflict` and never overwrite. If a prior verified replica exists and the source/destination changed, mark `stale` and allow replacement after approval. |
| Destination has same content at a different path | Adopt if one-to-one matching is unambiguous. |
| Destination has multiple source files with the same hash | Require path/name match; otherwise report ambiguous. |
| Source has duplicate content at different paths | Treat each source path as a separate file; back up both. |
| File does not fit remaining allocation | Do not copy; advance to the next destination. |
| File is incompatible with the current destination | Try later destinations for this file; otherwise list as a gap. |
| Free space would fall below reserve | Stop copying to that destination; replan remaining files. |
| Destination filesystem cannot hold the file size (for example FAT32 4 GiB limit) | Mark incompatible; report it. |
| Destination path is too long or invalid | Mark incompatible; report it. |
| Destination path is a directory | Mark `conflict`; do not overwrite; report it. |
| Source file changed before or during copy | Mark stale; do not count the old copy; retry once, then report. |
| Source file changes while its source hash is being calculated | Discard the hash, retry once, then report the file as unstable. Never store a torn hash. |
| Source file is renamed or moved | Keep coverage by `file_id`; update `source_relative_path` only after the destination copy is verified. |
| Destination file changed or is missing | Mark stale/missing; verify before re-copying. |
| Permission denied / file locked | Retry with backoff; after the retry limit mark failed and continue. |
| App crash or power loss | Delete temporary files on recovery; retain verified rows only. |
| System sleep or hibernate | Pause; discard a partial temporary file; verify the current file on resume. |
| Destination resized, reformatted, or replaced | Volume identity may change; try the marker’s `destination_id` first, otherwise require confirmation and re-adoption. |
| Destination currently being copied disconnects | Pause; discard the in-flight temporary file; resume on the same identity. |
| Pending destination disconnects | Continue the current destination; the pending range waits. |
| Source disconnects | Pause; never substitute another source. |
| User changes allocation during a run | Blocked. Pause, confirm the plan change, and resume. Verified files stay; `plan_revision` increments. |
| User reorders destinations during a run | Blocked. Pause, confirm the new order, and resume; existing files stay. |
| User adds or removes a destination during a run | Adding is queued for the next plan. Removing or retiring is blocked until pause. The active plan is never changed silently. |
| User starts a second run | Open the active run; do not start another. |
| User opens promotion during a run | Block; promotion requires no active run, including paused. |
| App restarts during a run | Resume the run screen if the run is still running; show a resume card if paused. Never start a new run automatically. |
| Source file deleted during backup | Keep existing replicas; source becomes missing; report the state. |
| Unverified copies on an offline destination | Do not count; wait for verification or require an explicit “copy anyway” choice. |
| Destination is on the same volume as the source archive, or their roots overlap | Hard reject. A destination must never be on the source volume or share an overlapping root. |
| Destination is also an active source archive | Reject in the first release. Dedicated destinations are required; dual-role support is deferred. |
| Destination contains another source archive’s marker | Reject; one source relationship per destination in the first version. |
| Full-copy destination cannot fit the source | Show the shortfall; do not label it full; allow partial copying only with an explicit choice. |
| Full-copy destination runs out of space during a run | Mark it incomplete; do not spill its remaining files to partial destinations. |
| Stale replacement needs temporary reserve space | Allow only under §5.5a, keep at least 1 GiB free, warn automatically, and never use the reserve for new files. |
| Source grows beyond a full-copy destination | Mark it incomplete/partial, keep existing files, show the shortfall, and suggest a larger drive. |
| Promotion requested with stale, missing, failed, or remainder files | Block promotion; keep the old source active. |
| Promotion destination disconnected | Block promotion; keep the old source active. |
| Duplicate active source catalog ID | Block; require one active source and mark the other `demoted_source`. It may still update its local library. |
| Destination local catalog update fails | Verified backup remains valid; retry later and show a warning. |
| Source index write fails | Backup remains valid; retry later and show a warning. |
| Promotion catalog merge fails | Restore the pre-promotion snapshots. The archive files are safe; do not leave a partially merged local catalog. |
| A `.memorylane-tmp-*` temporary file is found | Never adopt it or count it as destination-only. Clean it during startup/recovery. |
| Destination file has no matching source file | Record as an extra; show under **Only on this drive**; never copy or delete automatically. |
| Destination file matches multiple source files | Record as ambiguous; show for review; do not guess or copy. |
| Source file is missing but a verified replica exists | Report it as a **Source missing** attention count. Do not restore into the source archive or expose reveal/open in this release. |
| Destination-only file is inside the source root during promotion | Report it; do not import it automatically. The user may keep it as a local extra or exclude it from the new source. |
| Destination-only file disappears | Mark it missing in the local catalog; keep the orphan record for history. |

## 11. Filesystem, paths, and destination layout

### 11.1 New copy location

New copies use the destination’s layout:

```text
dedicated:     <destination root>\Memory Lane\<archive folder>\<source-relative path>
mirror_source: <destination root>\<source-relative path>
```

Example:

```text
F:\Memory Lane\4TB Archive\Photos\2018\2018-07 Trip\IMG_1234.jpg
```

- Store two paths for every replica:
  - `relative_path` — relative to the destination root, for locating the file;
  - `source_relative_path` — relative to the source root, for stable coverage
    matching.
  For a new copy, `relative_path = copy_root_relative + source_relative_path`.
  For an adopted manual copy, infer `source_relative_path` from the matched
  source file.
- Existing destination files stay exactly where they are. Adoption scans the
  whole destination root and finds them regardless of their paths.
- The dedicated folder keeps new copies separate from the user’s manual layout.
- The `archive folder` is stored at first use, normally a sanitized version of
  the source archive label. Sanitize invalid characters, trim trailing dots and
  spaces, and cap the length. If the name is empty or collides with an unrelated
  folder, append a short catalog ID. Renaming the source archive does not
  rename the folder or split future copies.
- The folder is created only when the first new copy is about to be written.
- If the destination root is a subfolder, the dedicated folder is inside it.
- A destination root of the drive root is recommended for reorganized drives.
- Source-relative paths are computed from the source archive root resolved by
  volume identity for the current connection, not from a stored drive letter.
- Path-length checks include the `Memory Lane\<archive folder>` prefix.

### 11.2 Path rules

- Store destination paths relative to the destination root. Never store drive
  letters or mount-point prefixes. This includes the destination’s local
  catalog path and source-index path; resolve them against the drive root at
  runtime.
- Reject absolute paths, `..` segments, and any path that resolves outside the
  destination root.
- Check:
  - filesystem maximum file size;
  - invalid or reserved names;
  - trailing dots and spaces;
  - case-insensitive collisions;
  - path length limits;
  - existing destination files with different content.
- On case-insensitive filesystems, compare paths case-insensitively and store
  the actual on-disk casing. Enforce the uniqueness of `relative_path` with a
  case-insensitive comparison on those systems.
- Never write through a path that resolves outside the destination root, even
  if a symlink or junction would allow it.
- FAT32 destinations require special handling for files over the filesystem
  limit.
- Network destinations are out of scope for the first implementation.
- Do not follow symlinks, junctions, or reparse points outside the destination
  root.
- The source archive’s known `.memorylane` catalog and cache paths are never
  copied. Do not skip an unrelated `.memorylane` folder wholesale.
- Skip filesystem metadata folders such as `System Volume Information` and
  `$RECYCLE.BIN` on both sides.
- The model allows a drive that is itself a source archive to also be a backup
  destination, but the first release rejects an active source as a destination.
  Dual-role is deferred; when it lands, reuse its local catalog instead of
  creating a second catalog. The backup folder may be excluded from that drive’s
  own source scope when appropriate.

### 11.3 Destination root

- A destination is a mounted volume, not a physical disk. A drive with multiple
  partitions appears as multiple destinations.
- A destination for an archive must not be on the same volume as that archive’s
  source root, and the source and destination roots must not contain each
  other. The app hard-rejects this; it is not a warning.
- A drive may still be a source for its own local library and a destination for
  a **different** archive.
- The destination root is the folder the user selects on the volume. It may be
  the drive root or a subfolder such as `Backup`.
- All relative paths are resolved from that root, and the root is stored with
  the destination record.
- If the existing files sit under several top-level folders, use the drive root
  as the destination root. The app must not guess silently.
- Changing the root later is an explicit re-registration; existing coverage is
  re-adopted, not discarded.

### 11.4 Volume identity confidence

The current volume ID is derived from serial number, label, filesystem, and
capacity. Two identical 1 TB drives with no serial number and the same label can
collide. Destination identity therefore needs a second factor:

- On first registration, write a random `destination_id` to the destination
  marker and store it in `replica_destinations`.
- On connection, read the destination marker before computing a new identity. A
  matching `destination_id` re-binds the volume even if its label, serial, or
  capacity changed.
- When the marker exists and its `destination_id` matches, identity is
  confirmed even if the hardware fingerprint changes.
- When the marker is missing, require the user to confirm the destination when
  more than one registered destination has the same volume ID or the same label
  and capacity.
- Never merge coverage between two destinations because their volume IDs
  collide.
- If two connected volumes share a `destination_id`, do not use both in one
  run. Ask the user to resolve the clone.
- Drive-letter changes update only the cached mount point; relative paths and
  coverage are unchanged.
- Report identity confidence in the destination card: `confirmed`, `probable`,
  or `needs confirmation`.

### 11.5 Catalog root and source root

- The app’s catalog stays at the drive’s catalog root:
  `<drive root>\.memorylane\catalog.db`.
- New copies go under the dedicated or mirror layout:
  - dedicated: `<destination root>\Memory Lane\<archive folder>\<source-relative path>`;
  - mirror: `<destination root>\<source-relative path>`.
- When a dedicated destination is promoted, its **source root** becomes
  `<destination root>\Memory Lane\<archive folder>`.
- When a mirror destination is promoted, its source root is the destination
  root.
- The catalog root does not move. The app stores
  `source_root_relative = Memory Lane/<archive folder>` and applies it to
  coverage, planning, and the source library view.
- The destination’s local library may include files outside the source root.
  The source archive view filters to the source root.
- If the user chose a mirror layout, the source root is the destination root
  instead. The same rules apply with `source_root_relative` empty.
- Promotion never moves archive files. It only changes the source root and
  catalog role.
- The source root must be inside the catalog root. The app rejects a source root
  outside the drive’s catalog root.
- The `.memorylane` folder at the catalog root is excluded from the source
  scope and from the local library.

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

## 13. UI specification

### 13.0 Reviewed presentation

The first mockups exposed too much at once. The reviewed flow is:

```text
Overview → Plan (execution drawer) → Running
```

- **Overview** is also the coverage screen. It shows the source, the
  destinations that exist, coverage summaries, and one **Needs attention**
  card. A full-copy destination is not required.
- **Plan** content is read-only. It shows the jobs that exist: full copy, partial
  coverage, or both. **Start backup** opens an execution drawer; there is no
  separate execute page. Destination order uses a small sheet.
- **Running** is focused on progress, run order, waiting offline ranges, and
  controls. Local-library and replacement details live in destination detail.
- **Destination detail** is one page per destination, including partial and
  full-copy destinations. The current release shows Overview only; Files and
  History are deferred. Overview combines adoption, coverage, attention counts,
  settings, and media.
- **Promotion** is a four-step wizard: verify, review extras, choose fates, and
  confirm. The destination is chosen by entering promotion from a complete
  full-copy destination.
- **Add destination** is a two-step drawer from Overview.

Running state is part of every screen:

- A persistent **Backup running**, **Backup paused**, or **Backup interrupted**
  status opens the run screen. It shows the current destination and percent.
- Overview adds a run banner with progress, **View progress**, and **Pause** or
  **Resume**.
- Plan shows a run banner and **View progress**; Start backup is disabled.
- Destination settings and promotion are locked while the run is running. After
  pause, destination settings and **Edit plan** unlock; promotion stays blocked
  until the run is finished or stopped.
- The UI says “Pause the backup to change the plan.”
- After pause, changes apply to remaining work only; verified files are never
  recopied or moved.
- Adding a destination during a run is queued for the next plan.

This subsection supersedes page-level layout details below where they conflict.
The requirements for what must be shown and verified still apply.

Coverage labels must name their scope explicitly. Do not place “partial union”
next to “union coverage” and expect the difference to be obvious. Use:

- **8TB full copy** — files verified on the full-copy destination;
- **Partial drives only (A+B)** — union across partial destinations;
- **All destinations** — union across every destination, including full copies.

The 8TB full copy can make all-destination coverage 100% while partial drives
remain around 50%. The UI must say that in words, not only with bars.

Reviewed mockups: `ui-mockups/replication.html`,
`ui-mockups/replication-plan.html`, `ui-mockups/replication-run.html`,
`ui-mockups/replication-destination.html`, and
`ui-mockups/replication-promotion.html`.

### 13.1 Destination card

The overview card is a summary. It is not a settings page.

- Label, current mount, and filesystem.
- Goal badge: **Partial** or **Full copy**.
- State: connected, offline with last-seen time, retired, or lost.
- For partial destinations: fill order (“Fills first”, “Fills next”).
- Capacity, verified bytes, available for new copies, and a last-known
  qualifier when offline.
- One attention line: only-on-drive count, source-missing count, or full-copy
  shortfall. Do not repeat separate attention sections on the card.
- Full-copy status: complete, incomplete, or in progress, with the shortfall.
- Identity confidence only when it is not `confirmed`; otherwise show it in
  detail. A `needs confirmation` destination is a warning on the card.
- No allocation controls, date map, local library, source index, or maintenance
  actions on the card. Those live in destination detail.

### 13.1a Destination detail

One page for every destination, including full-copy destinations. The current
release shows the **Overview** only; destination file browsing, history, and
reveal/open actions are not exposed.

**Overview**

- Identity and allocation: volume ID, filesystem, destination root, goal,
  layout, allocation mode, reserve, identity confidence, and source-index path.
- Coverage and local library: verified files and bytes, safe-to-add space,
  overlap, local-library file count, backup coverage map, source-index timestamp,
  and cache status.
- For a full-copy destination: full-copy status, verified bytes, shortfall,
  promotion readiness, and a link to promotion when complete.
- Destination settings: change the goal between partial coverage and full copy.
  Changes apply to future plans and are locked while a run is running.
- Adoption controls: start, pause, resume, and re-adopt the drive.
- Warnings for over budget, reserve below the floor, free space below reserve,
  stale replacement reserve use, read-only destination, or a full copy that no
  longer fits.
- **Only on this drive** and **Source missing** counts. They are not clickable
  file lists in this release.

**Files and History**

Destination file browsing, destination history, and reveal/open actions are
deferred. The source catalog is never used to answer destination-library
queries, and destination detail shows only aggregate counts and health.

Example:

```text
Backup A (F:)                         confirmed
Partial · fills first · connected
NTFS · 1 TB · 800 GB verified · 161 GB available · reserve 19 GB
F:\ · new copies F:\Memory Lane\4TB Archive
Coverage: 2005–2023, mixed (backup map / local library toggle)
Local library: 12,345 files · cache ready
Source index: updated today 14:32
Only on this drive: 42 files · 3.2 GB
Source missing; backup copy exists: 3 files
```

### 13.2 Destination order

- Reorder is available from the plan’s partial-coverage card. It opens a small
  sheet, not a separate page.
- Reordering is disabled while a run is running. The UI says “Pause the backup
  to change the plan.”
- The sheet shows the current order and links to each destination’s date
  coverage map. It does not repeat every map inline.
- The first row is labeled “Fills first with oldest uncovered files”.
- Later rows are labeled “Fills next”.
- A reorder warning explains that existing files are not moved and date
  coverage may overlap.

### 13.3 Plan screen

The plan content is read-only. It shows only the jobs that exist. Changing the
destination order uses the separate order sheet in §13.2.

- Header: entire source archive, file count, bytes, undated count, and the order
  “Oldest first · undated files last”.
- Run order: full copy first, then partial destinations in priority order.
- **Full copy** card, only when a full-copy destination exists:
  - destination, capacity, source bytes, shortfall, and whether it fits;
  - verified/new files and bytes, free after, and promotion readiness.
- **Partial coverage** card, only when a partial destination exists:
  - rows in priority order with adopted/verified bytes, new files/bytes, the
    date range of the **new** files, free after, reserve, and offline state;
  - the existing date coverage map is linked, not repeated. The new-file range
    and the existing range are shown separately.
- If only one job exists, do not render an empty section. If neither exists,
  show the add-destination empty state.
- Capacity accounting uses all present replicas, including unverified ones.
  Coverage accounting uses verified replicas only. The screen must label the
  difference so the numbers are not confused.
- One short **Things to know** warning line for stale replacement. Add other
  warnings only when they apply: undated metadata, offline unverified copies,
  chronology-breaking mode, source growth, and full-copy shortfall.
- Projected coverage uses explicit scope labels: **8TB full copy** and
  **Partial drives only (A+B)**. Show **All destinations** only when a full copy
  exists. Do not show a redundant union bar.
- Main action: **Start backup**. It opens the execution drawer. The plan content
  never starts copying directly.
- Execution drawer:
  - starts now, waits for offline destinations, and partial remainder;
  - scope: all connected work, plus full copy only and/or partial coverage only
    when those jobs exist;
  - one **Start backup** action after confirmation;
  - disabled when every selected destination is offline or no destination
    exists.
- A **Promote to source** action appears only when a full-copy destination is
  complete.
- When a run is active, disable Start backup and show a run banner with
  **View progress**. The plan is locked; **Edit plan** appears only after pause.
- Confirmation is required. The app never starts copying from this screen
  automatically.
- The plan does not show per-destination full date maps. They are one click away
  in destination detail.

Example:

```text
Entire source archive · 25,717 files · 3.8 TB · 0 undated
Oldest first · undated files last

Full copy
  8TB Archive (H:) · new 3.8 TB · 0 shortfall · 3.24 TB free after

Partial coverage
  Backup A (F:) · 800 GB verified · new 161 GB · 2000–2004 · 19 GB free after
  Backup B (G:) · 700 GB last-known · new 261 GB · waits for reconnect

Partial remainder: 1.89 TB
[ Start backup ]
```

### 13.4 Run screen

The run screen is a stable destination, not a transient page.

- Current destination and file.
- Progress by files and bytes, against both the plan and the whole archive.
- Full-copy progress separately from partial coverage.
- Run order: full copy first, then partial destinations in priority order. Show
  active, pending, and offline states.
- Speed and estimated time remaining.
- Pause and **Stop after current file**. Pause applies to adoption, planning,
  and copying.
- Plan lock note: “Plan changes are locked while running. Pause to edit.” The
  note explains why controls are disabled; it does not open an editable plan.
- Compact run notes: source stays read-only, the offline range is reserved,
  crash or disconnect discards temporary files, extras stay local, and restore
  into the source is unavailable in the first release.
- Local library and cache status are summarized. Details live in destination
  detail. A failed update appears as a warning banner with a link.
- Error list with retry actions, only when errors exist.
- Completion summary: whether the run completed or was stopped, verified now,
  pending on offline destinations, failed, partial remainder, full-copy
  shortfall, and promotion readiness. Never say “fully backed up” when a
  remainder exists or a full copy is incomplete.
- Navigation: **Back to overview**, **View plan** (read-only), and the
  persistent run status. The plan is not editable until pause.
- If the app reopens with a paused run, show **Resume backup**. If the run is
  still running in the background, show the live run instead of a new run.

### 13.5 Coverage surface

Coverage is the Overview screen. It is not a separate primary page.

- Source strip: label, mount, file count, bytes, read-only state, and coverage
  as-of timestamp.
- Three headline stats:
  - partial coverage today (union of partial destinations);
  - partial remainder today (not on any partial destination). When no full copy
    exists, label it **Not covered anywhere** and keep the projected post-fill
    number in the plan;
  - full-copy plan (target, capacity, shortfall) or **No full copy**.
- Destination cards, following §13.1.
- One **Needs attention** card combining, as separate rows:
  - only-on-drive counts per destination, with Review links;
  - source-missing counts per destination, with Review links.
- A coverage note explaining union counting and intentional full-copy overlap.
- A run banner when a run is active or paused, with **View progress** and
  **Pause** or **Resume**.
- “Coverage as of” timestamp.
- Overview actions: **Add destination**, **Review plan**, and **View progress**
  when running.
- Detailed overlap, stale, missing, conflict, ambiguous, local-library, and
  source-index sections are not repeated on Overview. They live in destination
  detail, reached from the attention rows.
- The app does not imply that one drive is the “older” drive. Fill order and
  date coverage are separate concepts.

Wording examples:

- “39% of the source is on Backup A + B”
- “2.31 TB is not on Backup A or B today; 1.89 TB remains after both fill”
- “8TB Archive has a complete full copy; ready to promote”
- “Old 4TB is no longer a full copy: 320 GB of newer files do not fit”
- “12 GB is on both partial drives” (expected overlap; counted once)
- “The 8TB full copy intentionally duplicates files from A and B”
- “42 files are waiting for Backup A to reconnect”
- “3 conflicts need review”
- “42 files are only on Backup A; they are not in the source archive”
- “5 files were previously in the source archive but are no longer there”
- “3 files are missing from the source archive but have a backup copy”
- “Coverage last verified today at 14:32”
- “Source index last updated today at 14:32”
- “Backup running · 42% · 8TB Archive (H:) · View progress”

### 13.6 Promotion screen

Destination detail (§13.1a) shows the local library, source archive role, and
backup destination role separately. A demoted source that is also a destination
shows both roles without merging them. An active source cannot be a destination
in the first release.

The promotion screen is a four-step wizard. The destination is already chosen by
entering promotion from a complete full-copy destination. There is no separate
destination-picker step.

1. **Verify** — destination fixed and shown as connected with confirmed
   identity; source bytes, destination capacity, reserve, headroom, verified
   files/bytes, stale/missing/conflict/failed/remainder counts, and the final
   shortfall. Offer deep verification.
2. **Review extras** — destination-only files, including those inside the new
   source root. Leave them out of the new source archive; mark them `local_only`
   so they stay visible in the local library. Do not import or delete them
   automatically.
3. **Choose fates** — old source:
   - keep as full-copy destination (default when it still fits);
   - keep as partial destination;
   - retire after verification (keeps files and history; no separate inactive
     option).
   Existing 1 TB destinations: keep as partial or retire for each. Unchecking
   retires; files remain.
4. **Confirm and complete** — summary; explicit confirmation; promote. After
   promotion show the new source, demoted old source, updated roles, and a
   rollback action guaranteed only until the first change on the new source.
   Warn before that first change.

Promotion is blocked while a run is active, including paused.

Promotion warnings:

- “The new source has 3.8 TB; the old 4 TB drive has 3.6 TB free after reserve.
  It can still hold a full copy.”
- “The new source has 4.1 TB; the old 4 TB drive can no longer hold a full copy.
  It will become a partial destination.”
- “Backup A will remain a partial destination. Backup B will be retired.”
- “This changes the active source. Until you confirm, you can roll back.”
- “Promotion is unavailable while a backup is running. Pause or finish it
  first.”

## 14. Acceptance criteria

- The plan covers the entire present source archive without per-file selection.
- A partial-only archive with no full-copy destination can be planned and run;
  coverage is labelled **Partial drives only** and the remainder is **Not
  covered anywhere**.
- A full-copy-only archive with no partial destinations can be planned and run.
- A completed full copy can be excluded from a later run; a partial-only run
  works and does not invalidate the full copy.
- A drive that is currently an active source archive cannot be registered as a
  destination in the first release. The app rejects it with a clear message.
- Scan, validation, and replication are mutually exclusive. Starting one while
  another is active is blocked with a clear reason.
- Switching the source archive is blocked while a run is running or paused.
- Stopping a run after the current file produces `stopped`, keeps verified
  files, and allows the run to be resumed later.
- Promotion is unavailable without a complete full-copy destination.
- With no destinations, the app shows an add-destination empty state and Start
  backup is disabled.
- With every selected destination offline, the plan is readable but Start
  backup is disabled.
- A running or paused backup is reachable from every screen through a
  persistent status that opens the run screen.
- Reopening the app during a run never starts a second run. It resumes the run
  screen if the run is still running, or shows a resume card if paused.
- At most one run is active per source archive. A second Start backup request
  opens the active run.
- Plan changes are locked while the run is running. Pause unlocks **Edit plan**
  and destination settings; changes apply to remaining work and never recopy or
  move verified files.
- Adding a destination during a run is queued for the next plan. Removing or
  retiring a destination is blocked until pause.
- Promotion is blocked while a run is active, including paused.
- Destination detail is one page for partial and full-copy destinations.
- The overview does not repeat detailed overlap, stale, conflict, ambiguous, or
  local-library sections; those live in destination detail.
- The plan shows new-file ranges and links to destination date maps. It does not
  repeat every destination’s full date map.
- Coverage labels always name their scope. The app does not show 100%
  all-destination coverage when no full copy exists.
- Files are assigned oldest-to-newest; undated files come last.
- The first destination in fill order receives the oldest **uncovered** files;
  the second continues after the first is full, except for reported per-file
  incompatibilities.
- Existing destination files are never moved to create cleaner date ranges.
- Each destination’s date coverage is shown as a map in destination detail, not
  as a single clean range, when the coverage is mixed or non-contiguous.
- Date coverage maps distinguish verified backup coverage from the destination’s
  local-library contents.
- The app never claims that the first destination contains older files than the
  second. Fill order and existing date coverage are separate concepts.
- Existing destination files are adopted without being re-copied, moved, or
  reorganized.
- Adoption works when the marker file is missing.
- Adoption works when destination paths differ from source paths.
- A destination allocation includes adopted files, including unverified files
  that consume space.
- A destination with an existing local catalog reuses it instead of creating a
  second catalog.
- Each destination can be opened on its own and browsed through its local
  library catalog and cache.
- The destination cache contains only local files, not a full copy of the
  source cache.
- The source index is present, timestamped, and readable without the source.
- A full-copy destination receives every present source file, even when partial
  destinations already cover it.
- A full-copy destination that cannot fit the source shows the exact shortfall
  and is not labelled full.
- A source that grows beyond a full-copy destination marks it incomplete and
  shows what is missing.
- Promotion is available only for a complete full-copy destination with zero
  stale, missing, conflict, failed, or remainder files.
- Promotion preserves `catalog_id`, dates, overrides, duplicates, and coverage.
- Promotion makes the new drive the active source and the old source a demoted,
  non-active source catalog that may still be used as a local library.
- The old source becomes a full-copy or partial destination based on capacity.
- Existing 1 TB destinations can be kept as partial or retired after promotion.
- Only one source catalog per archive identity is active.
- Promotion can be rolled back before the first change on the new source.
- A demoted source can be registered as a destination without merging its
  catalog into the new source catalog. Active-source dual-role is deferred.
- The new source root can be the dedicated `Memory Lane\<archive>` folder
  without moving the archive files.
- A source-root change preserves each replica’s `source_relative_path`, so
  existing coverage remains valid without re-hashing or re-adoption.
- The destination local catalog and source index can be rebuilt by scanning if
  lost.
- "Use all safe space" never goes below the configured reserve for new copies.
  A stale replacement may use the temporary exception in §5.5a, but never below
  1 GiB free.
- A file cannot be assigned to two **partial** destinations in one plan. A
  full-copy destination may intentionally receive a file already on a partial
  destination.
- A source file with a verified replica on a partial destination is never
  copied to another partial destination. It may be copied to a full-copy
  destination by design.
- A source file without a hash is hashed before its replica can count as
  covered.
- A destination on the same volume as the source archive, or with overlapping
  source/destination roots, is hard-rejected.
- Union coverage does not double-count overlapping copies.
- Two identical destination drives are never merged because their volume IDs
  collide.
- Destination-only files are reported under **Only on this drive**, shown in the
  destination local library, never counted as source coverage, never copied to
  the source or another destination automatically, and never deleted
  automatically.
- Ambiguous destination files are reported for review and never guessed.
- Source-missing replicas are reported in the **Source missing** attention
  category with counts. The current release exposes no restore or reveal/open
  action and never writes restored files into the source archive.
- The local-library date map includes destination-only files; the backup
  coverage map excludes them.
- Promotion leaves destination-only files out of the new source archive, keeps
  them visible in the local library, and never imports or deletes them
  automatically.
- Promotion rollback is guaranteed only before the first change on the new
  source; after that it is disabled or requires a merge.
- Source-missing replicas are never written back into the source archive in the
  first release; they are reported as attention counts.
- Source coverage and planning use only `source_membership = source` files;
  local-library-only files are excluded.
- The plan lists every candidate as planned, a gap, or the remainder.
- The run reports the exact remainder and never claims full coverage.
- An offline earlier destination keeps its chronological range waiting; later
  destinations do not steal it in the default mode.
- A destination with insufficient space is skipped and the next destination is
  tried.
- A source file changed during copy is not marked verified.
- A crash mid-copy never leaves a partial file counted as coverage.
- Disconnect and reconnect resume without duplicating verified files.
- Path conflicts never overwrite an existing destination file.
- Stale files are replaced only after a once-per-run approval, on their
  existing destination first.
- A stale replacement may use the reserve only under §5.5a, keeps at least
  1 GiB free, and shows a warning.
- A first-adoption different-hash file is a conflict and is never overwritten.
- A full-copy destination that runs out of space is marked incomplete and does
  not spill its files to partial destinations.
- FAT32 size limits, path length, and case collisions are reported.
- New copies go under `Memory Lane\<archive folder>`; existing files stay put.
- Coverage, gaps, stale, missing, overlap, conflicts, and the remainder are
  visible in the UI.
- Source files remain unmodified; only the source archive’s catalog database is
  written.

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

## 18. Known limits

- The first implementation is Windows-first. The path model is mount-relative,
  so macOS can be added later, but the volume-detection layer needs its own
  port.
- Copying is sequential: one file and one destination at a time.
- There is no block-level deduplication. Identical source files at different
  paths are backed up per path.
- Orphan cleanup is manual and out of scope.
- Destination-only files are local to the destination and are not part of source
  coverage. They are never copied to the source or other destinations
  automatically.
- Destination file browsing, destination history, and reveal/open destination
  item actions are not exposed in the current UI; destination detail shows
  aggregate health, coverage, local-library counts, and destination media.
- Restoring a source-missing replica is deferred. The first release never writes
  into the source archive from a replica.
- Extra-file detection depends on the source catalog and source index. A stale
  index is labelled, and files from before the catalog may appear as extras.
- Promotion reports extras inside the new source root but does not import them
  automatically.
- Intentional second copies are limited to full-copy destinations. Selected
  duplicate copies on partial destinations remain future work.
- Bit rot or tampering that preserves size and modified time is only detected
  by deep verification.
- Copy verification is single-pass. A post-write corruption that survives the
  destination size check is detected by a later deep verification, not inline.
- A large file with only a quick fingerprint is fully hashed when a duplicate,
  moved-file, adoption, or copy candidate needs it. A catalog-wide rehash is not
  required, and existing full hashes are never downgraded.
- Moved-file detection is exact only when both sides have full SHA-256 hashes.
  Large quick-only files may require deep hashing before a move can be
  confirmed.
- Adoption matches reorganized copies by content hash. A large quick-only source
  file may need its full hash before a renamed, reorganized copy can be matched
  by content rather than by path or name.
- Only one source catalog per archive identity may be active.
- The source archive must be connected to plan or execute a run.
- The feature does not back up the source catalog itself as a user file; the
  existing database backup covers it.
- A full-copy destination can only be full while it fits the source. Source
  growth automatically makes it partial with a warning. If it runs out of space,
  it is marked incomplete and does not spill to partial destinations.
- Promotion is metadata-only after a complete full copy. It does not move or
  re-copy archive files.
- Rollback is guaranteed only before the first change on the new source. After
  that, it is disabled unless a merge-back feature exists.
- Source-missing replicas are never restored into the source archive in the first
  release and are reported only as attention counts.
- A first-adoption different-hash file is a conflict, not a stale copy, and is
  never overwritten automatically.
- The 1 GiB reserve floor applies only to temporary stale replacement space; new
  copies never use the reserve.
- `source_membership = local_only` files are visible in the local library but
  excluded from source coverage and planning.
- `.memorylane-tmp-*` files are never adopted or counted as destination-only.
- The destination local catalog is derived and rebuildable. It is not the
  authority for source coverage.
- A source index is a snapshot. It can be stale between runs and must show its
  timestamp.
- A destination’s local library may include unrelated files. Only files inside
  the source root count toward the source archive.
- Existing destination date coverage may be mixed, overlapping, or
  non-contiguous. The app shows it honestly and never rebalances it by moving
  files.
- “Fills first” is a capacity and predictability rule. It does not mean the
  first destination contains older files.
- `source_relative_path` is the stable coverage key. Moving the source root or
  promoting a destination must not change it.
- A demoted source used as a destination keeps one local library. Active-source
  dual-role is deferred; the first release requires dedicated destinations.
- At most one run is active per source archive. There is no concurrent run for
  the same archive.
- Plan changes require pausing the run. The first version does not support
  editing the active plan while copying.
- Adding a destination during a run is queued for the next plan and does not
  change the active run.
- Promotion is unavailable while a run is running or paused.
- Run status is local to the PC. It is not synchronized across devices.
- The run screen is reached through the persistent status, not through browser
  history. Closing the window does not remove the run status.
- A paused run still counts as active until it is stopped or completed.
- The first release requires dedicated destinations. A drive that is currently
  an active source archive cannot be registered as a destination.
- Scan, validation, and replication are mutually exclusive heavy workloads.
- Switching the source archive is blocked while a run is running or paused.
- The plan is recomputed from current coverage; individual plan items are not
  persisted in the first release. The run stores a plan hash and summary
  counters.
