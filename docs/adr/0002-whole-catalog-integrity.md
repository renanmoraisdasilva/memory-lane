# 0002 - Whole-catalog validation and all-file duplicates

- Status: Accepted
- Date: 2026-10-31

## Context

Phase 4 turns the existing hash, missing-file, moved-candidate, and validation
tables into Library health. The product can either limit integrity checks to
photos/videos or cover every cataloged file, and deep validation can either
reuse stored hashes or recompute them.

## Decision

- Duplicate detection covers **all present catalog files**, not only media.
- Validation defaults to the **whole catalog**; users select the levels.
- Deep SHA-256 validation recomputes every checked file. A mismatch is recorded
  and the stored hash is updated to the actual value.
- Metadata revalidation updates extracted metadata and resolved dates, but keeps
  active manual date overrides.
- Moved-file confirmation rechecks existence and hash before updating a catalog
  path, then removes the duplicate row discovered at the new path.

## Alternatives

- **Media-only integrity.** Faster and smaller UI, but documents and archives
  would be invisible to duplicate/missing/validation workflows.
- **Reuse stored hashes.** Cheap but cannot detect bit rot or changed content.
- **Report-only hash mismatch.** Preserves history, but leaves stale hashes feeding
  future duplicate and moved detection.
- **Trust scan candidates without rechecking.** Simpler, but can corrupt catalog
  paths if the drive changed between scan and confirmation.

## Consequences

Easier:

- One integrity model covers every file type.
- Deep validation reflects current file content.
- Moved-file confirmation is defensive and deterministic.
- Metadata refresh keeps date overrides intact.

Harder:

- Whole-catalog validation over a 2 TB archive can run for hours.
- Duplicate rebuilds write to the catalog and need benchmarking on very large
  sets.
- Pause is cooperative between files; an in-flight large hash must finish.
- Validation report counts are per-result checks rather than a deduplicated
  per-file outcome.
