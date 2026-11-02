# Duplicate quarantine plan

Status: implemented (MVP). HTML mockup:
[`ui-mockups/duplicate-quarantine.html`](../../ui-mockups/duplicate-quarantine.html)

## Context

Example catalog used by the mockup:

- 128 exact full-SHA-256 groups
- 342 files, 6.4 GB in duplicate copies
- about 3.1 GB excess if one copy per group is kept
- 214 files move; 128 keepers stay
- 84 two-file groups; 44 groups with 3+ copies
- empty files skipped; files 1 KB and larger included

## UX

One screen, one action.

1. Duplicates tab shows exact groups with `KEEP` / `MOVE` badges and one primary
   button.
2. Confirmation shows the counts, keeper rule, quarantine path, skip rules, and a
   required acknowledgement.
3. Progress shows files/bytes moved, current path, and cancel-after-current.
4. Completion shows moved/skipped totals and the manual next steps: back up the
   quarantine folder, remove it, rescan.

The HTML mockup is the source of truth for layout and states.

## Decisions

- Keeper rule: **oldest original**.
- Scope: all eligible groups; no user-defined protected folders.
- Catalog after a move: **delete the moved rows**, with a journal and
  `cleanup_moves` audit record.
- Candidate-only protection: **skip the group**.
- No verified coverage: **skip the group**.
- Small files: **skip empty files; include 1 KB and larger**.
- Enablement: the **Move** button is live in the first release; no read-only
  preview phase and no settings toggle.
- Progress: **cancel only** for the first release.
- Quarantine layout: one **run subfolder** per cleanup.

System paths `.memorylane` and `.memorylane_quarantine` are always excluded.
They are not user-defined exclusions.

## Keeper rule

1. Oldest `created_at_fs`
2. Oldest `modified_at_fs`
3. Shallower path, then shorter path
4. Shorter file name
5. Lower file ID

Path and name length are tiebreakers, not the primary rule. A short path can be
a backup folder; oldest creation is a better signal of the original.

Protection is a gate, not a ranking preference:

- The selected keeper must have verified backup coverage.
- No non-keeper copy may have an active date override.
- If more than one copy has an active date override, skip the group.
- If a non-keeper copy is the only covered copy, skip the group.
- Never move the last eligible copy.

## Eligibility

A group is eligible only when:

- It has at least two eligible present files.
- The chosen keeper has verified backup coverage.
- No non-keeper copy has an active date override.
- No non-keeper copy is the only copy with verified coverage.
- No hard-link ambiguity exists.
- Files are not empty and not smaller than 1 KB. The scanner records `link_count`
  so hard links are detected before a plan is built; the mover checks the link
  count again immediately before a rename.

Groups that fail a rule are counted and reported as skipped. The cleanup never
silently drops a group.

## Quarantine

```text
X:\.memorylane_quarantine\<run-id>\
  manifest.json
  journal.jsonl
  <relative source path>...
```

- Preserve relative paths; use one run folder per cleanup.
- Exclude `.memorylane_quarantine` from scans.
- Write a journal line for every move: source, quarantine path, hash, size,
  timestamps, group, keeper.
- The app never deletes the quarantine folder.
- After a successful move batch, delete the moved catalog rows. This prevents a
  later scan from reporting them as missing. The journal and `cleanup_moves`
  table preserve the audit record.
- Restore manually by copying files back and rescanning.

## Code changes

- Contracts/IPC: cleanup plan, start, state, cancel, reveal quarantine.
- Main: `CleanupService`, keeper comparator, quarantine worker, `cleanup`
  workload kind.
- DB: `cleanup_runs` / `cleanup_moves` migration; plan/apply/rebuild repository;
  delete moved rows, refresh adoption counters.
- Scanner: exclude `.memorylane_quarantine`; `.memorylane` remains excluded.
- Read-only guard: allow only the quarantine mover; every other source write
  remains blocked.
- UI: `DuplicatesTab` pagination, keeper/move badges, confirmation, progress,
  completion.
- The DB worker remains the only catalog writer. The worker only moves files and
  reports batches.

## Guardrails

- Exact full-SHA-256 groups only; re-hash keeper and candidates before moving.
- One keeper per group; never move the last copy.
- Only clean groups whose keeper has verified backup coverage.
- Quarantine, never delete; no `unlink`/`rm` in the mover.
- Validate source paths under the catalog root and destinations under the run
  folder; reject symlink escapes.
- Block cleanup while a scan, backup, or validation is running.
- Require the explicit confirmation acknowledgement.
- Journal and DB audit; no automatic quarantine removal.

## Edge cases

- File changed or missing since scan → skip group/candidate and report.
- Keeper missing or uncovered → skip group.
- Candidate-only coverage or date override → skip group.
- Multiple date overrides → skip group.
- Locked/read-only file, long path, Unicode → skip/report without aborting.
- Cross-volume rename → skip; quarantine is on the same volume.
- Hard links → skip.
- Empty files → skip; 1 KB+ included.
- Crash/cancel → journal and `cleanup_moves` are the record.
- DB batch failure after a move → abort/report; rescan can reconcile.
- Quarantine collision → unique run folder, suffix destination if needed.

## Tests

- Keeper comparator and plan aggregation.
- Eligibility: no coverage, candidate-only coverage, date override, empty file,
  1 KB file, hard link.
- Temp-dir mover: move, journal, collision, changed hash, locked/long path.
- DB: row deletion, cascades, adoption counters, duplicate rebuild.
- Service: workload conflict, cancel, interrupted run.
- Renderer: button, dialog, progress, completion, pagination.
- Service integration: real mover over a temp folder → keeper stays → losing
  file is quarantined → catalog row is deleted → workload lease is released.
- E2E: scan → duplicate badges and skip reasons → cleanup button stays disabled
  when no keeper has verified coverage.
- Performance: a large-catalog plan and a 1k-file move are follow-up checks.

## Phases

1. MVP: keeper rule, paginated duplicates, live move button, confirmation,
   quarantine mover, DB apply, progress, completion.
2. History/restore and optional folder-priority policies.
