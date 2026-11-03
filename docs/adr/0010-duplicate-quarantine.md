# 0010 - Duplicate quarantine exception

- Status: Accepted
- Date: 2026-11-02

## Context

Memory Lane's core promise is that the archive stays the archive: the drive is
the source of truth and the catalog can be rebuilt without touching an original.
That promise was stated as an absolute "never moves, renames, edits, or deletes"
rule.

The duplicate feature found a real problem the read-only promise did not solve:
exact duplicate copies can consume gigabytes, and the user needs a safe way to
reclaim that space without deleting the only copy. A catalog-only action cannot
reclaim disk space; the file has to move.

The implementation already exists: a keeper is chosen, non-keeper copies are
moved into `.memorylane_quarantine`, every move is journaled, and the catalog
rows are removed so a rescan does not report the moved files as missing.

## Decision

Allow one narrow exception to the read-only promise: the **duplicate quarantine
mover**.

- It may move only an eligible duplicate copy into
  `X:\.memorylane_quarantine\<run-id>\`.
- It never deletes a file. The app never deletes the quarantine folder.
- It requires explicit confirmation that states the keeper rule, quarantine
  path, skip rules, and how many groups have no verified backup.
- It re-hashes the source immediately before the same-volume move and the
  quarantined copy immediately after. A mismatch restores the source and
  journals the restore; if the restore fails, the run aborts.
- It never moves the last eligible copy. One keeper remains per group.
- It skips unsafe or ambiguous candidates: active date overrides on non-keeper
  copies, multiple overrides, hard links, empty files, files under 1 KB,
  changed or missing files, outside-root paths, and cross-volume renames.
- Every move writes a manifest entry, a journal line, and a `cleanup_moves`
  audit row.
- The source archive is read-only outside this mover. The read-only guard
  allowlist names only this mover; every other source write remains blocked.

The canonical wording is: **originals are never deleted or edited; the confirmed
duplicate quarantine mover is the only operation that may move an eligible
duplicate copy.**

## Alternatives

- **Delete duplicate copies.** Rejected: it breaks the no-delete promise and
  makes a mistake unrecoverable.
- **Move duplicates to the Windows Recycle Bin.** Rejected: it still deletes
  from the archive's perspective, the app cannot audit the bin, and the user can
  empty it accidentally.
- **No cleanup; report duplicates only.** Rejected: it leaves the disk-space
  problem unsolved, which is the reason the feature exists.
- **Move duplicates without confirmation.** Rejected: the consequence is too
  large for an implicit action.
- **Preview-only first release.** Rejected for the first release: the user
  asked for the action, and the guardrails and confirmation are the safety
  mechanism. A preview mode can be added later if needed.

## Consequences

Easier:

- The user can reclaim space from exact duplicates without deleting the only
  copy.
- The quarantine folder is a recoverable holding area, not a deletion.
- The keeper rule and the audit trail make the result explainable.

Harder:

- The source archive is no longer absolutely read-only; the promise becomes
  "read-only by default, with one reviewed exception."
- The read-only guard, security review, acceptance criteria, README, and
  contracts must name the exception consistently.
- The mover needs tests for hash mismatch, restore, hard links, date overrides,
  missing files, outside-root paths, and cross-volume renames.
- The quarantine folder is not a backup until it is copied elsewhere; the UI
  must say so.

## Follow-ups

- Acceptance rows Q1-Q9 in `docs/release/acceptance.md`.
- Batch 1 in `docs/traceability/requirements.json`.
- Security review: duplicate quarantine extension and allowlist entry.
- Tests tagged with `ML-QUAR-*` and `ML-SAFE-*` IDs.
