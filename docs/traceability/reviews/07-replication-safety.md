# Batch 7 review — Replication: copy, promotion, and safety

Status: **implemented**. Requirements: **33**. Conflicts: **0**.

This sheet is generated from `docs/traceability/requirements.json`. This batch is accepted; the matrix is the live view. New requirements start at `needs-review`.

Kinds: invariant 17, outcome 13, constraint 3.

Verification: automated-test 33.

## Summary

| ID | Kind | Status | Verification | Title |
|---|---|---|---|---|
| ML-REPL-068 | invariant | verified | automated-test | Copy uses a temp file, hashes once, and renames |
| ML-REPL-069 | outcome | verified | automated-test | Source change during copy retries once |
| ML-REPL-070 | invariant | verified | automated-test | Unknown source hash uses size, mtime, and streamed hash |
| ML-REPL-071 | invariant | verified | automated-test | Hash mismatch discards the temp file |
| ML-REPL-072 | invariant | implemented | automated-test | Crash mid-copy leaves no counted partial file |
| ML-REPL-073 | outcome | implemented | automated-test | Disk full pauses partial and marks full incomplete |
| ML-REPL-074 | outcome | implemented | automated-test | Locked or permission-denied files fail without killing the run |
| ML-REPL-075 | outcome | implemented | automated-test | Disconnect pauses safely without substituting a drive |
| ML-REPL-076 | invariant | verified | automated-test | Destination writes outside the root are rejected |
| ML-REPL-077 | invariant | implemented | automated-test | Destination library failures do not invalidate the backup |
| ML-REPL-078 | invariant | implemented | automated-test | Thumbnail cache reuse requires a matching source hash |
| ML-REPL-079 | invariant | verified | automated-test | Full copy completes only with zero issues |
| ML-REPL-080 | outcome | verified | automated-test | Full copy out of space is incomplete and does not spill |
| ML-REPL-081 | outcome | implemented | automated-test | Source growth degrades full copy to incomplete |
| ML-REPL-082 | invariant | verified | automated-test | Promotion requires a complete connected full copy |
| ML-REPL-083 | invariant | verified | automated-test | Promotion preserves catalog identity and metadata |
| ML-REPL-084 | invariant | verified | automated-test | Promotion rebases the source root |
| ML-REPL-085 | outcome | verified | automated-test | Old source becomes a demoted destination |
| ML-REPL-086 | invariant | verified | automated-test | Rollback works only before the first change |
| ML-REPL-087 | outcome | implemented | automated-test | Promotion merge failure restores snapshots |
| ML-REPL-088 | invariant | verified | automated-test | Destination-only files stay out of the promoted source |
| ML-REPL-089 | invariant | verified | automated-test | Active source cannot be a destination |
| ML-REPL-090 | invariant | verified | automated-test | Destination media resolves only destination IDs |
| ML-REPL-091 | constraint | verified | automated-test | All destination writes go through the allowlisted writer |
| ML-REPL-092 | invariant | verified | automated-test | No source file content or metadata is modified |
| ML-REPL-093 | invariant | implemented | automated-test | No restore-to-source or destination reveal IPC exists |
| ML-REPL-094 | constraint | verified | automated-test | Backup overview uses aggregate coverage queries |
| ML-REPL-095 | outcome | verified | automated-test | Backup overview recovers from a slow startup read |
| ML-REPL-096 | constraint | verified | automated-test | Run progress never reports verified above planned |
| ML-REPL-097 | outcome | verified | automated-test | A completed run with failed files says so |
| ML-REPL-098 | outcome | verified | automated-test | Unreadable source files have specific error codes |
| ML-REPL-099 | outcome | verified | automated-test | Destination cards separate verification from space |
| ML-REPL-100 | outcome | verified | automated-test | Planner replaces stale and missing replicas on their destination |

## Requirements

### ML-REPL-068 — Copy uses a temp file, hashes once, and renames

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-66
- **Text:** Copy writes to a temp file, hashes the stream once, checks source/size, then renames
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/modules/replication/infrastructure/file-copier.test.ts`
- **Test notes:** From the replication matrix evidence: copier test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-66.
- **Decision:** verified

### ML-REPL-069 — Source change during copy retries once

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-67
- **Text:** Source change during copy discards temp and retries once
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/modules/replication/infrastructure/file-copier.test.ts`
- **Test notes:** From the replication matrix evidence: fault test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-67.
- **Decision:** verified

