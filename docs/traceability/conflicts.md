# Traceability conflicts

Generated from `docs/traceability/requirements.json`.

### C-001 — The read-only promise and the quarantine mover disagree

- **Severity:** high
- **Status:** accepted
- **Decision:** Adopt the product-spec wording; update README, acceptance row 2, scan.md, other-files.md, and security review; add ADR-0010.
- **Affected requirements:** ML-SAFE-002, ML-SAFE-008

**Claims**

- `README.md:7`: It never moves, renames, edits, or deletes the originals.
- `docs/release/acceptance.md:8`: Original files are never moved, renamed, edited, or deleted.
- `docs/contracts/scan.md:123`: source files are never moved or modified.
- `docs/contracts/other-files.md:37`: The app never moves, renames, edits, or deletes an original.
- `docs/release/security-review.md:55`: No module is allowed to write, rename, truncate, or delete an original archive file.

**Contradicted by**

- `docs/contracts/health.md:53`: This is the only Memory Lane action that moves archive files. It never deletes them.
- `docs/product/product-specification.md:20-22`: The single exception is the explicit duplicate quarantine, which moves only confirmed duplicate copies into X:\.memorylane_quarantine. Nothing is deleted or edited.
- `docs/product/duplicate-quarantine-plan.md:3`: Status: implemented (MVP).

**Proposed resolution:** Adopt the product-spec wording: originals are never deleted or edited; the quarantine mover is the only operation that may move an eligible duplicate copy, after explicit confirmation. Update README, acceptance row 2, scan contract, other-files contract, and security review. Add ADR-0010 for the quarantine exception.

**Recommendation:** Approve the exception and update all five stale claims. Do not remove the quarantine feature; it is implemented and tested.

### C-002 — The security review does not list the quarantine mover

- **Severity:** high
- **Status:** accepted
- **Decision:** Add a Duplicate quarantine extension section and allowlist the quarantine mover.
- **Affected requirements:** ML-SAFE-004, ML-SAFE-005

**Claims**

- `docs/release/security-review.md:45-56`: The read-only guard allowlist names catalog locks, thumbnails, HEIC previews, video proxies, cache deletion, and databases/logs/backups. It does not name the quarantine mover.

**Contradicted by**

- `docs/contracts/health.md:83-84`: Scans exclude .memorylane_quarantine; the read-only guard allows only the quarantine mover to rename source files.
- `docs/product/scope-and-implementation.md:273-275`: check-read-only.mjs fails the quality gate if direct filesystem write APIs appear outside the reviewed cache/lock/backup/quarantine allowlist.

**Proposed resolution:** Add a 'Duplicate quarantine extension' section to the security review. Name the quarantine mover in the allowlist, state the re-hash/restore guardrail, and confirm the source is read-only outside that adapter.

**Recommendation:** Approve and update the security review before the next release sign-off.

### C-003 — The quarantine feature is implemented but not indexed or accepted

- **Severity:** medium
- **Status:** accepted
- **Decision:** Add ADR-0010, docs index entries, the README docs table, roadmap state, and a post-v0.1 acceptance section.
- **Affected requirements:** ML-QUAR-001, ML-QUAR-015

**Claims**

- `docs/product/duplicate-quarantine-plan.md:3`: Status: implemented (MVP).

**Contradicted by**

- `docs/README.md`: The docs index does not list duplicate-quarantine-plan.md.
- `README.md:328-349`: The README documentation table does not list the quarantine plan.
- `docs/adr/README.md`: There is no ADR-0010 for the quarantine exception.
- `docs/product/roadmap.md`: The roadmap does not mention duplicate quarantine.
- `docs/release/acceptance.md`: The acceptance criteria do not include quarantine.

**Proposed resolution:** Add the plan to docs/README.md and the README docs table; add it to the roadmap's delivered state; add ADR-0010; add quarantine acceptance rows; link the plan from the health contract.

**Recommendation:** Approve the documentation set before calling the feature implemented in the release record.

### C-004 — Catalog schema version references disagree

