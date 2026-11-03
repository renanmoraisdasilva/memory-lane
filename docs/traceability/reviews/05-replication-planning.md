# Batch 5 review — Replication: coverage and planning

Status: **implemented**. Requirements: **26**. Conflicts: **0**.

This sheet is generated from `docs/traceability/requirements.json`. This batch is accepted; the matrix is the live view. New requirements start at `needs-review`.

Kinds: outcome 12, invariant 13, constraint 1.

## Summary

| ID | Kind | Status | Title |
|---|---|---|---|
| ML-REPL-027 | outcome | verified | Source index is written, timestamped, and readable |
| ML-REPL-028 | invariant | implemented | Marker and source-index failures are warnings |
| ML-REPL-029 | invariant | verified | Union coverage counts each source file once |
| ML-REPL-030 | outcome | verified | Full-copy overlap is labelled separately |
| ML-REPL-031 | invariant | verified | Offline coverage is last-known and qualified |
| ML-REPL-032 | invariant | verified | Retired and lost coverage is excluded |
| ML-REPL-033 | invariant | verified | Missing and orphan files are not current coverage |
| ML-REPL-034 | outcome | verified | Coverage labels name their scope |
| ML-REPL-035 | invariant | verified | No 100% all-destination claim without a full copy |
| ML-REPL-036 | invariant | verified | The plan covers the whole source |
| ML-REPL-037 | invariant | verified | Chronology is oldest-first, undated last |
| ML-REPL-038 | outcome | verified | Partial destinations fill in priority order |
| ML-REPL-039 | invariant | verified | No file goes to two partial destinations |
| ML-REPL-040 | outcome | verified | Full copy receives every source file |
| ML-REPL-041 | outcome | verified | Full-copy and partial jobs are independent |
| ML-REPL-042 | outcome | implemented | Completed full copy is excluded from later runs |
| ML-REPL-043 | invariant | implemented | Offline earlier destination keeps its range |
| ML-REPL-044 | outcome | implemented | Connected-drives-only is opt-in and warns |
| ML-REPL-045 | outcome | verified | Remainder is exact |
| ML-REPL-046 | constraint | verified | Full-copy shortfall is exact |
| ML-REPL-047 | outcome | implemented | Incompatible files try later destinations |
| ML-REPL-048 | outcome | verified | No destinations shows the add state |
| ML-REPL-049 | outcome | verified | All-offline plan stays readable |
| ML-REPL-050 | invariant | implemented | Stale replacement reserve keeps 1 GiB free |
| ML-REPL-051 | invariant | verified | New copies never consume the reserve |
| ML-REPL-052 | invariant | verified | Plan hash changes with inputs |

## Requirements

### ML-REPL-027 — Source index is written, timestamped, and readable

- **Kind:** outcome
- **Status:** verified
- **Legacy ID:** R-25
- **Proposed:** Source index is written, timestamped, and readable without the source
- **Current / source:** Source index is written, timestamped, and readable without the source
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/db/source-index-writer.test.ts`
- **Test notes:** From the replication matrix evidence: source-index test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-25.
- **Decision:** verified

### ML-REPL-028 — Marker and source-index failures are warnings

- **Kind:** invariant
- **Status:** implemented
- **Legacy ID:** R-26
- **Proposed:** Marker/source-index write failure is a warning, not a backup failure
- **Current / source:** Marker/source-index write failure is a warning, not a backup failure
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/infrastructure/destination-marker.test.ts`
- **Test notes:** Marker read failure is covered; source-index write failure warning is not explicitly tested.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-26.
- **Decision:** implemented

### ML-REPL-029 — Union coverage counts each source file once

- **Kind:** invariant
- **Status:** verified
- **Legacy ID:** R-27
- **Proposed:** Union coverage counts each source file once
- **Current / source:** Union coverage counts each source file once
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/domain/coverage.test.ts`
- **Test notes:** From the replication matrix evidence: coverage test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-27.
- **Decision:** verified

### ML-REPL-030 — Full-copy overlap is labelled separately

- **Kind:** outcome
- **Status:** verified
- **Legacy ID:** R-28
- **Proposed:** Intentional full-copy overlap is labelled separately
- **Current / source:** Intentional full-copy overlap is labelled separately
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/domain/coverage.test.ts`
- **Test notes:** From the replication matrix evidence: coverage test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-28.
- **Decision:** verified

### ML-REPL-031 — Offline coverage is last-known and qualified

- **Kind:** invariant
- **Status:** verified
- **Legacy ID:** R-29
- **Proposed:** Offline coverage is last-known and qualified
- **Current / source:** Offline coverage is last-known and qualified
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/domain/coverage.test.ts`
- **Test notes:** From the replication matrix evidence: coverage test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-29.
- **Decision:** verified

### ML-REPL-032 — Retired and lost coverage is excluded

- **Kind:** invariant
- **Status:** verified
- **Legacy ID:** R-30
- **Proposed:** Retired/lost coverage is excluded from active coverage
- **Current / source:** Retired/lost coverage is excluded from active coverage
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/domain/coverage.test.ts`
- **Test notes:** From the replication matrix evidence: coverage test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-30.
- **Decision:** verified

