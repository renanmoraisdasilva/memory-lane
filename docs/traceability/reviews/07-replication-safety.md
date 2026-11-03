# Batch 7 review — Replication: copy, promotion, and safety

Status: **implemented**. Requirements: **26**. Conflicts: **0**.

This sheet is generated from `docs/traceability/requirements.json`. This batch is accepted; the matrix is the live view. New requirements start at `needs-review`.

Kinds: invariant 17, outcome 8, constraint 1.

## Summary

| ID | Kind | Status | Title |
|---|---|---|---|
| ML-REPL-068 | invariant | verified | Copy uses a temp file, hashes once, and renames |
| ML-REPL-069 | outcome | verified | Source change during copy retries once |
| ML-REPL-070 | invariant | verified | Unknown source hash uses size, mtime, and streamed hash |
| ML-REPL-071 | invariant | verified | Hash mismatch discards the temp file |
| ML-REPL-072 | invariant | implemented | Crash mid-copy leaves no counted partial file |
| ML-REPL-073 | outcome | implemented | Disk full pauses partial and marks full incomplete |
| ML-REPL-074 | outcome | implemented | Locked or permission-denied files fail without killing the run |
| ML-REPL-075 | outcome | implemented | Disconnect pauses safely without substituting a drive |
| ML-REPL-076 | invariant | verified | Destination writes outside the root are rejected |
| ML-REPL-077 | invariant | implemented | Destination library failures do not invalidate the backup |
| ML-REPL-078 | invariant | implemented | Thumbnail cache reuse requires a matching source hash |
| ML-REPL-079 | invariant | verified | Full copy completes only with zero issues |
| ML-REPL-080 | outcome | verified | Full copy out of space is incomplete and does not spill |
| ML-REPL-081 | outcome | implemented | Source growth degrades full copy to incomplete |
| ML-REPL-082 | invariant | verified | Promotion requires a complete connected full copy |
| ML-REPL-083 | invariant | verified | Promotion preserves catalog identity and metadata |
| ML-REPL-084 | invariant | verified | Promotion rebases the source root |
| ML-REPL-085 | outcome | verified | Old source becomes a demoted destination |
| ML-REPL-086 | invariant | verified | Rollback works only before the first change |
| ML-REPL-087 | outcome | implemented | Promotion merge failure restores snapshots |
| ML-REPL-088 | invariant | verified | Destination-only files stay out of the promoted source |
| ML-REPL-089 | invariant | verified | Active source cannot be a destination |
| ML-REPL-090 | invariant | verified | Destination media resolves only destination IDs |
| ML-REPL-091 | constraint | verified | All destination writes go through the allowlisted writer |
| ML-REPL-092 | invariant | verified | No source file content or metadata is modified |
| ML-REPL-093 | invariant | implemented | No restore-to-source or destination reveal IPC exists |

## Requirements

### ML-REPL-068 — Copy uses a temp file, hashes once, and renames

- **Kind:** invariant
- **Status:** verified
- **Legacy ID:** R-66
- **Proposed:** Copy writes to a temp file, hashes the stream once, checks source/size, then renames
- **Current / source:** Copy writes to a temp file, hashes the stream once, checks source/size, then renames
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/infrastructure/file-copier.test.ts`
- **Test notes:** From the replication matrix evidence: copier test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-66.
- **Decision:** verified

### ML-REPL-069 — Source change during copy retries once

- **Kind:** outcome
- **Status:** verified
- **Legacy ID:** R-67
- **Proposed:** Source change during copy discards temp and retries once
- **Current / source:** Source change during copy discards temp and retries once
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/infrastructure/file-copier.test.ts`, `tests/integration/replication-run.test.ts`
- **Test notes:** From the replication matrix evidence: fault test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-67.
- **Decision:** verified

### ML-REPL-070 — Unknown source hash uses size, mtime, and streamed hash

