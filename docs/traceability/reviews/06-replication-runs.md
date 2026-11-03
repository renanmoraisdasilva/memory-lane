# Batch 6 review — Replication: run controls and failures

Status: **implemented**. Requirements: **15**. Conflicts: **0**.

This sheet is generated from `docs/traceability/requirements.json`. This batch is accepted; the matrix is the live view. New requirements start at `needs-review`.

Kinds: outcome 8, invariant 6, constraint 1.

## Summary

| ID | Kind | Status | Title |
|---|---|---|---|
| ML-REPL-053 | outcome | verified | Start creates one run and opens it |
| ML-REPL-054 | invariant | verified | Second Start opens the active run |
| ML-REPL-055 | outcome | verified | Pause persists progress |
| ML-REPL-056 | invariant | verified | Resume continues without recopying |
| ML-REPL-057 | outcome | verified | Stop keeps verified files |
| ML-REPL-058 | outcome | verified | Shutdown marks the run interrupted |
| ML-REPL-059 | outcome | implemented | Every screen can reach the run |
| ML-REPL-060 | invariant | implemented | Plan and destination edits lock while running |
| ML-REPL-061 | outcome | verified | Pause unlocks plan and destination edits |
| ML-REPL-062 | outcome | verified | Replan increments the revision and appends an event |
| ML-REPL-063 | invariant | implemented | Replan never recopies verified files |
| ML-REPL-064 | outcome | implemented | Adding a destination during a run queues it |
| ML-REPL-065 | invariant | verified | Promotion is blocked while a run is active |
| ML-REPL-066 | invariant | verified | Source switching is blocked while a run is active |
| ML-REPL-067 | constraint | verified | Scan, validation, and replication are exclusive |

## Requirements

### ML-REPL-053 — Start creates one run and opens it

- **Kind:** outcome
- **Status:** verified
- **Legacy ID:** R-51
- **Proposed:** Start run creates one run and opens the run route
- **Current / source:** Start run creates one run and opens the run route
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `tests/integration/replication-run-controls.test.ts`
- **Test notes:** From the replication matrix evidence: run test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-51.
- **Decision:** verified

### ML-REPL-054 — Second Start opens the active run

- **Kind:** invariant
- **Status:** verified
- **Legacy ID:** R-52
- **Proposed:** Second Start opens the active run instead of creating another
- **Current / source:** Second Start opens the active run instead of creating another
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `tests/integration/replication-run-controls.test.ts`
- **Test notes:** From the replication matrix evidence: run test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-52.
- **Decision:** verified

### ML-REPL-055 — Pause persists progress

- **Kind:** outcome
- **Status:** verified
- **Legacy ID:** R-53
- **Proposed:** Pause finishes the current file and persists progress
- **Current / source:** Pause finishes the current file and persists progress
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `tests/integration/replication-run-controls.test.ts`
- **Test notes:** From the replication matrix evidence: run-controls test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-53.
- **Decision:** verified

### ML-REPL-056 — Resume continues without recopying

- **Kind:** invariant
- **Status:** verified
- **Legacy ID:** R-54
- **Proposed:** Resume continues without recopying verified files
- **Current / source:** Resume continues without recopying verified files
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `tests/integration/replication-run-controls.test.ts`
- **Test notes:** From the replication matrix evidence: run-controls test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-54.
- **Decision:** verified

### ML-REPL-057 — Stop keeps verified files

- **Kind:** outcome
- **Status:** verified
- **Legacy ID:** R-55
- **Proposed:** Stop after current file ends in `stopped` and keeps verified files
- **Current / source:** Stop after current file ends in `stopped` and keeps verified files
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `tests/integration/replication-run-controls.test.ts`
- **Test notes:** From the replication matrix evidence: run-controls test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-55.
- **Decision:** verified

### ML-REPL-058 — Shutdown marks the run interrupted

- **Kind:** outcome
- **Status:** verified
- **Legacy ID:** R-56
- **Proposed:** App shutdown marks the run `interrupted`; restart offers resume
- **Current / source:** App shutdown marks the run `interrupted`; restart offers resume
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `tests/integration/replication-run-controls.test.ts`
- **Test notes:** From the replication matrix evidence: recovery test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-56.
- **Decision:** verified

### ML-REPL-059 — Every screen can reach the run