### ML-REPL-070 — Unknown source hash uses size, mtime, and streamed hash

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-68
- **Text:** Source hash unknown uses size/mtime and streamed hash
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/modules/replication/infrastructure/file-copier.test.ts`
- **Test notes:** From the replication matrix evidence: copier test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-68.
- **Decision:** verified

### ML-REPL-071 — Hash mismatch discards the temp file

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-69
- **Text:** Hash mismatch discards temp and marks failed
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/modules/replication/infrastructure/file-copier.test.ts`
- **Test notes:** From the replication matrix evidence: copier test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-69.
- **Decision:** verified

### ML-REPL-072 — Crash mid-copy leaves no counted partial file

- **Kind:** invariant
- **Status:** implemented
- **Verification:** automated-test
- **Legacy ID:** R-70
- **Text:** Crash mid-copy leaves no partial file counted; temp is cleaned
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** `src/main/modules/replication/infrastructure/file-copier.ts`
- **Proving tests:** _none_
- **Test notes:** No test simulates a crash mid-copy and asserts temp cleanup.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-70.
- **Decision:** implemented

### ML-REPL-073 — Disk full pauses partial and marks full incomplete

- **Kind:** outcome
- **Status:** implemented
- **Verification:** automated-test
- **Legacy ID:** R-71
- **Text:** Disk full pauses partial destination and marks full copy incomplete
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/modules/replication/infrastructure/file-copier.test.ts`
- **Test notes:** Safe free space is covered; disk-full mid-copy behavior is not explicitly asserted.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-71.
- **Decision:** implemented

### ML-REPL-074 — Locked or permission-denied files fail without killing the run

- **Kind:** outcome
- **Status:** implemented
- **Verification:** automated-test
- **Legacy ID:** R-72
- **Text:** Locked/permission-denied file retries, then fails without killing run
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/modules/replication/infrastructure/file-copier.test.ts`
- **Test notes:** Unreadable source is covered; locked or permission-denied retry without killing the run is not explicit.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-72.
- **Decision:** implemented

### ML-REPL-075 — Disconnect pauses safely without substituting a drive

- **Kind:** outcome
- **Status:** implemented
- **Verification:** automated-test
- **Legacy ID:** R-73
- **Text:** Destination/source disconnect pauses safely; no substituted drive
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** _none_
- **Test notes:** No test covers disconnect or substituted-drive behavior.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-73.
- **Decision:** implemented

### ML-REPL-076 — Destination writes outside the root are rejected

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-74
- **Text:** Destination write outside root or via symlink is rejected
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** `src/main/modules/replication/infrastructure/destination-writer.ts`
- **Proving tests:** `src/main/modules/replication/infrastructure/destination-writer.test.ts`
- **Test notes:** From the replication matrix evidence: writer/path test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-74.
- **Decision:** verified

### ML-REPL-077 — Destination library failures do not invalidate the backup

- **Kind:** invariant
- **Status:** implemented
- **Verification:** automated-test
- **Legacy ID:** R-75
- **Text:** Destination local library updates are derived; failure does not invalidate backup
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/repositories/replication-destination-library-repository.test.ts`
- **Test notes:** Destination library rows are covered; failure isolation from the backup is not explicit.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-75.
- **Decision:** implemented

### ML-REPL-078 — Thumbnail cache reuse requires a matching source hash

- **Kind:** invariant
- **Status:** implemented
- **Verification:** automated-test
- **Legacy ID:** R-76
- **Text:** Copied thumbnail cache is reused only when source hash/version matches
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** _none_
- **Test notes:** No test covers thumbnail cache reuse keyed by source hash.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-76.
- **Decision:** implemented

### ML-REPL-079 — Full copy completes only with zero issues

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-77
- **Text:** Full copy completes only with zero stale/missing/conflict/failed/remainder
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/modules/replication/domain/full-copy-status.test.ts`, `tests/integration/replication-full-copy.test.ts`
- **Test notes:** From the replication matrix evidence: full-copy test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-77.
- **Decision:** verified