- **Kind:** invariant
- **Status:** verified
- **Legacy ID:** R-68
- **Proposed:** Source hash unknown uses size/mtime and streamed hash
- **Current / source:** Source hash unknown uses size/mtime and streamed hash
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/infrastructure/file-copier.test.ts`
- **Test notes:** From the replication matrix evidence: copier test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-68.
- **Decision:** verified

### ML-REPL-071 — Hash mismatch discards the temp file

- **Kind:** invariant
- **Status:** verified
- **Legacy ID:** R-69
- **Proposed:** Hash mismatch discards temp and marks failed
- **Current / source:** Hash mismatch discards temp and marks failed
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/infrastructure/file-copier.test.ts`
- **Test notes:** From the replication matrix evidence: copier test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-69.
- **Decision:** verified

### ML-REPL-072 — Crash mid-copy leaves no counted partial file

- **Kind:** invariant
- **Status:** implemented
- **Legacy ID:** R-70
- **Proposed:** Crash mid-copy leaves no partial file counted; temp is cleaned
- **Current / source:** Crash mid-copy leaves no partial file counted; temp is cleaned
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `tests/integration/replication-run.test.ts`
- **Test notes:** No test simulates a crash mid-copy and asserts temp cleanup.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-70.
- **Decision:** implemented

### ML-REPL-073 — Disk full pauses partial and marks full incomplete

- **Kind:** outcome
- **Status:** implemented
- **Legacy ID:** R-71
- **Proposed:** Disk full pauses partial destination and marks full copy incomplete
- **Current / source:** Disk full pauses partial destination and marks full copy incomplete
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/infrastructure/file-copier.test.ts`, `tests/integration/replication-run.test.ts`
- **Test notes:** Safe free space is covered; disk-full mid-copy behavior is not explicitly asserted.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-71.
- **Decision:** implemented

### ML-REPL-074 — Locked or permission-denied files fail without killing the run

- **Kind:** outcome
- **Status:** implemented
- **Legacy ID:** R-72
- **Proposed:** Locked/permission-denied file retries, then fails without killing run
- **Current / source:** Locked/permission-denied file retries, then fails without killing run
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/infrastructure/file-copier.test.ts`, `tests/integration/replication-run.test.ts`
- **Test notes:** Unreadable source is covered; locked or permission-denied retry without killing the run is not explicit.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-72.
- **Decision:** implemented

### ML-REPL-075 — Disconnect pauses safely without substituting a drive

- **Kind:** outcome
- **Status:** implemented
- **Legacy ID:** R-73
- **Proposed:** Destination/source disconnect pauses safely; no substituted drive
- **Current / source:** Destination/source disconnect pauses safely; no substituted drive
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/infrastructure/file-copier.test.ts`, `tests/integration/replication-run.test.ts`
- **Test notes:** No test covers disconnect or substituted-drive behavior.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-73.
- **Decision:** implemented

### ML-REPL-076 — Destination writes outside the root are rejected

- **Kind:** invariant
- **Status:** verified
- **Legacy ID:** R-74
- **Proposed:** Destination write outside root or via symlink is rejected
- **Current / source:** Destination write outside root or via symlink is rejected
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/infrastructure/destination-writer.test.ts`, `src/main/platform/destination-path-policy.test.ts`
- **Test notes:** From the replication matrix evidence: writer/path test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-74.
- **Decision:** verified

### ML-REPL-077 — Destination library failures do not invalidate the backup

- **Kind:** invariant
- **Status:** implemented
- **Legacy ID:** R-75
- **Proposed:** Destination local library updates are derived; failure does not invalidate backup
- **Current / source:** Destination local library updates are derived; failure does not invalidate backup
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/db/repositories/replication-destination-library-repository.test.ts`
- **Test notes:** Destination library rows are covered; failure isolation from the backup is not explicit.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-75.
- **Decision:** implemented

### ML-REPL-078 — Thumbnail cache reuse requires a matching source hash

- **Kind:** invariant
- **Status:** implemented
- **Legacy ID:** R-76
- **Proposed:** Copied thumbnail cache is reused only when source hash/version matches
- **Current / source:** Copied thumbnail cache is reused only when source hash/version matches
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/media/media-request-handler.test.ts`
- **Test notes:** No test covers thumbnail cache reuse keyed by source hash.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-76.
- **Decision:** implemented

