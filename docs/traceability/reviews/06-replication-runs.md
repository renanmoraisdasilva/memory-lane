# Batch 6 review — Replication: run controls and failures

Status: **implemented**. Requirements: **15**. Conflicts: **0**.

This sheet is generated from `docs/traceability/requirements.json`. This batch is accepted; the matrix is the live view. New requirements start at `needs-review`.

Kinds: outcome 8, invariant 6, constraint 1.

Verification: automated-test 15.

## Summary

| ID | Kind | Status | Verification | Title |
|---|---|---|---|---|
| ML-REPL-053 | outcome | verified | automated-test | Start creates one run and opens it |
| ML-REPL-054 | invariant | verified | automated-test | Second Start opens the active run |
| ML-REPL-055 | outcome | verified | automated-test | Pause persists progress |
| ML-REPL-056 | invariant | verified | automated-test | Resume continues without recopying |
| ML-REPL-057 | outcome | verified | automated-test | Stop keeps verified files |
| ML-REPL-058 | outcome | verified | automated-test | Shutdown marks the run interrupted |
| ML-REPL-059 | outcome | implemented | automated-test | Every screen can reach the run |
| ML-REPL-060 | invariant | implemented | automated-test | Plan and destination edits lock while running |
| ML-REPL-061 | outcome | verified | automated-test | Pause unlocks plan and destination edits |
| ML-REPL-062 | outcome | verified | automated-test | Replan increments the revision and appends an event |
| ML-REPL-063 | invariant | implemented | automated-test | Replan never recopies verified files |
| ML-REPL-064 | outcome | implemented | automated-test | Adding a destination during a run queues it |
| ML-REPL-065 | invariant | verified | automated-test | Promotion is blocked while a run is active |
| ML-REPL-066 | invariant | verified | automated-test | Source switching is blocked while a run is active |
| ML-REPL-067 | constraint | verified | automated-test | Scan, validation, and replication are exclusive |

## Requirements

### ML-REPL-053 — Start creates one run and opens it

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-51
- **Text:** Start run creates one run and opens the run route
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `tests/integration/replication-run-controls.test.ts`
- **Test notes:** From the replication matrix evidence: run test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-51.
- **Decision:** verified

### ML-REPL-054 — Second Start opens the active run

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-52
- **Text:** Second Start opens the active run instead of creating another
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `tests/integration/replication-run-controls.test.ts`
- **Test notes:** From the replication matrix evidence: run test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-52.
- **Decision:** verified

### ML-REPL-055 — Pause persists progress

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-53
- **Text:** Pause finishes the current file and persists progress
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/renderer/src/features/replication/ReplicationRunPage.test.tsx`, `tests/integration/replication-run-controls.test.ts`
- **Test notes:** From the replication matrix evidence: run-controls test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-53.
- **Decision:** verified

### ML-REPL-056 — Resume continues without recopying

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-54
- **Text:** Resume continues without recopying verified files
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/renderer/src/features/replication/ReplicationRunPage.test.tsx`, `tests/integration/replication-run-controls.test.ts`
- **Test notes:** From the replication matrix evidence: run-controls test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-54.
- **Decision:** verified

### ML-REPL-057 — Stop keeps verified files

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-55
- **Text:** Stop after current file ends in `stopped` and keeps verified files
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `tests/integration/replication-run-controls.test.ts`
- **Test notes:** From the replication matrix evidence: run-controls test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-55.
- **Decision:** verified

### ML-REPL-058 — Shutdown marks the run interrupted

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-56
- **Text:** App shutdown marks the run `interrupted`; restart offers resume
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `tests/integration/replication-run-controls.test.ts`
- **Test notes:** From the replication matrix evidence: recovery test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-56.
- **Decision:** verified

### ML-REPL-059 — Every screen can reach the run

- **Kind:** outcome
- **Status:** implemented
- **Verification:** automated-test
- **Legacy ID:** R-57
- **Text:** Every screen can reach the run via chip/banner
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** _none_
- **Test notes:** No test covers run reachability from every screen.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-57.
- **Decision:** implemented

### ML-REPL-060 — Plan and destination edits lock while running

- **Kind:** invariant
- **Status:** implemented
- **Verification:** automated-test
- **Legacy ID:** R-58
- **Text:** Plan and destination edits are locked while running; reason is shown
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** _none_
- **Test notes:** No test asserts plan and destination edits are locked while running.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-58.
- **Decision:** implemented

### ML-REPL-061 — Pause unlocks plan and destination edits

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-59
- **Text:** Pause unlocks plan/destination edits
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `tests/integration/replication-run-controls.test.ts`
- **Test notes:** From the replication matrix evidence: paused-state test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-59.
- **Decision:** verified

### ML-REPL-062 — Replan increments the revision and appends an event

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-60
- **Text:** Replan increments `planRevision` and appends an event
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `tests/integration/replication-run-controls.test.ts`
- **Test notes:** From the replication matrix evidence: run/replan test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-60.
- **Decision:** verified

### ML-REPL-063 — Replan never recopies verified files

- **Kind:** invariant
- **Status:** implemented
- **Verification:** automated-test
- **Legacy ID:** R-61
- **Text:** Verified files are never moved or recopied by replan
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** `src/main/modules/replication/domain/plan-builder.ts`
- **Proving tests:** _none_
- **Test notes:** No test asserts replan never recopies verified files.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-61.
- **Decision:** implemented

### ML-REPL-064 — Adding a destination during a run queues it

- **Kind:** outcome
- **Status:** implemented
- **Verification:** automated-test
- **Legacy ID:** R-62
- **Text:** Adding a destination during a run is queued for the next plan
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** _none_
- **Test notes:** No test covers adding a destination during a run.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-62.
- **Decision:** implemented

### ML-REPL-065 — Promotion is blocked while a run is active

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-63
- **Text:** Promotion is blocked while running or paused
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/modules/replication/domain/promotion-policy.test.ts`
- **Test notes:** From the replication matrix evidence: promotion test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-63.
- **Decision:** verified

### ML-REPL-066 — Source switching is blocked while a run is active

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-64
- **Text:** Source switching is blocked while running or paused
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `tests/integration/replication-run-controls.test.ts`
- **Test notes:** From the replication matrix evidence: switch-guard test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-64.
- **Decision:** verified

### ML-REPL-067 — Scan, validation, and replication are exclusive

- **Kind:** constraint
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-65
- **Text:** Scan/validation and replication cannot run together
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/modules/workloads/application/workload-coordinator.test.ts`, `tests/integration/scan-service.test.ts`
- **Test notes:** From the replication matrix evidence: workload test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-65.
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