### ML-REPL-080 — Full copy out of space is incomplete and does not spill

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-78
- **Text:** Full copy out of space becomes incomplete and does not spill
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `tests/integration/replication-full-copy.test.ts`
- **Test notes:** From the replication matrix evidence: full-copy failure test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-78.
- **Decision:** verified

### ML-REPL-081 — Source growth degrades full copy to incomplete

- **Kind:** outcome
- **Status:** implemented
- **Verification:** automated-test
- **Legacy ID:** R-79
- **Text:** Source growth degrades full copy to incomplete with shortfall
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/modules/replication/domain/full-copy-status.test.ts`
- **Test notes:** Full-copy status is covered; source-growth degradation is not explicitly asserted.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-79.
- **Decision:** implemented

### ML-REPL-082 — Promotion requires a complete connected full copy

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-80
- **Text:** Promotion requires complete full copy, connected/confirmed identity, no active work
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/repositories/promotion-merge.test.ts`, `src/main/modules/replication/application/promotion-state.test.ts`, `src/main/modules/replication/domain/promotion-policy.test.ts`
- **Test notes:** From the replication matrix evidence: preflight test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-80.
- **Decision:** verified

### ML-REPL-083 — Promotion preserves catalog identity and metadata

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-81
- **Text:** Promotion preserves `catalog_id`, dates, overrides, duplicates, coverage
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/repositories/promotion-merge.test.ts`, `tests/integration/replication-promotion.test.ts`
- **Test notes:** From the replication matrix evidence: promotion test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-81.
- **Decision:** verified

### ML-REPL-084 — Promotion rebases the source root

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-82
- **Text:** Promotion rebases source root and keeps `source_relative_path` stable
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/repositories/promotion-merge.test.ts`
- **Test notes:** From the replication matrix evidence: promotion test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-82.
- **Decision:** verified

### ML-REPL-085 — Old source becomes a demoted destination

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-83
- **Text:** Old source becomes a demoted destination; 1 TB keep/retire applies
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/repositories/promotion-merge.test.ts`, `tests/integration/replication-promotion-service.test.ts`, `tests/integration/replication-promotion.test.ts`
- **Test notes:** From the replication matrix evidence: promotion test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-83.
- **Decision:** verified

### ML-REPL-086 — Rollback works only before the first change

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-84
- **Text:** Promotion rollback works before first change; refused after
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/modules/replication/application/promotion-state.test.ts`, `src/main/modules/replication/domain/promotion-policy.test.ts`, `tests/integration/replication-promotion-service.test.ts`, `tests/integration/replication-promotion.test.ts`
- **Test notes:** From the replication matrix evidence: promotion test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-84.
- **Decision:** verified

### ML-REPL-087 — Promotion merge failure restores snapshots

- **Kind:** outcome
- **Status:** implemented
- **Verification:** automated-test
- **Legacy ID:** R-85
- **Text:** Promotion merge failure restores snapshots
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/promotion-snapshot-files.test.ts`, `tests/integration/replication-promotion.test.ts`
- **Test notes:** Rollback marker is covered; merge-failure snapshot restore is not explicitly asserted.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-85.
- **Decision:** implemented

### ML-REPL-088 — Destination-only files stay out of the promoted source

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-86
- **Text:** Destination-only files stay out of promoted source; remain local
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/repositories/promotion-merge.test.ts`, `tests/integration/replication-promotion.test.ts`
- **Test notes:** From the replication matrix evidence: promotion extras test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-86.
- **Decision:** verified