### ML-REPL-079 — Full copy completes only with zero issues

- **Kind:** invariant
- **Status:** verified
- **Legacy ID:** R-77
- **Proposed:** Full copy completes only with zero stale/missing/conflict/failed/remainder
- **Current / source:** Full copy completes only with zero stale/missing/conflict/failed/remainder
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/domain/full-copy-status.test.ts`, `tests/integration/replication-full-copy.test.ts`
- **Test notes:** From the replication matrix evidence: full-copy test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-77.
- **Decision:** verified

### ML-REPL-080 — Full copy out of space is incomplete and does not spill

- **Kind:** outcome
- **Status:** verified
- **Legacy ID:** R-78
- **Proposed:** Full copy out of space becomes incomplete and does not spill
- **Current / source:** Full copy out of space becomes incomplete and does not spill
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `tests/integration/replication-full-copy.test.ts`
- **Test notes:** From the replication matrix evidence: full-copy failure test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-78.
- **Decision:** verified

### ML-REPL-081 — Source growth degrades full copy to incomplete

- **Kind:** outcome
- **Status:** implemented
- **Legacy ID:** R-79
- **Proposed:** Source growth degrades full copy to incomplete with shortfall
- **Current / source:** Source growth degrades full copy to incomplete with shortfall
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/domain/full-copy-status.test.ts`
- **Test notes:** Full-copy status is covered; source-growth degradation is not explicitly asserted.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-79.
- **Decision:** implemented

### ML-REPL-082 — Promotion requires a complete connected full copy

- **Kind:** invariant
- **Status:** verified
- **Legacy ID:** R-80
- **Proposed:** Promotion requires complete full copy, connected/confirmed identity, no active work
- **Current / source:** Promotion requires complete full copy, connected/confirmed identity, no active work
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/domain/promotion-policy.test.ts`, `src/main/modules/replication/application/promotion-state.test.ts`
- **Test notes:** From the replication matrix evidence: preflight test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-80.
- **Decision:** verified

### ML-REPL-083 — Promotion preserves catalog identity and metadata

- **Kind:** invariant
- **Status:** verified
- **Legacy ID:** R-81
- **Proposed:** Promotion preserves `catalog_id`, dates, overrides, duplicates, coverage
- **Current / source:** Promotion preserves `catalog_id`, dates, overrides, duplicates, coverage
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/db/repositories/promotion-merge.test.ts`, `tests/integration/replication-promotion.test.ts`
- **Test notes:** From the replication matrix evidence: promotion test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-81.
- **Decision:** verified

### ML-REPL-084 — Promotion rebases the source root

- **Kind:** invariant
- **Status:** verified
- **Legacy ID:** R-82
- **Proposed:** Promotion rebases source root and keeps `source_relative_path` stable
- **Current / source:** Promotion rebases source root and keeps `source_relative_path` stable
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/db/repositories/promotion-merge.test.ts`, `tests/integration/replication-promotion.test.ts`
- **Test notes:** From the replication matrix evidence: promotion test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-82.
- **Decision:** verified

### ML-REPL-085 — Old source becomes a demoted destination

- **Kind:** outcome
- **Status:** verified
- **Legacy ID:** R-83
- **Proposed:** Old source becomes a demoted destination; 1 TB keep/retire applies
- **Current / source:** Old source becomes a demoted destination; 1 TB keep/retire applies
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/db/repositories/promotion-merge.test.ts`, `tests/integration/replication-promotion.test.ts`
- **Test notes:** From the replication matrix evidence: promotion test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-83.
- **Decision:** verified

### ML-REPL-086 — Rollback works only before the first change

