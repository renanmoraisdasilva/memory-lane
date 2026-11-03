# Batch 4 review — Replication: schema, adoption, coverage

Status: **implemented**. Requirements: **26**. Conflicts: **1**.

This sheet is generated from `docs/traceability/requirements.json`. This batch is accepted; the matrix is the live view. New requirements start at `needs-review`.

Kinds: outcome 9, invariant 16, constraint 1.

Verification: automated-test 26.

## Summary

| ID | Kind | Status | Verification | Title |
|---|---|---|---|---|
| ML-REPL-001 | outcome | verified | automated-test | Fresh catalogs migrate to the current catalog schema |
| ML-REPL-002 | outcome | verified | automated-test | Schema 6 catalogs migrate without data loss |
| ML-REPL-003 | invariant | verified | automated-test | Archive identity has one stable catalog id |
| ML-REPL-004 | invariant | verified | automated-test | Source membership defaults to source |
| ML-REPL-005 | constraint | verified | automated-test | Replica and run tables enforce constraints |
| ML-REPL-006 | invariant | verified | automated-test | One active run per source |
| ML-REPL-007 | invariant | verified | automated-test | Hash records track source size and modified time |
| ML-REPL-008 | outcome | verified | automated-test | Destination and source catalogs open together |
| ML-REPL-009 | invariant | verified | automated-test | Source cannot be a destination |
| ML-REPL-010 | invariant | verified | automated-test | Duplicate catalog paths are rejected |
| ML-REPL-011 | invariant | verified | automated-test | Destination identity uses volume id and marker |
| ML-REPL-012 | invariant | verified | automated-test | Identical drives are not merged |
| ML-REPL-013 | invariant | verified | automated-test | Overlapping roots are rejected |
| ML-REPL-014 | invariant | verified | automated-test | Destination subfolder survives letter changes |
| ML-REPL-015 | outcome | implemented | automated-test | Destination library resolves after letter change |
| ML-REPL-016 | outcome | verified | automated-test | Missing marker adoption works |
| ML-REPL-017 | outcome | verified | automated-test | Adoption match order is path, name, hash |
| ML-REPL-018 | invariant | verified | automated-test | First-adoption conflict is never overwritten |
| ML-REPL-019 | outcome | verified | automated-test | Stale replacement requires approval |
| ML-REPL-020 | invariant | verified | automated-test | Changed destination file is re-verified |
| ML-REPL-021 | invariant | verified | automated-test | Ambiguous files are reported, never guessed |
| ML-REPL-022 | invariant | verified | automated-test | Only-on-drive extras stay visible and untouched |
| ML-REPL-023 | invariant | verified | automated-test | Source-missing replicas are attention-only |
| ML-REPL-024 | invariant | verified | automated-test | Symlink escapes are rejected |
| ML-REPL-025 | outcome | verified | automated-test | Destination catalog is reused or created once |
| ML-REPL-026 | outcome | implemented | automated-test | Adoption progress survives pause and restart |

## Requirements

### ML-REPL-001 — Fresh catalogs migrate to the current catalog schema

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-01
- **Text:** Fresh catalogs migrate to the current catalog schema.
- **Source text:** Fresh catalogs migrate to the current schema (8)
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/migrations/catalog-replication-migration.test.ts`, `src/main/db/repositories/catalog-repository.test.ts`
- **Test notes:** From the replication matrix evidence: migration test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-01. C-006 removed the stale schema number.
- **Decision:** verified

### ML-REPL-002 — Schema 6 catalogs migrate without data loss

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-02
- **Text:** Existing schema 6 catalogs migrate without losing files, dates, hashes, or coverage
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/migrations/catalog-replication-migration.test.ts`
- **Test notes:** From the replication matrix evidence: migration/backfill test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-02.
- **Decision:** verified

### ML-REPL-003 — Archive identity has one stable catalog id

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-03
- **Text:** `archive_identity` has one stable `catalog_id` and `role = source` for existing archives
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/repositories/catalog-repository.test.ts`
- **Test notes:** From the replication matrix evidence: catalog repository test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-03.
- **Decision:** verified

### ML-REPL-004 — Source membership defaults to source

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-04
- **Text:** `files.source_membership` defaults/backfills to `source`
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/migrations/catalog-replication-migration.test.ts`
- **Test notes:** From the replication matrix evidence: migration test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-04.
- **Decision:** verified

### ML-REPL-005 — Replica and run tables enforce constraints

