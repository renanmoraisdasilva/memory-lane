# Memory Lane documentation

Start with the product scope, then use the contracts and release material as
needed.

## Product and delivery

| Document | Purpose |
|---|---|
| [`product/product-specification.md`](product/product-specification.md) | Product vision, requirements, and long-term direction |
| [`product/scope-and-implementation.md`](product/scope-and-implementation.md) | Current v0.1 scope, architecture, data model, quality gates, and exception policy |
| [`product/roadmap.md`](product/roadmap.md) | Delivered phases, current status, and remaining work |
| [`product/partial-backups.md`](product/partial-backups.md) | Post-v0.1 partial and full replication, destination libraries, and source promotion |
| [`product/replication-implementation-plan.md`](product/replication-implementation-plan.md) | Replication module layout, delivery slices, risks, and acceptance-test matrix |
| [`archive/phase-history.md`](archive/phase-history.md) | Preserved Phase 3-6 scope, decisions, tests, and known limits |

## Contracts

| Document | Purpose |
|---|---|
| [`contracts/scan.md`](contracts/scan.md) | Scan IPC, state, stages, and reports |
| [`contracts/library.md`](contracts/library.md) | Library IPC, timeline, media protocol, viewer |
| [`contracts/health.md`](contracts/health.md) | Library health IPC, duplicates, missing/moved files, validation |
| [`contracts/other-files.md`](contracts/other-files.md) | Other files IPC, categories, pagination, actions |
| [`contracts/settings.md`](contracts/settings.md) | Settings, cache clearing, backups, manual recovery |
| [`contracts/replication.md`](contracts/replication.md) | Replication IPC, DB methods, run states, destination catalogs, media scope |

## Release and quality

| Document | Purpose |
|---|---|
| [`release/acceptance.md`](release/acceptance.md) | v0.1 acceptance criteria and sign-off status |
| [`release/release-checklist.md`](release/release-checklist.md) | Clean-VM, recovery, disconnect, codec, and real-archive pass |
| [`release/security-review.md`](release/security-review.md) | Trust boundaries, controls, and residual risks |
| [`release/codec-matrix.md`](release/codec-matrix.md) | Image/video cataloging, playback expectations, fallbacks |

## Decisions and history

| Document | Purpose |
|---|---|
| [`adr/`](adr/README.md) | Architecture decision records and template |
| [`archive/agent-workstreams.md`](archive/agent-workstreams.md) | Archived parallel-agent operating agreement |

The static files in `ui-mockups/` are a design reference only. Screenshots in
`images/` are captured from the packaged application.

## Maintenance rules

- Keep current behavior in `product/` and `contracts/`.
- Keep decisions in `adr/`.
- Keep completed phase detail in `archive/phase-history.md`, not in new top-level
  phase files.
- Update the owning contract when IPC, schema, or user-visible behavior changes.
- Do not add a new document when an existing product, contract, release, or ADR
  document has the right home.