- **Kind:** invariant
- **Status:** verified
- **Legacy ID:** R-84
- **Proposed:** Promotion rollback works before first change; refused after
- **Current / source:** Promotion rollback works before first change; refused after
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/db/repositories/promotion-merge.test.ts`, `tests/integration/replication-promotion.test.ts`
- **Test notes:** From the replication matrix evidence: promotion test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-84.
- **Decision:** verified

### ML-REPL-087 — Promotion merge failure restores snapshots

- **Kind:** outcome
- **Status:** implemented
- **Legacy ID:** R-85
- **Proposed:** Promotion merge failure restores snapshots
- **Current / source:** Promotion merge failure restores snapshots
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/db/promotion-snapshot-files.test.ts`, `tests/integration/replication-promotion.test.ts`
- **Test notes:** Rollback marker is covered; merge-failure snapshot restore is not explicitly asserted.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-85.
- **Decision:** implemented

### ML-REPL-088 — Destination-only files stay out of the promoted source

- **Kind:** invariant
- **Status:** verified
- **Legacy ID:** R-86
- **Proposed:** Destination-only files stay out of promoted source; remain local
- **Current / source:** Destination-only files stay out of promoted source; remain local
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/db/repositories/promotion-merge.test.ts`, `tests/integration/replication-promotion.test.ts`
- **Test notes:** From the replication matrix evidence: promotion extras test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-86.
- **Decision:** verified

### ML-REPL-089 — Active source cannot be a destination

- **Kind:** invariant
- **Status:** verified
- **Legacy ID:** R-87
- **Proposed:** Active source cannot be registered as a destination in this release
- **Current / source:** Active source cannot be registered as a destination in this release
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/application/destination-service.test.ts`
- **Test notes:** From the replication matrix evidence: dedicated-destination test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-87.
- **Decision:** verified

### ML-REPL-090 — Destination media resolves only destination IDs

- **Kind:** invariant
- **Status:** verified
- **Legacy ID:** R-88
- **Proposed:** Destination-scoped media resolves only destination file IDs
- **Current / source:** Destination-scoped media resolves only destination file IDs
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `tests/integration/replication-media.test.ts`
- **Test notes:** From the replication matrix evidence: media parser test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-88.
- **Decision:** verified

### ML-REPL-091 — All destination writes go through the allowlisted writer

- **Kind:** constraint
- **Status:** verified
- **Legacy ID:** R-89
- **Proposed:** All destination writes are confined to the allowlisted writer
- **Current / source:** All destination writes are confined to the allowlisted writer
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `tests/integration/read-only-guard.test.ts`
- **Test notes:** From the replication matrix evidence: read-only guard test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-89.
- **Decision:** verified

### ML-REPL-092 — No source file content or metadata is modified

- **Kind:** invariant
- **Status:** verified
- **Legacy ID:** R-90
- **Proposed:** No source file content or metadata is modified
- **Current / source:** No source file content or metadata is modified
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `tests/integration/replication-run.test.ts`
- **Test notes:** From the replication matrix evidence: hash-before/after test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-90.
- **Decision:** verified

### ML-REPL-093 — No restore-to-source or destination reveal IPC exists

- **Kind:** invariant
- **Status:** implemented
- **Legacy ID:** R-91
- **Proposed:** No restore-to-source or destination reveal/open IPC exists; source files are never written
- **Current / source:** No restore-to-source or destination reveal/open IPC exists; source files are never written
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `tests/integration/read-only-guard.test.ts`
- **Test notes:** No test asserts the absence of restore-to-source and destination reveal/open IPC.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-91.
- **Decision:** implemented

## Conflicts

_No conflicts in this batch._
## Approval

This batch is approved. For future batches, either:

1. change `status` to `accepted` and keep the proposed text;
2. edit `proposedText` in the JSON and keep `needs-review`; or
3. change `status` to `non-goal` if the item is out of scope.

Do not mark a requirement `verified` until at least one test carries its ID and the test result is green.