- **Kind:** outcome
- **Status:** implemented
- **Legacy ID:** R-57
- **Proposed:** Every screen can reach the run via chip/banner
- **Current / source:** Every screen can reach the run via chip/banner
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `tests/integration/replication-run-controls.test.ts`
- **Test notes:** No test covers run reachability from every screen.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-57.
- **Decision:** implemented

### ML-REPL-060 — Plan and destination edits lock while running

- **Kind:** invariant
- **Status:** implemented
- **Legacy ID:** R-58
- **Proposed:** Plan and destination edits are locked while running; reason is shown
- **Current / source:** Plan and destination edits are locked while running; reason is shown
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `tests/integration/replication-run-controls.test.ts`
- **Test notes:** No test asserts plan and destination edits are locked while running.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-58.
- **Decision:** implemented

### ML-REPL-061 — Pause unlocks plan and destination edits

- **Kind:** outcome
- **Status:** verified
- **Legacy ID:** R-59
- **Proposed:** Pause unlocks plan/destination edits
- **Current / source:** Pause unlocks plan/destination edits
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `tests/integration/replication-run-controls.test.ts`
- **Test notes:** From the replication matrix evidence: paused-state test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-59.
- **Decision:** verified

### ML-REPL-062 — Replan increments the revision and appends an event

- **Kind:** outcome
- **Status:** verified
- **Legacy ID:** R-60
- **Proposed:** Replan increments `planRevision` and appends an event
- **Current / source:** Replan increments `planRevision` and appends an event
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `tests/integration/replication-run-controls.test.ts`
- **Test notes:** From the replication matrix evidence: run/replan test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-60.
- **Decision:** verified

### ML-REPL-063 — Replan never recopies verified files

- **Kind:** invariant
- **Status:** implemented
- **Legacy ID:** R-61
- **Proposed:** Verified files are never moved or recopied by replan
- **Current / source:** Verified files are never moved or recopied by replan
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `tests/integration/replication-run-controls.test.ts`
- **Test notes:** No test asserts replan never recopies verified files.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-61.
- **Decision:** implemented

### ML-REPL-064 — Adding a destination during a run queues it

- **Kind:** outcome
- **Status:** implemented
- **Legacy ID:** R-62
- **Proposed:** Adding a destination during a run is queued for the next plan
- **Current / source:** Adding a destination during a run is queued for the next plan
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `tests/integration/replication-run-controls.test.ts`
- **Test notes:** No test covers adding a destination during a run.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-62.
- **Decision:** implemented

### ML-REPL-065 — Promotion is blocked while a run is active

- **Kind:** invariant
- **Status:** verified
- **Legacy ID:** R-63
- **Proposed:** Promotion is blocked while running or paused
- **Current / source:** Promotion is blocked while running or paused
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/replication/domain/promotion-policy.test.ts`, `src/renderer/src/features/replication/ReplicationPromotionPage.test.tsx`
- **Test notes:** From the replication matrix evidence: promotion test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-63.
- **Decision:** verified

### ML-REPL-066 — Source switching is blocked while a run is active

- **Kind:** invariant
- **Status:** verified
- **Legacy ID:** R-64
- **Proposed:** Source switching is blocked while running or paused
- **Current / source:** Source switching is blocked while running or paused
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `tests/integration/replication-run-controls.test.ts`
- **Test notes:** From the replication matrix evidence: switch-guard test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-64.
- **Decision:** verified

### ML-REPL-067 — Scan, validation, and replication are exclusive

- **Kind:** constraint
- **Status:** verified
- **Legacy ID:** R-65
- **Proposed:** Scan/validation and replication cannot run together
- **Current / source:** Scan/validation and replication cannot run together
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Existing tests:** `src/main/modules/workloads/application/workload-coordinator.test.ts`, `tests/integration/scan-service.test.ts`
- **Test notes:** From the replication matrix evidence: workload test. Candidate test file, not yet ID-tagged.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-65.
- **Decision:** verified

## Conflicts

_No conflicts in this batch._
## Approval

This batch is approved. For future batches, either:

1. change `status` to `accepted` and keep the proposed text;
2. edit `proposedText` in the JSON and keep `needs-review`; or
3. change `status` to `non-goal` if the item is out of scope.

Do not mark a requirement `verified` until at least one test carries its ID and the test result is green.
