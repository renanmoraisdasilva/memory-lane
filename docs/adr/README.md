# Architecture decision records

Architecture decision records capture significant technical decisions and why
they were made. They are short: context, decision, alternatives, consequences,
and status.

## Status values

- **Proposed** — under review.
- **Accepted** — current direction.
- **Superseded** — replaced by a later ADR.
- **Deprecated** — no longer recommended.

## Planned records

- `0001-electron-process-and-security-model.md`
- `0002-single-sqlite-writer-and-repositories.md`
- `0003-ipc-contracts-and-error-envelope.md`
- `0004-renderer-state-and-data-flow.md`
- `0005-styling-and-component-primitives.md`
- `0006-testing-and-quality-gates.md`
- `0007-packaging-and-distribution.md`

Create each record during Phase 0 of the implementation plan, before the related
code is written. A decision that changes later gets a new ADR rather than a
silent edit to the old one.
