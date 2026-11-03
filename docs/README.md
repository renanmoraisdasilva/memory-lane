# Memory Lane documentation

Start with the product scope, then use the contracts and release material as
needed.

## Product and delivery

| Document | Purpose |
|---|---|
| [`product/product-specification.md`](product/product-specification.md) | Product vision, requirements, and long-term direction |
| [`product/scope-and-implementation.md`](product/scope-and-implementation.md) | Current v0.1 scope, architecture, data model, quality gates, and exception policy |
| [`product/roadmap.md`](product/roadmap.md) | Delivered phases, current status, and remaining work |
| [`product/partial-backups.md`](product/partial-backups.md) | Current replication behavior: adoption, partial and full copies, destination libraries, and source promotion |
| [`product/duplicate-quarantine-plan.md`](product/duplicate-quarantine-plan.md) | Implemented duplicate quarantine: keeper rule, eligibility, guardrails, and edge cases |
| [`traceability/README.md`](traceability/README.md) | Requirement ledger, review workflow, generated matrix, and conflicts |
| [`traceability/matrix.md`](traceability/matrix.md) | Generated requirement-to-test matrix and current status |

## Contracts

| Document | Purpose |
|---|---|
| [`contracts/scan.md`](contracts/scan.md) | Scan IPC, state, stages, and reports |
| [`contracts/library.md`](contracts/library.md) | Library IPC, timeline, media protocol, viewer |
| [`contracts/health.md`](contracts/health.md) | Library health IPC, duplicates, missing/moved files, validation |
| [`contracts/other-files.md`](contracts/other-files.md) | Other files IPC, categories, pagination, actions |
| [`contracts/settings.md`](contracts/settings.md) | Settings, cache clearing, backups, manual recovery |
| [`contracts/replication.md`](contracts/replication.md) | Replication IPC, DB methods, run states, destination catalogs, media scope, promotion |

## Release and quality

| Document | Purpose |
|---|---|
| [`release/acceptance.md`](release/acceptance.md) | v0.1, replication, and duplicate-quarantine acceptance summary and sign-off status |
| [`release/release-checklist.md`](release/release-checklist.md) | Clean-VM, recovery, disconnect, codec, real-archive, and replication pass |
| [`release/security-review.md`](release/security-review.md) | Trust boundaries, controls, and residual risks |
| [`release/codec-matrix.md`](release/codec-matrix.md) | Image/video cataloging, playback expectations, fallbacks |
| [`release/third-party-notices.md`](release/third-party-notices.md) | Bundled FFmpeg version, license, and source notice |

Requirement-level evidence and pass/fail status live in
[`traceability/matrix.md`](traceability/matrix.md); `release/acceptance.md` is
the human acceptance summary.

## Decisions, archive, and history

| Document | Purpose |
|---|---|
| [`adr/`](adr/README.md) | Architecture decision records and template |
| [`archive/phase-history.md`](archive/phase-history.md) | Preserved Phase 3-6 scope, decisions, tests, and known limits |
| [`archive/replication-design-detail.md`](archive/replication-design-detail.md) | Archived data model, test plan, resolved decisions, and implementation phases |
| [`archive/replication-implementation-plan.md`](archive/replication-implementation-plan.md) | Archived delivery plan, module layout, risks, and acceptance matrix |
| [`archive/agent-workstreams.md`](archive/agent-workstreams.md) | Archived parallel-agent operating agreement |

The static files in `ui-mockups/` are a design reference only. Screenshots in
`images/` are captured from the packaged application.

## Maintenance rules

- Keep current behavior in `product/` and `contracts/`.
- Keep decisions in `adr/`.
- Keep completed phase and implementation detail in `archive/`, not in new
  top-level files.
- Update the owning contract when IPC, schema, or user-visible behavior changes.
- Do not add a new document when an existing product, contract, release, or ADR
  document has the right home.
- Traceability review sheets and `matrix.md` are generated from
  `requirements.json`; do not edit them by hand.
