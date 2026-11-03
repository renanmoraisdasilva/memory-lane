# Requirement matrix

Generated from `docs/traceability/requirements.json`.

| ID | Requirement | Kind | Status | Test files | Result |
|---|---|---|---|---:|---|
| ML-SAFE-001 | Original files are never deleted, edited, or truncated | invariant | verified | 2 | pass |
| ML-SAFE-002 | Only the duplicate quarantine mover may move or rename an original file | invariant | verified | 2 | pass |
| ML-SAFE-003 | Every non-quarantine source read opens the original file read-only | invariant | verified | 4 | pass |
| ML-SAFE-004 | The quarantine mover is the only source write path | invariant | verified | 3 | pass |
| ML-SAFE-005 | The read-only guard fails on unreviewed write APIs | constraint | verified | 2 | pass |
| ML-SAFE-006 | The DB worker is the only SQLite writer | invariant | verified | 2 | pass |
| ML-SAFE-007 | No IPC contract accepts a source path for writing | invariant | verified | 4 | pass |
| ML-SAFE-008 | The source catalog database may be written; source archive files may not | invariant | verified | 2 | pass |
| ML-SAFE-009 | Scans exclude app-managed directories | invariant | verified | 1 | pass |
| ML-SAFE-010 | Backups and validation read source data read-only | invariant | verified | 3 | pass |
| ML-QUAR-001 | Duplicate groups are exact full-SHA-256 groups | outcome | verified | 2 | pass |
| ML-QUAR-002 | The keeper is a verified backup copy first, then the oldest copy | outcome | verified | 2 | pass |
| ML-QUAR-003 | Coverage is a preference, not an eligibility gate | outcome | verified | 4 | pass |
| ML-QUAR-004 | The duplicates view shows KEEP/MOVE and SKIP with a reason | outcome | verified | 2 | pass |
| ML-QUAR-005 | The confirmation states the full consequence | outcome | verified | 2 | pass |
| ML-QUAR-006 | Progress shows moved files, bytes, current path, and cancel | outcome | verified | 2 | pass |
| ML-QUAR-007 | Completion states the manual next steps | outcome | verified | 2 | pass |
| ML-QUAR-008 | The mover verifies before and after the move | invariant | verified | 1 | pass |
| ML-QUAR-009 | The mover never moves the last eligible copy | invariant | verified | 2 | pass |
| ML-QUAR-010 | The mover skips unsafe or ambiguous candidates | invariant | verified | 3 | pass |
| ML-QUAR-011 | Every move is auditable and the quarantine is never deleted | invariant | verified | 3 | pass |
| ML-QUAR-012 | A move batch updates the catalog and audit state | outcome | verified | 2 | pass |
| ML-QUAR-013 | A rescan does not report moved files as missing | outcome | verified | 3 | pass |
| ML-QUAR-014 | Cancel, failure, and interruption leave an auditable run | outcome | verified | 2 | pass |
| ML-QUAR-015 | The Move button is live; there is no preview-only phase | constraint | verified | 2 | pass |
| ML-QUAR-016 | No user-defined protected folders in the first release | non-goal | non-goal | 0 | not run |
| ML-QUAR-017 | No history or restore UI in the first release | non-goal | non-goal | 0 | not run |
| ML-QUAR-018 | No automatic quarantine removal | non-goal | non-goal | 0 | not run |
| ML-SCAN-001 | Drive identity is stable and independent of the drive letter | invariant | verified | 3 | pass |
| ML-SCAN-002 | A changed drive letter requires confirmation | outcome | verified | 3 | pass |
| ML-SCAN-003 | Each archive drive owns its catalog and cache | invariant | verified | 3 | pass |
| ML-SCAN-004 | Scan starts only on explicit user action | outcome | verified | 3 | pass |
| ML-SCAN-005 | Scan runs four stages and browsing unlocks after catalog | outcome | verified | 2 | pass |
| ML-SCAN-006 | Pause persists progress and resume continues | outcome | verified | 2 | pass |
| ML-SCAN-007 | Close or disconnect interrupts safely | outcome | verified | 2 | pass |
| ML-SCAN-008 | Incremental scan detects new, changed, missing, and moved | outcome | verified | 2 | pass |
| ML-SCAN-009 | Scan report counts new, changed, missing, and moved | outcome | verified | 2 | pass |
| ML-SCAN-010 | Large files use a quick fingerprint until a full hash is needed | invariant | verified | 3 | pass |
| ML-SCAN-011 | Metadata extraction is versioned and refreshable | outcome | verified | 3 | pass |
| ML-SCAN-012 | Dates preserve provenance and never invent a value | invariant | verified | 2 | pass |
| ML-SCAN-013 | Manual dates use year or year-month precision | outcome | verified | 3 | pass |
| ML-SCAN-014 | Browsing and scanning stay responsive at 100k+ items | constraint | verified | 3 | pass |
| ML-LIB-001 | One chronological timeline for photos and videos | outcome | verified | 3 | pass |
| ML-LIB-002 | Year/month navigation and date grouping honor precision | outcome | verified | 3 | pass |
| ML-LIB-003 | The grid is virtualized and thumbnails are lazy | constraint | verified | 2 | pass |
| ML-LIB-004 | The viewer supports photos, videos, and filter-aware navigation | outcome | verified | 2 | pass |
| ML-LIB-005 | Item details and missing states retain catalog context | outcome | verified | 2 | pass |
| ML-LIB-006 | Media URLs use catalog IDs and byte ranges | invariant | verified | 3 | pass |
| ML-LIB-007 | Thumbnails are cached, deduplicated, and failure-safe | outcome | verified | 3 | pass |
| ML-LIB-008 | HEIC previews are generated on demand and cached | outcome | verified | 2 | pass |
| ML-LIB-009 | WMV/3GP and failed playback use a cached MP4 proxy | outcome | verified | 3 | pass |
| ML-LIB-010 | The cache is disposable and never affects originals | invariant | verified | 3 | pass |
| ML-HEALTH-001 | Health summary reports duplicates, missing, moved, and validation state | outcome | verified | 3 | pass |
| ML-HEALTH-002 | Duplicate detection uses exact full SHA-256 only | invariant | verified | 3 | pass |
| ML-HEALTH-003 | Duplicate groups list every copy with its context | outcome | verified | 2 | pass |
| ML-HEALTH-004 | Duplicate groups are ordered by total bytes | outcome | verified | 2 | pass |
| ML-HEALTH-005 | Duplicate groups are rebuilt after catalog changes | invariant | verified | 3 | pass |
| ML-HEALTH-006 | Missing files stay cataloged | invariant | verified | 2 | pass |
| ML-HEALTH-007 | Missing files can be disregarded and restored | outcome | verified | 2 | pass |
| ML-HEALTH-008 | Missing lists page and select across the full result | outcome | verified | 3 | pass |
| ML-HEALTH-009 | Moved candidates are paginated and batch-confirmed | outcome | verified | 2 | pass |
| ML-HEALTH-010 | Confirming a move rechecks and updates the catalog | outcome | verified | 2 | pass |
| ML-HEALTH-011 | Dismissing a move keeps the file missing | outcome | verified | 2 | pass |
| ML-HEALTH-012 | Missing-duplicate cleanup removes catalog rows only | invariant | verified | 2 | pass |
| ML-HEALTH-013 | Missing-duplicate preview reports risk and pending moves | outcome | verified | 2 | pass |
| ML-HEALTH-014 | Validation has independently selectable levels | outcome | verified | 2 | pass |
| ML-HEALTH-015 | Validation covers the whole catalog and stores per-file results | outcome | verified | 2 | pass |
| ML-HEALTH-016 | Hash validation records mismatches and updates the stored hash | outcome | verified | 2 | pass |
| ML-HEALTH-017 | Metadata refresh preserves manual date overrides | outcome | verified | 2 | pass |
| ML-HEALTH-018 | Validation marks missing files without deleting them | outcome | verified | 2 | pass |
| ML-HEALTH-019 | Validation pauses, resumes, and recovers | outcome | verified | 3 | pass |
| ML-HEALTH-020 | Validation reports every outcome | outcome | verified | 2 | pass |
| ML-HEALTH-021 | Health actions never change original files | invariant | verified | 2 | pass |
| ML-HEALTH-022 | Health UI exposes Missing, Duplicates, and Validation tabs | outcome | verified | 2 | pass |
| ML-HEALTH-023 | Validation is exclusive with scan and cleanup | constraint | verified | 2 | pass |
| ML-HEALTH-024 | Scan completion surfaces missing-duplicate cleanup | outcome | verified | 2 | pass |
| ML-HEALTH-025 | Catalog-changing actions refresh affected views | outcome | implemented | 1 | pass |
| ML-REPL-001 | Fresh catalogs migrate to the current catalog schema | outcome | verified | 1 | pass |
| ML-REPL-002 | Schema 6 catalogs migrate without data loss | outcome | verified | 1 | pass |
| ML-REPL-003 | Archive identity has one stable catalog id | invariant | verified | 1 | pass |
| ML-REPL-004 | Source membership defaults to source | invariant | verified | 1 | pass |
| ML-REPL-005 | Replica and run tables enforce constraints | constraint | verified | 1 | pass |
| ML-REPL-006 | One active run per source | invariant | verified | 1 | pass |
| ML-REPL-007 | Hash records track source size and modified time | invariant | verified | 1 | pass |
| ML-REPL-008 | Destination and source catalogs open together | outcome | verified | 1 | pass |
| ML-REPL-009 | Source cannot be a destination | invariant | verified | 1 | pass |
| ML-REPL-010 | Duplicate catalog paths are rejected | invariant | verified | 1 | pass |
| ML-REPL-011 | Destination identity uses volume id and marker | invariant | verified | 1 | pass |
| ML-REPL-012 | Identical drives are not merged | invariant | verified | 1 | pass |
| ML-REPL-013 | Overlapping roots are rejected | invariant | verified | 1 | pass |
| ML-REPL-014 | Destination subfolder survives letter changes | invariant | verified | 1 | pass |
| ML-REPL-015 | Destination library resolves after letter change | outcome | implemented | 1 | pass |
| ML-REPL-016 | Missing marker adoption works | outcome | verified | 1 | pass |
| ML-REPL-017 | Adoption match order is path, name, hash | outcome | verified | 1 | pass |
| ML-REPL-018 | First-adoption conflict is never overwritten | invariant | verified | 1 | pass |
| ML-REPL-019 | Stale replacement requires approval | outcome | verified | 1 | pass |
| ML-REPL-020 | Changed destination file is re-verified | invariant | verified | 1 | pass |
| ML-REPL-021 | Ambiguous files are reported, never guessed | invariant | verified | 1 | pass |
| ML-REPL-022 | Only-on-drive extras stay visible and untouched | invariant | verified | 1 | pass |
| ML-REPL-023 | Source-missing replicas are attention-only | invariant | verified | 1 | pass |
| ML-REPL-024 | Symlink escapes are rejected | invariant | verified | 1 | pass |
| ML-REPL-025 | Destination catalog is reused or created once | outcome | verified | 1 | pass |
| ML-REPL-026 | Adoption progress survives pause and restart | outcome | implemented | 1 | pass |
| ML-REPL-027 | Source index is written, timestamped, and readable | outcome | verified | 1 | pass |
| ML-REPL-028 | Marker and source-index failures are warnings | invariant | implemented | 1 | pass |
| ML-REPL-029 | Union coverage counts each source file once | invariant | verified | 1 | pass |
| ML-REPL-030 | Full-copy overlap is labelled separately | outcome | verified | 1 | pass |
| ML-REPL-031 | Offline coverage is last-known and qualified | invariant | verified | 1 | pass |
| ML-REPL-032 | Retired and lost coverage is excluded | invariant | verified | 1 | pass |
| ML-REPL-033 | Missing and orphan files are not current coverage | invariant | verified | 1 | pass |
| ML-REPL-034 | Coverage labels name their scope | outcome | verified | 1 | pass |
| ML-REPL-035 | No 100% all-destination claim without a full copy | invariant | verified | 2 | pass |
| ML-REPL-036 | The plan covers the whole source | invariant | verified | 1 | pass |
| ML-REPL-037 | Chronology is oldest-first, undated last | invariant | verified | 1 | pass |
| ML-REPL-038 | Partial destinations fill in priority order | outcome | verified | 1 | pass |
| ML-REPL-039 | No file goes to two partial destinations | invariant | verified | 2 | pass |
| ML-REPL-040 | Full copy receives every source file | outcome | verified | 2 | pass |
| ML-REPL-041 | Full-copy and partial jobs are independent | outcome | verified | 2 | pass |
| ML-REPL-042 | Completed full copy is excluded from later runs | outcome | implemented | 1 | pass |
| ML-REPL-043 | Offline earlier destination keeps its range | invariant | implemented | 1 | pass |
| ML-REPL-044 | Connected-drives-only is opt-in and warns | outcome | implemented | 1 | pass |
| ML-REPL-045 | Remainder is exact | outcome | verified | 1 | pass |
| ML-REPL-046 | Full-copy shortfall is exact | constraint | verified | 2 | pass |
| ML-REPL-047 | Incompatible files try later destinations | outcome | implemented | 1 | not run |
| ML-REPL-048 | No destinations shows the add state | outcome | verified | 1 | pass |
| ML-REPL-049 | All-offline plan stays readable | outcome | verified | 1 | pass |
| ML-REPL-050 | Stale replacement reserve keeps 1 GiB free | invariant | implemented | 1 | pass |
| ML-REPL-051 | New copies never consume the reserve | invariant | verified | 1 | pass |
| ML-REPL-052 | Plan hash changes with inputs | invariant | verified | 1 | pass |
| ML-REPL-053 | Start creates one run and opens it | outcome | verified | 1 | pass |
| ML-REPL-054 | Second Start opens the active run | invariant | verified | 1 | pass |
| ML-REPL-055 | Pause persists progress | outcome | verified | 1 | pass |
| ML-REPL-056 | Resume continues without recopying | invariant | verified | 1 | pass |
| ML-REPL-057 | Stop keeps verified files | outcome | verified | 1 | pass |
| ML-REPL-058 | Shutdown marks the run interrupted | outcome | verified | 1 | pass |
| ML-REPL-059 | Every screen can reach the run | outcome | implemented | 1 | not run |
| ML-REPL-060 | Plan and destination edits lock while running | invariant | implemented | 1 | not run |
| ML-REPL-061 | Pause unlocks plan and destination edits | outcome | verified | 1 | pass |
| ML-REPL-062 | Replan increments the revision and appends an event | outcome | verified | 1 | pass |
| ML-REPL-063 | Replan never recopies verified files | invariant | implemented | 1 | not run |
| ML-REPL-064 | Adding a destination during a run queues it | outcome | implemented | 1 | not run |
| ML-REPL-065 | Promotion is blocked while a run is active | invariant | verified | 2 | pass |
| ML-REPL-066 | Source switching is blocked while a run is active | invariant | verified | 1 | pass |
| ML-REPL-067 | Scan, validation, and replication are exclusive | constraint | verified | 2 | pass |
| ML-REPL-068 | Copy uses a temp file, hashes once, and renames | invariant | verified | 1 | pass |
| ML-REPL-069 | Source change during copy retries once | outcome | verified | 2 | pass |
| ML-REPL-070 | Unknown source hash uses size, mtime, and streamed hash | invariant | verified | 1 | pass |
| ML-REPL-071 | Hash mismatch discards the temp file | invariant | verified | 1 | pass |
| ML-REPL-072 | Crash mid-copy leaves no counted partial file | invariant | implemented | 1 | not run |
| ML-REPL-073 | Disk full pauses partial and marks full incomplete | outcome | implemented | 2 | pass |
| ML-REPL-074 | Locked or permission-denied files fail without killing the run | outcome | implemented | 2 | pass |
| ML-REPL-075 | Disconnect pauses safely without substituting a drive | outcome | implemented | 2 | not run |
| ML-REPL-076 | Destination writes outside the root are rejected | invariant | verified | 2 | pass |
| ML-REPL-077 | Destination library failures do not invalidate the backup | invariant | implemented | 1 | pass |
| ML-REPL-078 | Thumbnail cache reuse requires a matching source hash | invariant | implemented | 1 | not run |
| ML-REPL-079 | Full copy completes only with zero issues | invariant | verified | 2 | pass |
| ML-REPL-080 | Full copy out of space is incomplete and does not spill | outcome | verified | 1 | pass |
| ML-REPL-081 | Source growth degrades full copy to incomplete | outcome | implemented | 1 | pass |
| ML-REPL-082 | Promotion requires a complete connected full copy | invariant | verified | 2 | pass |
| ML-REPL-083 | Promotion preserves catalog identity and metadata | invariant | verified | 2 | pass |
| ML-REPL-084 | Promotion rebases the source root | invariant | verified | 2 | pass |
| ML-REPL-085 | Old source becomes a demoted destination | outcome | verified | 2 | pass |
| ML-REPL-086 | Rollback works only before the first change | invariant | verified | 2 | pass |
| ML-REPL-087 | Promotion merge failure restores snapshots | outcome | implemented | 2 | pass |
| ML-REPL-088 | Destination-only files stay out of the promoted source | invariant | verified | 2 | pass |
| ML-REPL-089 | Active source cannot be a destination | invariant | verified | 1 | pass |
| ML-REPL-090 | Destination media resolves only destination IDs | invariant | verified | 1 | pass |
| ML-REPL-091 | All destination writes go through the allowlisted writer | constraint | verified | 1 | pass |
| ML-REPL-092 | No source file content or metadata is modified | invariant | verified | 1 | pass |
| ML-REPL-093 | No restore-to-source or destination reveal IPC exists | invariant | implemented | 1 | not run |
| ML-VIDEO-001 | WMV and 3GP prepare immediately; other videos try direct playback first | outcome | verified | 1 | pass |
| ML-VIDEO-002 | One FFmpeg job runs per file and repeated prepare coalesces | invariant | implemented | 1 | not run |
| ML-VIDEO-003 | Proxy output is renamed into place only after conversion succeeds | invariant | implemented | 1 | not run |
| ML-VIDEO-004 | Proxy cache rows store the source fingerprint and state | invariant | verified | 2 | pass |
| ML-VIDEO-005 | A source change invalidates the cached proxy | invariant | implemented | 2 | not run |
| ML-VIDEO-006 | The proxy URL serves ranges and 404s until ready | invariant | implemented | 2 | pass |
| ML-VIDEO-007 | Failed conversion records failure and offers retry or external open | outcome | verified | 2 | pass |
| ML-VIDEO-008 | The FFmpeg command produces a Chromium-compatible MP4 | constraint | verified | 1 | pass |
| ML-VIDEO-009 | The packaged app bundles FFmpeg with its license notice | constraint | implemented | 1 | pass |
| ML-VIDEO-010 | Proxy files count in cache stats and are removed by clear cache | outcome | implemented | 2 | not run |
| ML-VIDEO-011 | HEIC previews run in a worker and deduplicate in-flight work | invariant | verified | 1 | pass |
| ML-VIDEO-012 | HEIC previews cache as JPEG preview rows and fail safely | outcome | verified | 1 | pass |
| ML-SET-001 | Settings reports cache, catalog, backup, and app information | outcome | verified | 2 | pass |
| ML-SET-002 | Clear cache removes the directory and all cache rows | outcome | verified | 3 | pass |
| ML-SET-003 | Cache clearing never changes the catalog, overrides, metadata, or originals | invariant | implemented | 3 | not run |
| ML-SET-004 | Backups use the SQLite online backup API for both databases | invariant | verified | 2 | pass |
| ML-SET-005 | Backups write both databases to the volume backup directory | outcome | verified | 3 | pass |
| ML-SET-006 | Backups run manually, on the timer, and on shutdown | outcome | verified | 2 | pass |
| ML-SET-007 | The default backup interval is 15 minutes | constraint | implemented | 1 | not run |
| ML-SET-008 | Overlapping backups coalesce and scheduled runs need an open catalog | invariant | verified | 1 | pass |
| ML-SET-009 | Backup history records the result and preserves the last success | outcome | verified | 2 | pass |
| ML-SET-010 | A backup failure is visible and does not stop the app | outcome | implemented | 2 | pass |
| ML-SET-011 | Recovery is manual and the UI has no restore action | constraint | implemented | 2 | pass |
| ML-SET-012 | Settings exposes cache, catalog, backup, background, and About sections | outcome | verified | 2 | pass |
| ML-SET-013 | Automatic cache size limits are out of scope for v0.1 | non-goal | non-goal | 0 | not run |
| ML-SET-014 | Backup files are renamed into place only after both databases succeed | invariant | implemented | 1 | pass |
| ML-REL-001 | Memory Lane is local-only | outcome | implemented | 3 | pass |
| ML-REL-002 | Original files are never deleted or edited | invariant | verified | 2 | pass |
| ML-REL-003 | Drive selection, catalog setup, and changed-letter handling work | outcome | verified | 3 | pass |
| ML-REL-004 | Four-stage scan controls and interruption recovery work | outcome | implemented | 4 | pass |
| ML-REL-005 | Incremental scan and health detection work | outcome | verified | 2 | pass |
| ML-REL-006 | Timeline, filters, density, viewer, reveal, and open work | outcome | verified | 3 | pass |
| ML-REL-007 | Dates, undated items, and overrides work | outcome | implemented | 4 | pass |
| ML-REL-008 | Whole-catalog validation works | outcome | verified | 3 | pass |
| ML-REL-009 | Other files categories and actions work | outcome | verified | 3 | pass |
| ML-REL-010 | Cache controls and Settings work | outcome | verified | 3 | pass |
| ML-REL-011 | SQLite-safe backups run on schedule and close | invariant | implemented | 2 | pass |
| ML-REL-012 | Manual backup recovery works | outcome | implemented | 1 | pass |
| ML-REL-013 | Large catalog query performance stays within budget | constraint | implemented | 1 | pass |
| ML-REL-014 | Installer and portable artifacts are verified | outcome | implemented | 2 | not run |
| ML-REL-015 | Codec behavior and fallback are classified | constraint | implemented | 2 | pass |
| ML-REL-016 | A real scan disconnect is safe | invariant | implemented | 1 | pass |
| ML-REL-017 | A clean Windows VM release pass is required | constraint | deferred | 0 | not run |
| ML-REL-018 | WMV and 3GP compatible playback works | outcome | implemented | 2 | pass |

Test results are read from `docs/traceability/test-results.json` when present. A requirement is `verified` when at least one ID-tagged test passes; non-goals have no test by design.