### ML-REPL-033 — Missing and orphan files are not current coverage

- **Kind:** invariant
- **Status:** verified
- **Legacy ID:** R-31
- **Proposed:** Source-missing and orphan files do not count as current coverage
- **Current / source:** Source-missing and orphan files do not count as current coverage
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/domain/coverage.test.ts`
- **Test notes:** From the replication matrix evidence: coverage test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-31.
- **Decision:** verified

### ML-REPL-034 — Coverage labels name their scope

- **Kind:** outcome
- **Status:** verified
- **Legacy ID:** R-32
- **Proposed:** Coverage labels name full copy, partial drives, and all destinations
- **Current / source:** Coverage labels name full copy, partial drives, and all destinations
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/domain/plan-builder.test.ts`
- **Test notes:** From the replication matrix evidence: overview/plan tests. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-32.
- **Decision:** verified

### ML-REPL-035 — No 100% all-destination claim without a full copy

- **Kind:** invariant
- **Status:** verified
- **Legacy ID:** R-33
- **Proposed:** No 100% all-destination claim when no full copy exists
- **Current / source:** No 100% all-destination claim when no full copy exists
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/domain/plan-builder.test.ts`, `src/renderer/src/features/replication/ReplicationPlanPage.test.tsx`
- **Test notes:** From the replication matrix evidence: plan tests. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-33.
- **Decision:** verified

### ML-REPL-036 — The plan covers the whole source

- **Kind:** invariant
- **Status:** verified
- **Legacy ID:** R-34
- **Proposed:** Plan covers the entire present source archive, no file selection
- **Current / source:** Plan covers the entire present source archive, no file selection
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/domain/plan-builder.test.ts`
- **Test notes:** From the replication matrix evidence: plan test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-34.
- **Decision:** verified

### ML-REPL-037 — Chronology is oldest-first, undated last

- **Kind:** invariant
- **Status:** verified
- **Legacy ID:** R-35
- **Proposed:** Oldest-first order; equal dates by path; undated last
- **Current / source:** Oldest-first order; equal dates by path; undated last
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/domain/chronology.test.ts`
- **Test notes:** From the replication matrix evidence: chronology test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-35.
- **Decision:** verified

### ML-REPL-038 — Partial destinations fill in priority order

- **Kind:** outcome
- **Status:** verified
- **Legacy ID:** R-36
- **Proposed:** Partial destinations fill in priority order and stop at allocation
- **Current / source:** Partial destinations fill in priority order and stop at allocation
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/domain/plan-builder.test.ts`
- **Test notes:** From the replication matrix evidence: planner test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-36.
- **Decision:** verified

### ML-REPL-039 — No file goes to two partial destinations

- **Kind:** invariant
- **Status:** verified
- **Legacy ID:** R-37
- **Proposed:** No source file goes to two partial destinations
- **Current / source:** No source file goes to two partial destinations
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/domain/plan-builder.test.ts`, `src/main/modules/replication/infrastructure/file-copier.test.ts`
- **Test notes:** From the replication matrix evidence: planner/copy test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-37.
- **Decision:** verified

### ML-REPL-040 — Full copy receives every source file

- **Kind:** outcome
- **Status:** verified
- **Legacy ID:** R-38
- **Proposed:** Full copy receives every source file independently
- **Current / source:** Full copy receives every source file independently
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/domain/plan-builder.test.ts`, `src/main/modules/replication/infrastructure/file-copier.test.ts`
- **Test notes:** From the replication matrix evidence: planner/copy test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-38.
- **Decision:** verified

### ML-REPL-041 — Full-copy and partial jobs are independent

- **Kind:** outcome
- **Status:** verified
- **Legacy ID:** R-39
- **Proposed:** Full copy and partial jobs can each be absent or both present
- **Current / source:** Full copy and partial jobs can each be absent or both present
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/domain/plan-builder.test.ts`, `src/renderer/src/features/replication/ReplicationPlanPage.test.tsx`
- **Test notes:** From the replication matrix evidence: plan tests. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-39.
- **Decision:** verified

### ML-REPL-042 — Completed full copy is excluded from later runs

- **Kind:** outcome
- **Status:** implemented
- **Legacy ID:** R-40
- **Proposed:** Completed full copy is excluded from default later runs
- **Current / source:** Completed full copy is excluded from default later runs
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/domain/plan-builder.test.ts`
- **Test notes:** Promotion-ready state is covered; exclusion from a later default run is not explicitly asserted.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-40.
- **Decision:** implemented