- **Kind:** constraint
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-05
- **Text:** Replica and run tables enforce status, path, and uniqueness constraints
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/migrations/catalog-replication-migration.test.ts`, `src/main/db/repositories/replication-destination-repository.test.ts`
- **Test notes:** From the replication matrix evidence: repository tests.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-05.
- **Decision:** verified

### ML-REPL-006 — One active run per source

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-06
- **Text:** At most one active run per source is enforced
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/migrations/catalog-replication-migration.test.ts`, `src/main/db/repositories/replication-run-repository.test.ts`
- **Test notes:** From the replication matrix evidence: unique-index/trigger test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-06.
- **Decision:** verified

### ML-REPL-007 — Hash records track source size and modified time

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-07
- **Text:** Hash records store source size and modified time; legacy values rehash only when the file changed after hashing
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/modules/replication/domain/source-hash-trust.test.ts`
- **Test notes:** From the replication matrix evidence: source-hash test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-07.
- **Decision:** verified

### ML-REPL-008 — Destination and source catalogs open together

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-08
- **Text:** A destination catalog can be opened while the source catalog stays open
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/catalog-registry.test.ts`
- **Test notes:** From the replication matrix evidence: catalog-registry test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-08.
- **Decision:** verified

### ML-REPL-009 — Source cannot be a destination

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-09
- **Text:** The source catalog cannot be opened as a destination
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/catalog-registry.test.ts`, `src/main/modules/replication/application/destination-service.test.ts`
- **Test notes:** From the replication matrix evidence: catalog-registry test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-09.
- **Decision:** verified

### ML-REPL-010 — Duplicate catalog paths are rejected

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-10
- **Text:** Duplicate catalog paths are rejected
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/catalog-registry.test.ts`
- **Test notes:** From the replication matrix evidence: catalog-registry test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-10.
- **Decision:** verified

### ML-REPL-011 — Destination identity uses volume id and marker

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-11
- **Text:** Destination is identified by volume ID plus marker `destination_id`
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** `src/main/modules/replication/infrastructure/destination-marker.ts`
- **Proving tests:** `src/main/modules/replication/application/destination-service.test.ts`
- **Test notes:** From the replication matrix evidence: registration test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-11.
- **Decision:** verified

### ML-REPL-012 — Identical drives are not merged

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-12
- **Text:** Two identical drives are not merged by volume ID collision
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/modules/drives/infrastructure/volume-identity.test.ts`, `src/main/modules/replication/application/destination-service.test.ts`
- **Test notes:** From the replication matrix evidence: identity test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-12.
- **Decision:** verified

### ML-REPL-013 — Overlapping roots are rejected

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-13
- **Text:** Same-volume or overlapping source/destination roots are hard-rejected
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/platform/destination-path-policy.test.ts`
- **Test notes:** From the replication matrix evidence: path-policy test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-13.
- **Decision:** verified

### ML-REPL-014 — Destination subfolder survives letter changes

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-14
- **Text:** Destination root subfolder is stored relative and survives letter changes
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/repositories/replication-destination-repository.test.ts`, `src/main/modules/replication/application/destination-service.test.ts`
- **Test notes:** From the replication matrix evidence: registration test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-14.
- **Decision:** verified

### ML-REPL-015 — Destination library resolves after letter change

- **Kind:** outcome
- **Status:** implemented
- **Verification:** automated-test
- **Legacy ID:** R-14a
- **Text:** Destination library resolves files through `relative_path` after a letter change
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/repositories/replication-destination-library-repository.test.ts`
- **Test notes:** Relative-path resolution is covered by the destination-library test; an explicit letter-change assertion is still missing.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-14a.
- **Decision:** implemented

### ML-REPL-016 — Missing marker adoption works

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-15
- **Text:** Missing marker adoption still works
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `tests/integration/replication-adoption.test.ts`
- **Test notes:** From the replication matrix evidence: adoption test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-15.
- **Decision:** verified

### ML-REPL-017 — Adoption match order is path, name, hash

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-16
- **Text:** Adoption matches path/size, unique name/size, then unique hash
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/modules/replication/application/adoption-file-processor.test.ts`
- **Test notes:** From the replication matrix evidence: adoption test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-16.
- **Decision:** verified

### ML-REPL-018 — First-adoption conflict is never overwritten

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-17
- **Text:** First-adoption different hash is a conflict and is never overwritten
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/modules/replication/application/adoption-file-processor.test.ts`
- **Test notes:** From the replication matrix evidence: adoption test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-17.
- **Decision:** verified