### ML-REPL-089 — Active source cannot be a destination

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-87
- **Text:** Active source cannot be registered as a destination in this release
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/modules/replication/application/destination-service.test.ts`
- **Test notes:** From the replication matrix evidence: dedicated-destination test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-87.
- **Decision:** verified

### ML-REPL-090 — Destination media resolves only destination IDs

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-88
- **Text:** Destination-scoped media resolves only destination file IDs
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `tests/integration/replication-media.test.ts`
- **Test notes:** From the replication matrix evidence: media parser test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-88.
- **Decision:** verified

### ML-REPL-091 — All destination writes go through the allowlisted writer

- **Kind:** constraint
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-89
- **Text:** All destination writes are confined to the allowlisted writer
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** `src/main/modules/replication/infrastructure/destination-writer.ts`
- **Proving tests:** `src/main/modules/replication/infrastructure/destination-writer.test.ts`, `tests/integration/read-only-guard.test.ts`
- **Test notes:** From the replication matrix evidence: read-only guard test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-89.
- **Decision:** verified

### ML-REPL-092 — No source file content or metadata is modified

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-90
- **Text:** No source file content or metadata is modified
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `tests/integration/read-only-guard.test.ts`
- **Test notes:** From the replication matrix evidence: hash-before/after test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-90.
- **Decision:** verified

### ML-REPL-093 — No restore-to-source or destination reveal IPC exists

- **Kind:** invariant
- **Status:** implemented
- **Verification:** automated-test
- **Legacy ID:** R-91
- **Text:** No restore-to-source or destination reveal/open IPC exists; source files are never written
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** `src/main/ipc/register-replication-handlers.ts`
- **Proving tests:** _none_
- **Test notes:** No test asserts the absence of restore-to-source and destination reveal/open IPC.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-91.
- **Decision:** implemented

### ML-REPL-094 — Backup overview uses aggregate coverage queries

- **Kind:** constraint
- **Status:** verified
- **Verification:** automated-test
- **Text:** The Backup overview reads aggregate source and coverage counts instead of loading every source file and verified replica row.
- **Sources:** `docs/product/partial-backups.md#12-ui-specification`, `docs/contracts/replication.md`, `docs/product/product-specification.md#13-performance-requirements`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** `src/main/modules/replication/application/plan-service.ts`, `src/main/db/repositories/replication-coverage-repository.ts`, `src/main/clients/db-client.ts`
- **Proving tests:** `src/main/modules/replication/application/plan-service.test.ts`
- **Test notes:** The PlanService overview test asserts the aggregate coverage method is used and the heavy source/coverage list methods are not called; the repository test checks the aggregate values.
- **Conflicts:** _none_
- **Notes:** Performance follow-up for startup/overview timeouts on large catalogs.
- **Decision:** verified

### ML-REPL-095 — Backup overview recovers from a slow startup read

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Text:** The first Backup overview read after opening a large cold catalog uses the long maintenance timeout for its aggregate reads. If a transient read still fails, the page keeps a loading state and offers a Retry action instead of a dead-end error.
- **Sources:** `docs/product/partial-backups.md#12-ui-specification`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** `src/main/clients/db-client.ts`, `src/main/modules/replication/application/plan-service.ts`, `src/renderer/src/features/replication/ReplicationOverviewPage.tsx`
- **Proving tests:** `src/main/clients/db-client.test.ts`, `src/renderer/src/features/replication/ReplicationOverviewPage.test.tsx`
- **Test notes:** The db-client test covers the long timeout for aggregate coverage reads; the overview page test covers the transient error and Retry action.
- **Conflicts:** _none_
- **Notes:** Startup reliability follow-up for large catalogs.
- **Decision:** verified

### ML-REPL-096 — Run progress never reports verified above planned

- **Kind:** constraint
- **Status:** verified
- **Verification:** automated-test
- **Text:** Run progress uses the original planned total or the cumulative verified, failed, stale, and remainder work, so the planned total is never smaller than the verified total. Repeated failures and re-verifications update the run counters by status deltas instead of counting the same file twice.
- **Sources:** `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** `src/main/modules/replication/application/run-state.ts`, `src/main/modules/replication/application/run-service.ts`, `src/main/db/repositories/replication-run-file-repository.ts`
- **Proving tests:** `src/main/db/repositories/replication-run-repository.test.ts`, `src/main/modules/replication/application/run-state.test.ts`
- **Test notes:** run-state and run repository tests cover derived totals and failed-to-verified transitions.
- **Conflicts:** _none_
- **Notes:** Fixes cumulative counters being compared with the last remaining plan.
- **Decision:** verified

### ML-REPL-097 — A completed run with failed files says so

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Text:** A run that finished with failed files is labelled Completed with errors and keeps the failed count visible.
- **Sources:** `docs/product/partial-backups.md#12-ui-specification`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** `src/renderer/src/features/replication/ReplicationRunPage.tsx`
- **Proving tests:** `src/renderer/src/features/replication/ReplicationRunPage.test.tsx`
- **Test notes:** The replication run page test covers the completed-with-errors label and failed count.
- **Conflicts:** _none_
- **Notes:** A successful runner can still leave unreadable or failed files.
- **Decision:** verified

