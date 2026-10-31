# Phase 6 scope - Hardening

Status: automated hardening implemented; manual release pass pending.

Phase 6 closes the gap between feature-complete v0.1 and a release candidate.
It adds larger performance coverage, disconnect and recovery drills, security
gates, stronger package verification, and a documented release checklist.

## Delivered in this phase

### Performance

- The automated catalog test now exercises **100,000 files** by default and
  checks timeline paging, summary, month index, and Other files category
  queries.
- Set `MEMORY_LANE_PERF_200K=1` to run the same test with **200,000 files**.
  Both sizes have passed in-memory; real-drive memory measurement is still part
  of the manual release pass.
- Queries must finish within a 5-second budget.
- `npm run test:perf` runs only the large-catalog test.

### Disconnect and unclean shutdown

- `ScanService` accepts a drive-availability checker (defaulting to a root
  `fs.access`).
- An integration test simulates a mid-scan disconnect, asserts the persisted
  `error` state and message, restores availability, and resumes to completion.
- A worker-level drill starts a scan, closes the database worker without a
  graceful scan stop, reopens the catalog, and confirms `recoverInterruptedScans`
  reports `interrupted`.

### Recovery drill

- An integration test scans a file, creates a SQLite backup, closes the worker,
  deletes both live databases, restores `catalog.db` and `app.db` from the
  backup, reopens the catalog, and reads the file again.

### Security

- IPC sender validation now accepts only:
  - the exact packaged renderer `file://` document (including hash routes); or
  - the exact configured development origin.
- CSP remains script-self-only and now adds `object-src 'none'`,
  `base-uri 'none'`, `form-action 'none'`, and `frame-src 'none'`; the unused
  `http://localhost:*` connection source was removed.
- A read-only guard scans main-process TypeScript for direct filesystem write
  APIs and fails unless the file is explicitly allowlisted.
- See `security-review.md` for the full review and residual risks.

### Packaging and release

- `verify:package` now checks the unpacked executable, installer, portable
  executable, blockmap, `app.asar`, the SQLite native binary, and ExifTool.
- It writes SHA-256 checksums to `release/SHA256SUMS.txt`.
- The packaged smoke now covers scan, library, Other files, Settings, backup,
  and cache clearing.
- `release-checklist.md` documents clean-VM install, uninstall, codec,
  disconnect, recovery, and real-archive checks.

## Manual release pass still required

These cannot be completed inside the development environment:

- Run the 200,000-file performance pass on a real drive profile and record
  process memory.
- Physically disconnect and reconnect a USB archive during a scan.
- Play the codec matrix on a clean Windows VM.
- Install, launch, uninstall, and reinstall the NSIS package on a clean VM.
- Verify the portable executable on a clean VM without Node installed.
- Restore from a backup made on the real archive drive.
- Validate a real 2 TB USB 3 archive, including disconnect/reconnect and resume.

## Exit criteria

Phase 6 is complete when `check:full`, packaging verification, packaged smoke,
the 200,000-file run, and the manual release checklist all pass on the release
candidate.