### ML-REPL-043 — Offline earlier destination keeps its range

- **Kind:** invariant
- **Status:** implemented
- **Legacy ID:** R-41
- **Proposed:** Offline earlier destination keeps its range; later destinations do not steal it
- **Current / source:** Offline earlier destination keeps its range; later destinations do not steal it
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/domain/plan-builder.test.ts`
- **Test notes:** All-offline start blocking is covered; earlier offline range retention is not explicitly asserted.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-41.
- **Decision:** implemented

### ML-REPL-044 — Connected-drives-only is opt-in and warns

- **Kind:** outcome
- **Status:** implemented
- **Legacy ID:** R-42
- **Proposed:** Connected-drives-only mode is advanced, off by default, and warns
- **Current / source:** Connected-drives-only mode is advanced, off by default, and warns
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/domain/plan-builder.test.ts`
- **Test notes:** Plan warnings are covered; connected-drives-only opt-in and default are not explicitly asserted.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-42.
- **Decision:** implemented

### ML-REPL-045 — Remainder is exact

- **Kind:** outcome
- **Status:** verified
- **Legacy ID:** R-43
- **Proposed:** Exact remainder count, bytes, and starting date are reported
- **Current / source:** Exact remainder count, bytes, and starting date are reported
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/domain/plan-builder.test.ts`
- **Test notes:** From the replication matrix evidence: plan test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-43.
- **Decision:** verified

### ML-REPL-046 — Full-copy shortfall is exact

- **Kind:** constraint
- **Status:** verified
- **Legacy ID:** R-44
- **Proposed:** Full-copy shortfall is exact; default blocks; explicit partial fallback allowed
- **Current / source:** Full-copy shortfall is exact; default blocks; explicit partial fallback allowed
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/domain/plan-builder.test.ts`, `tests/integration/replication-full-copy.test.ts`
- **Test notes:** From the replication matrix evidence: capacity test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-44.
- **Decision:** verified

### ML-REPL-047 — Incompatible files try later destinations

- **Kind:** outcome
- **Status:** implemented
- **Legacy ID:** R-45
- **Proposed:** Incompatible file tries later destinations and reports unused capacity
- **Current / source:** Incompatible file tries later destinations and reports unused capacity
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/domain/plan-builder.test.ts`
- **Test notes:** No test covers incompatible-file fallback yet.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-45.
- **Decision:** implemented

### ML-REPL-048 — No destinations shows the add state

- **Kind:** outcome
- **Status:** verified
- **Legacy ID:** R-46
- **Proposed:** No destinations shows add-destination state and disables Start
- **Current / source:** No destinations shows add-destination state and disables Start
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/domain/plan-builder.test.ts`
- **Test notes:** From the replication matrix evidence: overview test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-46.
- **Decision:** verified

### ML-REPL-049 — All-offline plan stays readable

- **Kind:** outcome
- **Status:** verified
- **Legacy ID:** R-47
- **Proposed:** All destinations offline keeps plan readable but disables Start
- **Current / source:** All destinations offline keeps plan readable but disables Start
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/domain/plan-builder.test.ts`
- **Test notes:** From the replication matrix evidence: plan test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-47.
- **Decision:** verified

### ML-REPL-050 — Stale replacement reserve keeps 1 GiB free

- **Kind:** invariant
- **Status:** implemented
- **Legacy ID:** R-48
- **Proposed:** Stale replacement reserve use is shown and keeps 1 GiB free
- **Current / source:** Stale replacement reserve use is shown and keeps 1 GiB free
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/application/destination-summary.test.ts`
- **Test notes:** Safe capacity is covered; the stale-replacement reserve floor is not explicitly asserted.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-48.
- **Decision:** implemented

### ML-REPL-051 — New copies never consume the reserve

- **Kind:** invariant
- **Status:** verified
- **Legacy ID:** R-49
- **Proposed:** New copies never consume the reserve
- **Current / source:** New copies never consume the reserve
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/application/destination-summary.test.ts`
- **Test notes:** From the replication matrix evidence: capacity/copy test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-49.
- **Decision:** verified

### ML-REPL-052 — Plan hash changes with inputs

- **Kind:** invariant
- **Status:** verified
- **Legacy ID:** R-50
- **Proposed:** Plan hash changes when source or destination inputs change
- **Current / source:** Plan hash changes when source or destination inputs change
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/domain/plan-builder.test.ts`
- **Test notes:** From the replication matrix evidence: plan hash test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-50.
- **Decision:** verified

## Conflicts

_No conflicts in this batch._
## Approval

This batch is approved. For future batches, either:

1. change `status` to `accepted` and keep the proposed text;
2. edit `proposedText` in the JSON and keep `needs-review`; or
3. change `status` to `non-goal` if the item is out of scope.

Do not mark a requirement `verified` until at least one test carries its ID and the test result is green.