### ML-REPL-098 — Unreadable source files have specific error codes

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Text:** A Windows permission, busy, or missing-file failure is reported as SOURCE_PERMISSION_DENIED, SOURCE_BUSY, or SOURCE_MISSING instead of a generic replication state error.
- **Sources:** `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** `src/main/modules/replication/infrastructure/file-copier.ts`, `src/main/modules/replication/application/run-file-copy.ts`
- **Proving tests:** `src/main/modules/replication/infrastructure/file-copier.test.ts`
- **Test notes:** The file copier test covers EPERM/EACCES, EBUSY, ENOENT, EIO, and unknown mappings.
- **Conflicts:** _none_
- **Notes:** Makes source access failures actionable instead of looking like a replication bug.
- **Decision:** verified

### ML-REPL-099 — Destination cards separate verification from space

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Text:** Each destination card shows source verification with a green check when every present source replica is verified and a yellow warning when any present source replica is unverified. Unverified replicas whose source file is missing do not count as coverage gaps. Drive space is a separate neutral bar. A full drive with no unverified source files is greyed out and marked Full and done; a full drive with unverified files stays yellow and asks for verification.
- **Sources:** `docs/product/partial-backups.md#12-ui-specification`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** `src/renderer/src/features/replication/components.tsx`, `src/renderer/src/features/replication/replication.module.css`, `src/shared/contracts/replication/types.ts`, `src/main/modules/replication/application/destination-summary.ts`, `src/main/db/repositories/replication-destination-repository.ts`, `src/main/db/repositories/replication-coverage-repository.ts`
- **Proving tests:** `src/main/db/repositories/replication-destination-repository.test.ts`, `src/main/modules/replication/application/destination-summary.test.ts`, `src/renderer/src/features/replication/ReplicationOverviewPage.test.tsx`
- **Test notes:** The overview page tests cover verified, unverified, full/done, and full/unverified cards; destination repository tests cover the unverified count and exclusion of source-missing replicas.
- **Conflicts:** _none_
- **Notes:** Verification color is separate from capacity color so a full drive does not look verified.
- **Decision:** verified

### ML-REPL-100 — Planner replaces stale and missing replicas on their destination

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Text:** Before the partial fill, the planner schedules stale and missing replicas on their existing connected destination even when another destination already verifies the source file. Replacement copies are included in the plan's files-to-copy counts and free-after space; replacements that do not fit are reported and are never reassigned.
- **Sources:** `docs/product/partial-backups.md#85-assignment-algorithm`, `docs/product/partial-backups.md#92-stale-replacement`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** `src/main/modules/replication/domain/plan-builder.ts`, `src/main/modules/replication/domain/plan-warnings.ts`, `src/main/modules/replication/domain/replacement-planner.ts`, `src/main/modules/replication/application/plan-service.ts`, `src/main/db/repositories/replication-coverage-repository.ts`, `src/main/db/replication-coverage-db-handlers.ts`, `src/main/db/replication-worker-protocol.ts`
- **Proving tests:** `src/main/db/repositories/replication-coverage-repository.test.ts`, `src/main/modules/replication/domain/plan-builder.test.ts`
- **Test notes:** Plan builder tests cover replacement-first ordering, capacity blocking, and the replacement warnings; the coverage repository test covers the replaceable query.
- **Conflicts:** _none_
- **Notes:** Missing replicas that are already covered elsewhere still heal locally instead of leaving the destination permanently yellow.
- **Decision:** verified

## Conflicts

_No conflicts in this batch._
## Approval

This batch is approved. For future batches, either:

1. change `status` to `accepted` and keep the text;
2. edit `text` in the JSON and keep `needs-review`; or
3. change `status` to `non-goal` if the item is out of scope.

Do not mark a requirement `verified` unless its `verificationMethod` is satisfied:

- `automated-test`: at least one test carries the requirement ID and passes;
- `automated-check`: an implementation or guard path is recorded;
- `manual`: a test note records the manual acceptance;
- `inspection`: an implementation or guard path is recorded.