- **Severity:** medium
- **Status:** accepted
- **Decision:** Update scan.md and settings.md to schema 12; add a docs check that reads the migration folder.
- **Affected requirements:** _none_

**Claims**

- `docs/contracts/health.md:178`: Catalog schema version: 12.
- `docs/contracts/scan.md:162`: The current catalog schema version is 9.
- `docs/contracts/settings.md:63`: catalog schema is version 6 after the video-frame-rate and ...

**Contradicted by**

- `src/main/db/migrations/catalog`: The latest migration is 0012-cleanup-coverage.sql.

**Proposed resolution:** Update scan.md and settings.md to the current schema version (12). Add a docs check that reads the migration folder and fails on a stale reference.

**Recommendation:** Fix the two stale references now; add the automated check in the traceability script.

### C-005 — Published test counts disagree with the tree

- **Severity:** low
- **Status:** accepted
- **Decision:** Remove exact counts from prose; link to the generated traceability matrix.
- **Affected requirements:** _none_

**Claims**

- `README.md, docs/product/scope-and-implementation.md, docs/product/roadmap.md`: 545 tests across 137 files.

**Contradicted by**

- `committed tree`: 551 test declarations across 138 unit/integration files.
- `current working tree`: 579 test declarations across 144 files.

**Proposed resolution:** Generate the counts from the test run and update the docs, or remove the exact counts from prose and link to the test report.

**Recommendation:** Remove hand-written counts from prose; publish a generated count in the traceability matrix.

### C-006 — The replication matrix names schema 8, but the catalog is at 12

- **Severity:** medium
- **Status:** accepted
- **Decision:** Approved: R-01 now says the current catalog schema; R-02 keeps schema 6 as the historical migration path.
- **Affected requirements:** ML-REPL-001, ML-REPL-002

**Claims**

- `docs/product/replication-implementation-plan.md#9-acceptance-criteria-matrix`: R-01 says fresh catalogs migrate to the current schema (8).
- `docs/product/replication-implementation-plan.md#9-acceptance-criteria-matrix`: R-02 says existing schema 6 catalogs migrate without data loss.

**Contradicted by**

- `docs/contracts/health.md:178`: Catalog schema version: 12.
- `src/main/db/migrations/catalog`: The latest migration is 0012-cleanup-coverage.sql.

**Proposed resolution:** Change R-01 to say "the current catalog schema" without a number, or update it to 12. Keep R-02 as the historical schema 6 migration path, because it describes a real upgrade from an older catalog.

**Recommendation:** Approve the wording change when batch 4 is approved. Do not change the migration tests; they already use CATALOG_SCHEMA_VERSION.

### C-007 — The product spec calls the PC backup catalog-only, but the contract backs up app.db too

- **Severity:** medium
- **Status:** accepted
- **Decision:** Approved: update product-specification section 8 and section 17 to name both SQLite databases; keep the generated cache excluded.
- **Affected requirements:** ML-SET-004, ML-SET-005

**Claims**

- `docs/product/product-specification.md:184-198 (before C-007)`: The SQLite catalog should be backed up automatically; the PC backup is an additional copy of the catalog only.
- `docs/product/product-specification.md:728 (before C-007)`: The SQLite catalog is backed up to the PC every 15 minutes while open and on close.

**Contradicted by**

- `docs/contracts/settings.md:34`: Backs up both `catalog.db` and `app.db`.
- `docs/adr/0003-scheduled-backups-and-cache.md:14`: Back up both `catalog.db` and `app.db` with the SQLite online backup API.
- `docs/product/scope-and-implementation.md:378`: `catalog.db` and `app.db` are backed up with the SQLite online backup API.

**Proposed resolution:** Update product-specification.md section 8 and section 17 to say both SQLite databases (catalog.db and app.db) are backed up, while the generated cache remains excluded. Keep the user-facing name 'catalog backup'.

**Recommendation:** Approve the contract/ADR behavior and update the two stale product-spec sentences. Do not stop backing up app.db; it holds drive registration and backup history.