### ML-REPL-019 — Stale replacement requires approval

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-18
- **Text:** Prior verified stale copy is replaceable only after approval
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/modules/replication/application/adoption-file-processor.test.ts`, `src/main/modules/replication/infrastructure/file-copier.test.ts`
- **Test notes:** From the replication matrix evidence: replacement test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-18.
- **Decision:** verified

### ML-REPL-020 — Changed destination file is re-verified

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-19
- **Text:** Destination changed or missing file is re-verified before coverage
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/modules/replication/application/adoption-file-processor.test.ts`
- **Test notes:** From the replication matrix evidence: adoption test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-19.
- **Decision:** verified

### ML-REPL-021 — Ambiguous files are reported, never guessed

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-20
- **Text:** Ambiguous file is reported, never guessed
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/modules/replication/application/adoption-file-processor.test.ts`
- **Test notes:** From the replication matrix evidence: adoption test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-20.
- **Decision:** verified

### ML-REPL-022 — Only-on-drive extras stay visible and untouched

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-21
- **Text:** Only-on-drive extra is visible, never coverage, never copied/deleted
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/modules/replication/application/adoption-file-processor.test.ts`
- **Test notes:** From the replication matrix evidence: orphan test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-21.
- **Decision:** verified

### ML-REPL-023 — Source-missing replicas are attention-only

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-22
- **Text:** Source-missing replica is reported as a separate attention count; no restore or reveal/open in the first release
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/repositories/replication-destination-repository.test.ts`
- **Test notes:** From the replication matrix evidence: attention/coverage tests.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-22.
- **Decision:** verified

### ML-REPL-024 — Symlink escapes are rejected

- **Kind:** invariant
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-23
- **Text:** Symlink/junction/reparse escape is skipped or rejected
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/modules/replication/infrastructure/destination-writer.test.ts`
- **Test notes:** From the replication matrix evidence: path-policy test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-23.
- **Decision:** verified

### ML-REPL-025 — Destination catalog is reused or created once

- **Kind:** outcome
- **Status:** verified
- **Verification:** automated-test
- **Legacy ID:** R-24
- **Text:** Destination local catalog is reused or created once
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/db/catalog-registry.test.ts`, `src/main/db/repositories/replication-destination-library-repository.test.ts`
- **Test notes:** From the replication matrix evidence: destination-library test.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-24.
- **Decision:** verified

### ML-REPL-026 — Adoption progress survives pause and restart

- **Kind:** outcome
- **Status:** implemented
- **Verification:** automated-test
- **Legacy ID:** R-24a
- **Text:** Adoption progress is visible; pause, resume, and restart recover the session
- **Sources:** `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`, `docs/product/partial-backups.md#13-acceptance-criteria`, `docs/contracts/replication.md`
- **ADRs:** _none_
- **Contracts:** `docs/contracts/replication.md`
- **Implementation:** _none_
- **Proving tests:** `src/main/modules/replication/application/adoption-runner.test.ts`
- **Test notes:** Pause flushing is covered; restart recovery is not explicitly asserted yet.
- **Conflicts:** _none_
- **Notes:** Legacy replication matrix ID: R-24a.
- **Decision:** implemented

## Conflicts

### C-006 — The replication matrix names schema 8, but the catalog is at 12

- **Severity:** medium
- **Status:** accepted
- **Decision:** Approved: R-01 now says the current catalog schema; R-02 keeps schema 6 as the historical migration path.
- **Affected requirements:** ML-REPL-001, ML-REPL-002

**Claims**

- `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`: R-01 says fresh catalogs migrate to the current schema (8).
- `docs/archive/replication-implementation-plan.md#9-acceptance-criteria-matrix`: R-02 says existing schema 6 catalogs migrate without data loss.

**Contradicted by**

- `docs/contracts/health.md:178`: Catalog schema version: 12.
- `src/main/db/migrations/catalog`: The latest migration is 0012-cleanup-coverage.sql.

**Proposed resolution:** Change R-01 to say "the current catalog schema" without a number, or update it to 12. Keep R-02 as the historical schema 6 migration path, because it describes a real upgrade from an older catalog.

**Recommendation:** Approve the wording change when batch 4 is approved. Do not change the migration tests; they already use CATALOG_SCHEMA_VERSION.

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
